const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');
const LedgerService = require('./ledger.service');

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const PAYMENT_METHODS = new Set(['cash', 'bank_transfer', 'cheque']);

class LoanService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.ledgerService = new LedgerService(db, tenantId);
    }

    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
            SYSTEM_ACCOUNTS.BANK_LOANS,
            SYSTEM_ACCOUNTS.INTEREST_EXPENSE,
            SYSTEM_ACCOUNTS.LATE_PENALTY_EXPENSE,
        ]);

        return {
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
            bank_loans: accountIds[SYSTEM_ACCOUNTS.BANK_LOANS],
            interest_expense: accountIds[SYSTEM_ACCOUNTS.INTEREST_EXPENSE],
            late_penalty_expense: accountIds[SYSTEM_ACCOUNTS.LATE_PENALTY_EXPENSE],
        };
    }

    async resolvePaymentAccountId(trx, { paymentMethod = 'bank_transfer', paymentAccountId = null } = {}) {
        if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) {
            throw new AppError('Invalid payment method', 400);
        }

        if (paymentAccountId) {
            await validateAccountTypes(trx, this.tenantId, [
                { accountId: paymentAccountId, allowedTypes: ['asset'], label: 'Payment account' },
            ]);
            return paymentAccountId;
        }

        const accountCode = paymentMethod === 'cash'
            ? SYSTEM_ACCOUNTS.CASH_IN_HAND
            : SYSTEM_ACCOUNTS.BANK_ACCOUNT;
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [accountCode]);
        return accountIds[accountCode];
    }

    async ensureSufficientPaymentBalance(trx, accountId, amount) {
        const account = await trx('accounts')
            .where({ id: accountId, tenant_id: this.tenantId, is_active: true })
            .forUpdate()
            .first('code', 'name', 'current_balance');

        if (!account) {
            throw new AppError('Payment account not found', 400);
        }

        if (Number(account.current_balance || 0) + 0.01 < Number(amount || 0)) {
            throw new AppError(
                `Insufficient balance in ${account.name} (${account.code}). Available: Rs. ${Number(account.current_balance || 0).toLocaleString()}`,
                400
            );
        }
    }

    async create(data, userId) {
        const cleanDate = (val) => val && val !== '' ? val : null;

        const {
            loan_reference,
            bank_name,
            loan_type = 'business',
            principal_amount,
            interest_rate = 0,
            interest_type = 'fixed',
            base_rate,
            margin,
            start_date,
            end_date,
            emi_amount,
            repayment_type = 'emi',
            payment_method = 'bank_transfer',
            payment_account_id,
            grace_period_type = 'none',
            grace_period_months = 0,
            collateral_details,
            notes
        } = data;

        const cleanStartDate = cleanDate(start_date);
        const cleanEndDate = cleanDate(end_date);

        // Validate start date is valid and not too far in the future
        if (!cleanStartDate) {
            throw new AppError('Start date is required', 400);
        }
        
        const startDateObj = new Date(cleanStartDate);
        if (isNaN(startDateObj.getTime())) {
            throw new AppError('Invalid start date format', 400);
        }
        
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 1);
        if (startDateObj > maxFutureDate) {
            throw new AppError('Start date cannot be more than 1 day in the future', 400);
        }

        const numericPrincipal = Number(principal_amount || 0);
        if (!numericPrincipal || numericPrincipal <= 0) {
            throw new AppError('Principal amount must be a positive number', 400);
        }

        if (!loan_reference || !bank_name) {
            throw new AppError('Loan reference and bank name are required', 400);
        }

        // Calculate EMI if not provided
        let calculatedEmi = emi_amount ? Number(emi_amount) : null;
        if (!calculatedEmi && (Number(interest_rate) > 0 || Number(base_rate) > 0)) {
            const effectiveRate = interest_type === 'floating' 
                ? Number(base_rate || 0) + Number(margin || 0)
                : Number(interest_rate || 0);
            const months = this.calculateTenureMonths(cleanStartDate, cleanEndDate);
            calculatedEmi = this.calculateEMI(numericPrincipal, effectiveRate, months);
        }

        return this.db.transaction(async (trx) => {
            const accounts = await this.getRequiredAccounts(trx);

            const paymentAccountId = await this.resolvePaymentAccountId(trx, {
                paymentMethod: payment_method,
                paymentAccountId: payment_account_id,
            });

            await validateAccountTypes(trx, this.tenantId, [
                { accountId: paymentAccountId, allowedTypes: ['asset'], label: 'Payment account' },
                { accountId: accounts.bank_loans, allowedTypes: ['liability'], label: 'Bank loans account' },
            ]);

            // Calculate next payment date (accounting for grace period)
            let nextPaymentDate = cleanStartDate;
            if (grace_period_type === 'none' && calculatedEmi) {
                const startDateObj = new Date(cleanStartDate);
                startDateObj.setMonth(startDateObj.getMonth() + 1);
                nextPaymentDate = startDateObj.toISOString().split('T')[0];
            } else if (grace_period_type === 'interest_only' || grace_period_type === 'full') {
                const startDateObj = new Date(cleanStartDate);
                startDateObj.setMonth(startDateObj.getMonth() + Number(grace_period_months || 0) + 1);
                nextPaymentDate = startDateObj.toISOString().split('T')[0];
            }

            // Create loan record
            const [loan] = await trx('loans').insert({
                tenant_id: this.tenantId,
                loan_reference,
                bank_name,
                loan_type,
                principal_amount: numericPrincipal,
                interest_rate: Number(interest_rate || 0),
                interest_type: interest_type || 'fixed',
                base_rate: base_rate ? Number(base_rate) : null,
                margin: margin ? Number(margin) : null,
                start_date: cleanStartDate,
                end_date: cleanEndDate,
                emi_amount: calculatedEmi,
                original_emi: calculatedEmi,
                next_payment_date: nextPaymentDate,
                repayment_type,
                grace_period_type,
                grace_period_months: grace_period_months ? Number(grace_period_months) : 0,
                collateral_details,
                notes,
                status: 'active',
                created_by: userId,
            }).returning('*');

            // Create journal entry for loan received
            // Dr Bank/Cash (increases asset)  Cr Bank Loans (increases liability)
            await this.ledgerService.createJournalEntry({
                journal_date: cleanStartDate,
                transaction_type: 'journal',
                reference_type: 'loan',
                reference_id: loan.id,
                narration: `Loan Received - ${loan_reference} from ${bank_name}`,
                entries: [
                    {
                        account_id: paymentAccountId,
                        entry_type: 'debit',
                        amount: numericPrincipal,
                        narration: `Loan received from ${bank_name}`,
                    },
                    {
                        account_id: accounts.bank_loans,
                        entry_type: 'credit',
                        amount: numericPrincipal,
                        narration: `Loan from ${bank_name}`,
                    },
                ],
                created_by: userId,
            }, trx);

            // Update Bank Loans current_balance
            await trx('accounts')
                .where({ id: accounts.bank_loans, tenant_id: this.tenantId })
                .increment('current_balance', numericPrincipal);

            await trx('accounts')
                .where({ id: paymentAccountId, tenant_id: this.tenantId })
                .increment('current_balance', numericPrincipal);

            return loan;
        });
    }

    async list(params = {}) {
        const { status, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        let query = this.db('loans')
            .where({ tenant_id: this.tenantId, is_deleted: false });

        if (status) {
            query = query.where('status', status);
        }

        const total = await query.clone().count('id as count').first();
        const loans = await query
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Calculate outstanding for each loan
        for (const loan of loans) {
            const payments = await this.db('loan_payments')
                .where({ loan_id: loan.id, tenant_id: this.tenantId })
                .select(
                    this.db.raw('COALESCE(SUM(principal_paid), 0) as total_principal'),
                    this.db.raw('COALESCE(SUM(interest_paid), 0) as total_interest')
                ).first();

            loan.total_principal_paid = Number(payments.total_principal || 0);
            loan.total_interest_paid = Number(payments.total_interest || 0);
            loan.outstanding_principal = roundCurrency(
                Number(loan.principal_amount) - loan.total_principal_paid
            );
        }

        return {
            loans,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(total.count),
                pages: Math.ceil(total.count / limit),
            },
        };
    }

    async getById(loanId) {
        const loan = await this.db('loans')
            .where({ id: loanId, tenant_id: this.tenantId, is_deleted: false })
            .first();

        if (!loan) {
            throw new AppError('Loan not found', 404);
        }

        // Get payment summary
        const payments = await this.db('loan_payments')
            .where({ loan_id: loanId, tenant_id: this.tenantId })
            .select(
                this.db.raw('COALESCE(SUM(principal_paid), 0) as total_principal'),
                this.db.raw('COALESCE(SUM(interest_paid), 0) as total_interest'),
                this.db.raw('COUNT(*) as payment_count')
            ).first();

        loan.total_principal_paid = Number(payments.total_principal || 0);
        loan.total_interest_paid = Number(payments.total_interest || 0);
        loan.outstanding_principal = roundCurrency(
            Number(loan.principal_amount) - loan.total_principal_paid
        );
        loan.payment_count = Number(payments.payment_count || 0);

        return loan;
    }

    async getPayments(loanId, params = {}) {
        const loan = await this.getById(loanId);
        
        const payments = await this.db('loan_payments')
            .where({ loan_id: loanId, tenant_id: this.tenantId })
            .orderBy('payment_date', 'desc');

        return { loan, payments };
    }

    async recordPayment(loanId, data, userId) {
        const cleanDate = (val) => val && val !== '' ? val : null;

        const {
            payment_date,
            payment_type = 'emi',
            principal_paid = 0,
            interest_paid = 0,
            total_payment,
            payment_method = 'bank_transfer',
            reference_number,
            notes,
            payment_account_id
        } = data;

        const cleanPaymentDate = cleanDate(payment_date);
        
        if (!cleanPaymentDate) {
            throw new AppError('Payment date is required', 400);
        }
        
        const paymentDateObj = new Date(cleanPaymentDate);
        if (isNaN(paymentDateObj.getTime())) {
            throw new AppError('Invalid payment date format', 400);
        }
        
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 1);
        if (paymentDateObj > maxFutureDate) {
            throw new AppError('Payment date cannot be more than 1 day in the future', 400);
        }

        const loan = await this.getById(loanId);

        if (loan.status !== 'active') {
            throw new AppError(`Cannot record payment on ${loan.status} loan`, 400);
        }

        const numericPrincipal = Number(principal_paid || 0);
        const numericInterest = Number(interest_paid || 0);
        const numericTotal = Number(total_payment || 0);

        if (numericTotal <= 0) {
            throw new AppError('Payment amount must be positive', 400);
        }
        if (numericPrincipal < 0 || numericInterest < 0) {
            throw new AppError('Principal and interest amounts cannot be negative', 400);
        }

        let actualPrincipal = numericPrincipal;
        let actualInterest = numericInterest;
        const actualTotal = roundCurrency(numericTotal);

        if (actualPrincipal <= 0 && actualInterest <= 0) {
            actualPrincipal = actualTotal;
        } else if (actualPrincipal <= 0) {
            actualPrincipal = roundCurrency(actualTotal - actualInterest);
        } else if (actualInterest <= 0) {
            actualInterest = roundCurrency(actualTotal - actualPrincipal);
        }

        if (actualPrincipal < 0 || actualInterest < 0) {
            throw new AppError('Principal and interest amounts cannot be negative', 400);
        }

        if (Math.abs(roundCurrency(actualPrincipal + actualInterest) - roundCurrency(actualTotal)) > 0.01) {
            throw new AppError('Total payment must equal principal plus interest', 400);
        }

        // Check not exceeding outstanding
        if (actualPrincipal > loan.outstanding_principal) {
            throw new AppError('Principal payment exceeds outstanding amount', 400);
        }

        // Calculate payment status and late penalty
        const expectedEmi = loan.emi_amount || loan.original_emi || this.calculateEMI(
            Number(loan.principal_amount),
            this.getEffectiveRate(loan),
            this.calculateTenureMonths(loan.start_date, loan.end_date)
        );
        
        // Get last payment date to calculate expected due date
        const lastPayment = await this.db('loan_payments')
            .where({ loan_id: loanId, tenant_id: this.tenantId })
            .orderBy('payment_date', 'desc')
            .first();
        
        // Calculate expected due date (next month from last payment or start date + 1 month)
        let expectedDueDate;
        if (lastPayment) {
            expectedDueDate = new Date(lastPayment.payment_date);
            expectedDueDate.setMonth(expectedDueDate.getMonth() + 1);
        } else {
            expectedDueDate = new Date(loan.start_date);
            expectedDueDate.setMonth(expectedDueDate.getMonth() + 1);
        }
        
        const daysLate = Math.max(0, Math.ceil((paymentDateObj - expectedDueDate) / (1000 * 60 * 60 * 24)));
        const isPartial = actualTotal < expectedEmi;
        
        // Determine payment status
        let paymentStatus = 'on_time';
        let latePenalty = 0;
        
        if (isPartial) {
            paymentStatus = 'partial';
        } else if (daysLate > 0) {
            paymentStatus = 'late';
            // SBP guideline: late penalty up to 2% above markup rate
            latePenalty = roundCurrency(actualTotal * 0.02); // 2% of total payment
        }

        return this.db.transaction(async (trx) => {
            const accounts = await this.getRequiredAccounts(trx);

            const paymentAccountId = await this.resolvePaymentAccountId(trx, {
                paymentMethod: payment_method,
                paymentAccountId: payment_account_id,
            });

            await validateAccountTypes(trx, this.tenantId, [
                { accountId: accounts.bank_loans, allowedTypes: ['liability'], label: 'Bank loans account' },
                { accountId: accounts.interest_expense, allowedTypes: ['expense'], label: 'Interest expense account' },
                { accountId: paymentAccountId, allowedTypes: ['asset'], label: 'Payment account' },
                { accountId: accounts.late_penalty_expense, allowedTypes: ['expense'], label: 'Late penalty expense account' },
            ]);

            // For late penalty, add to total amount needed
            const totalWithPenalty = roundCurrency(actualTotal + latePenalty);
            await this.ensureSufficientPaymentBalance(trx, paymentAccountId, totalWithPenalty);

            // Create payment record with status and penalty
            const [payment] = await trx('loan_payments').insert({
                tenant_id: this.tenantId,
                loan_id: loanId,
                payment_date: cleanPaymentDate,
                payment_type,
                principal_paid: roundCurrency(actualPrincipal),
                interest_paid: roundCurrency(actualInterest),
                total_payment: roundCurrency(actualTotal),
                payment_method,
                reference_number,
                notes,
                payment_status: paymentStatus,
                late_penalty: latePenalty,
                settlement_type: 'regular',
                created_by: userId,
            }).returning('*');

            // Create journal entry for payment
            // Dr Bank Loans (reduces liability) + Dr Interest Expense (cost) = Cr Bank (total)
            const journalEntries = [
                {
                    account_id: accounts.bank_loans,
                    entry_type: 'debit',
                    amount: roundCurrency(actualPrincipal),
                    narration: `Principal payment for ${loan.loan_reference}`,
                },
            ];

            if (actualInterest > 0) {
                journalEntries.push({
                    account_id: accounts.interest_expense,
                    entry_type: 'debit',
                    amount: roundCurrency(actualInterest),
                    narration: `Interest for ${loan.loan_reference}`,
                });
                
                // Update interest expense current_balance
                await trx('accounts')
                    .where({ id: accounts.interest_expense, tenant_id: this.tenantId })
                    .increment('current_balance', roundCurrency(actualInterest));
            }

            // Add late penalty entry if applicable
            let totalCreditAmount = roundCurrency(actualTotal);
            if (latePenalty > 0) {
                journalEntries.push({
                    account_id: accounts.late_penalty_expense,
                    entry_type: 'debit',
                    amount: roundCurrency(latePenalty),
                    narration: `Late payment penalty for ${loan.loan_reference}`,
                });
                // Update late penalty expense current_balance
                await trx('accounts')
                    .where({ id: accounts.late_penalty_expense, tenant_id: this.tenantId })
                    .increment('current_balance', roundCurrency(latePenalty));
                
                totalCreditAmount = roundCurrency(actualTotal + latePenalty);
            }

            // Add credit entry to payment account (total including penalty)
            journalEntries.push({
                account_id: paymentAccountId,
                entry_type: 'credit',
                amount: totalCreditAmount,
                narration: `Payment for ${loan.loan_reference}`,
            });

            await this.ledgerService.createJournalEntry({
                journal_date: cleanPaymentDate,
                transaction_type: 'loan',
                reference_type: 'loan_payment',
                reference_id: payment.id,
                narration: `Loan Payment - ${loan.loan_reference}`,
                entries: journalEntries,
                created_by: userId,
            }, trx);

            // Update Bank Loans current_balance (debit reduces liability)
            if (actualPrincipal > 0) {
                await trx('accounts')
                    .where({ id: accounts.bank_loans, tenant_id: this.tenantId })
                    .decrement('current_balance', roundCurrency(actualPrincipal));
            }

            await trx('accounts')
                .where({ id: paymentAccountId, tenant_id: this.tenantId })
                .decrement('current_balance', roundCurrency(totalCreditAmount));

            // Check if loan is fully paid
            const remaining = loan.outstanding_principal - actualPrincipal;
            if (remaining <= 0.01) {
                await trx('loans')
                    .where({ id: loanId })
                    .update({ status: 'paid_off' });
            }

            return payment;
        });
    }

    async getSummary() {
        const loans = await this.db('loans')
            .where({ tenant_id: this.tenantId, is_deleted: false });

        let totalPrincipal = 0;
        let totalOutstanding = 0;
        let totalInterestPaid = 0;
        let activeCount = 0;
        let paidOffCount = 0;

        for (const loan of loans) {
            const payments = await this.db('loan_payments')
                .where({ loan_id: loan.id, tenant_id: this.tenantId })
                .select(
                    this.db.raw('COALESCE(SUM(principal_paid), 0) as total_principal'),
                    this.db.raw('COALESCE(SUM(interest_paid), 0) as total_interest')
                ).first();

            const principalPaid = Number(payments.total_principal || 0);
            const interestPaid = Number(payments.total_interest || 0);
            const outstanding = Number(loan.principal_amount) - principalPaid;

            totalPrincipal += Number(loan.principal_amount);
            totalOutstanding += outstanding;
            totalInterestPaid += interestPaid;

            if (loan.status === 'active') activeCount++;
            if (loan.status === 'paid_off') paidOffCount++;
        }

        return {
            total_loans: loans.length,
            active_loans: activeCount,
            paid_off_loans: paidOffCount,
            total_principal: roundCurrency(totalPrincipal),
            total_outstanding: roundCurrency(totalOutstanding),
            total_interest_paid: roundCurrency(totalInterestPaid),
        };
    }

    async update(loanId, data, userId) {
        const loan = await this.getById(loanId);
        
        const updates = {};
        const allowedFields = ['loan_reference', 'bank_name', 'loan_type', 'interest_rate', 'end_date', 'emi_amount', 'notes'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates[field] = data[field];
            }
        }

        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date();
            await this.db('loans')
                .where({ id: loanId, tenant_id: this.tenantId })
                .update(updates);
        }

        return this.getById(loanId);
    }

    async delete(loanId, userId) {
        const loan = await this.getById(loanId);

        const postedJournal = await this.db('journals')
            .where({ tenant_id: this.tenantId, reference_type: 'loan', reference_id: loan.id })
            .first('id');

        if (postedJournal) {
            throw new AppError('Posted loans cannot be deleted. Record a reversing journal or loan settlement instead.', 409);
        }

        await this.db('loans')
            .where({ id: loanId, tenant_id: this.tenantId })
            .update({ 
                is_deleted: true, 
                updated_at: new Date() 
            });

        return { success: true, message: 'Loan deleted' };
    }

    // ========================================
    // EMI Calculator & Amortization
    // ========================================

    calculateEMI(principal, annualRate, tenureMonths) {
        const monthlyRate = annualRate / 12 / 100;
        
        if (monthlyRate === 0) {
            return roundCurrency(principal / tenureMonths);
        }
        
        // EMI = [P × r × (1+r)^n] / [(1+r)^n – 1]
        const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / 
                     (Math.pow(1 + monthlyRate, tenureMonths) - 1);
        
        return roundCurrency(emi);
    }

    getEffectiveRate(loan) {
        if (loan.interest_type === 'floating' && loan.base_rate) {
            return Number(loan.base_rate || 0) + Number(loan.margin || 0);
        }
        return Number(loan.interest_rate || 0);
    }

    generateAmortizationSchedule(loan) {
        const principal = Number(loan.principal_amount);
        const annualRate = this.getEffectiveRate(loan);
        const totalMonths = loan.tenure_months || this.calculateTenureMonths(loan.start_date, loan.end_date);
        const graceMonths = Number(loan.grace_period_months || 0);
        const graceType = loan.grace_period_type || 'none';
        
        if (principal <= 0 || totalMonths <= 0) {
            return [];
        }

        const emi = this.calculateEMI(principal, annualRate, totalMonths);
        const monthlyRate = annualRate / 12 / 100;
        
        const schedule = [];
        let remainingBalance = principal;
        let startDate = new Date(loan.start_date);

        // Handle grace period entries
        if (graceType === 'interest_only' || graceType === 'full') {
            for (let month = 1; month <= graceMonths; month++) {
                const paymentDate = new Date(startDate);
                paymentDate.setMonth(paymentDate.getMonth() + month);
                
                let interestPortion = 0;
                let principalPortion = 0;
                let emiAmount = 0;
                
                if (graceType === 'interest_only') {
                    // Interest-only: pay interest only, principal stays same
                    interestPortion = remainingBalance * monthlyRate;
                    emiAmount = roundCurrency(interestPortion);
                } else if (graceType === 'full') {
                    // Full grace: no payment, interest accrues
                    interestPortion = remainingBalance * monthlyRate;
                    remainingBalance += interestPortion; // Interest gets added to principal
                    emiAmount = 0;
                }
                
                schedule.push({
                    month,
                    payment_date: paymentDate.toISOString().split('T')[0],
                    emi: emiAmount,
                    principal: roundCurrency(principalPortion),
                    interest: roundCurrency(interestPortion),
                    balance: roundCurrency(remainingBalance),
                    grace_period: true
                });
            }
        }

        // Regular EMI payments after grace period
        const startMonth = graceType !== 'none' ? graceMonths + 1 : 1;
        for (let month = startMonth; month <= totalMonths; month++) {
            const interestPortion = remainingBalance * monthlyRate;
            const principalPortion = emi - interestPortion;
            
            remainingBalance = Math.max(0, remainingBalance - principalPortion);
            
            const paymentDate = new Date(startDate);
            paymentDate.setMonth(paymentDate.getMonth() + month);
            
            schedule.push({
                month,
                payment_date: paymentDate.toISOString().split('T')[0],
                emi: roundCurrency(emi),
                principal: roundCurrency(principalPortion),
                interest: roundCurrency(interestPortion),
                balance: roundCurrency(remainingBalance)
            });
        }

        return schedule;
    }

    calculateTenureMonths(startDate, endDate) {
        if (!startDate || !endDate) return 12;
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.max(1, Math.round((end - start) / (30 * 24 * 60 * 60 * 1000)));
    }

    async calculateEarlySettlement(loanId) {
        const loan = await this.getById(loanId);
        
        if (loan.status !== 'active') {
            throw new AppError('Cannot calculate settlement for non-active loan', 400);
        }

        const remainingPrincipal = loan.outstanding_principal;
        const annualRate = this.getEffectiveRate(loan);
        
        // Calculate remaining interest (simplified - assumes full remaining period)
        // For accurate calculation, should use actual remaining days
        const payments = await this.db('loan_payments')
            .where({ loan_id: loanId, tenant_id: this.tenantId })
            .orderBy('payment_date', 'desc')
            .first();

        const lastPaymentDate = payments?.payment_date || loan.start_date;
        const daysSinceLastPayment = Math.ceil((new Date() - new Date(lastPaymentDate)) / (1000 * 60 * 60 * 24));
        
        // Pro-rated interest for remaining days
        const dailyRate = annualRate / 365 / 100;
        const accruedInterest = roundCurrency(remainingPrincipal * dailyRate * daysSinceLastPayment);
        
        // Early settlement typically has no penalty in Pakistan (SBP rule)
        // But some banks charge up to 2% - we'll make it configurable
        const settlementAmount = roundCurrency(remainingPrincipal + accruedInterest);

        return {
            outstanding_principal: remainingPrincipal,
            accrued_interest: accruedInterest,
            settlement_amount: settlementAmount,
            valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days validity
        };
    }

    async getAmortization(loanId) {
        const loan = await this.getById(loanId);
        
        // Get actual payments made
        const payments = await this.db('loan_payments')
            .where({ loan_id: loanId, tenant_id: this.tenantId })
            .orderBy('payment_date');
        
        // Generate full schedule
        const schedule = this.generateAmortizationSchedule(loan);
        
        // Mark payments that have been made
        let paymentIndex = 0;
        const paymentsMade = schedule.map(item => {
            const payment = payments[paymentIndex];
            const isPaid = payment && new Date(payment.payment_date) <= new Date(item.payment_date);
            
            if (isPaid && paymentIndex < payments.length - 1) {
                paymentIndex++;
            }
            
            return {
                ...item,
                paid: isPaid,
                actual_payment: isPaid ? payment : null
            };
        });

        return {
            loan: {
                principal: loan.principal_amount,
                rate: this.getEffectiveRate(loan),
                start_date: loan.start_date,
                end_date: loan.end_date
            },
            schedule: paymentsMade,
            summary: {
                total_principal: loan.principal_amount,
                total_interest: schedule.reduce((sum, m) => sum + m.interest, 0),
                total_emi: schedule.reduce((sum, m) => sum + m.emi, 0)
            }
        };
    }

    async calculateOverdue(loanId) {
        const loan = await this.getById(loanId);
        
        if (loan.status !== 'active') {
            return { overdue: false, amount: 0, days: 0 };
        }

        const today = new Date();
        const nextPaymentDate = loan.next_payment_date ? new Date(loan.next_payment_date) : null;
        
        if (!nextPaymentDate || nextPaymentDate > today) {
            return { overdue: false, amount: 0, days: 0 };
        }

        const overdueDays = Math.ceil((today - nextPaymentDate) / (1000 * 60 * 60 * 24));
        const emiAmount = Number(loan.emi_amount || loan.original_emi || 0);
        const overdueAmount = emiAmount * Math.ceil(overdueDays / 30); // Count full months
        
        // SBP guideline: late payment penalty up to 2% above markup rate
        const annualRate = this.getEffectiveRate(loan);
        const penaltyRate = 2; // 2% as per SBP
        const latePenalty = roundCurrency(overdueAmount * (penaltyRate / 100));

        return {
            overdue: true,
            days: overdueDays,
            amount: overdueAmount,
            late_penalty: latePenalty,
            next_payment_date: loan.next_payment_date
        };
    }

    // ========================================
    // Rate Change - Floating Rate (KIBOR)
    // ========================================

    async recordRateChange(loanId, data, userId) {
        const loan = await this.getById(loanId);
        
        if (loan.status !== 'active') {
            throw new AppError('Cannot change rate on non-active loan', 400);
        }

        const { base_rate, margin, effective_date = new Date().toISOString().split('T')[0] } = data;

        if (loan.interest_type !== 'floating') {
            throw new AppError('Rate change only applicable to floating rate loans', 400);
        }

        const newBaseRate = Number(base_rate);
        const newMargin = Number(margin || 0);
        const effectiveRate = roundCurrency(newBaseRate + newMargin);

        // Store in rate history
        const [rateRecord] = await this.db('loan_rate_history').insert({
            loan_id: loanId,
            tenant_id: this.tenantId,
            effective_from: effective_date,
            rate_type: 'floating',
            base_rate: newBaseRate,
            margin: newMargin,
            effective_rate: effectiveRate,
            created_by: userId,
        }).returning('*');

        // Update loan with new rate
        await this.db('loans')
            .where({ id: loanId, tenant_id: this.tenantId })
            .update({
                base_rate: newBaseRate,
                margin: newMargin,
                updated_at: new Date(),
            });

        // Recalculate EMI if needed
        if (loan.emi_amount && loan.original_emi) {
            const newEmi = this.calculateEMI(
                loan.outstanding_principal,
                effectiveRate,
                this.calculateTenureMonths(loan.start_date, loan.end_date)
            );
            
            await this.db('loans')
                .where({ id: loanId })
                .update({ emi_amount: newEmi });
        }

        return {
            success: true,
            rate_history: rateRecord,
            new_effective_rate: effectiveRate,
            message: `Rate updated to KIBOR ${newBaseRate}% + ${newMargin}% = ${effectiveRate}%`
        };
    }

    async getRateHistory(loanId) {
        await this.getById(loanId); // Verify loan exists
        
        const history = await this.db('loan_rate_history')
            .where({ loan_id: loanId, tenant_id: this.tenantId })
            .orderBy('effective_from', 'desc');

        return history;
    }

    // ========================================
    // Partial Prepayment
    // ========================================

    async recordPrepayment(loanId, data, userId) {
        const loan = await this.getById(loanId);
        
        if (loan.status !== 'active') {
            throw new AppError('Cannot prepay on non-active loan', 400);
        }

        const { prepayment_date, prepayment_amount, recalculate_emi = true } = data;
        const amount = Number(prepayment_amount);

        if (amount <= 0) {
            throw new AppError('Prepayment amount must be positive', 400);
        }

        if (amount > loan.outstanding_principal) {
            throw new AppError('Prepayment cannot exceed outstanding principal', 400);
        }

        // Record as a regular payment with settlement_type = 'partial'
        const payment = await this.recordPayment(loanId, {
            payment_date: prepayment_date || new Date().toISOString().split('T')[0],
            payment_type: 'prepayment',
            principal_paid: amount,
            interest_paid: 0,
            total_payment: amount,
            payment_method: 'bank_transfer',
            payment_account_id: data.payment_account_id,
            notes: `Partial prepayment - ${data.notes || 'Prepayment'}`,
        }, userId);

        // Update settlement_type to partial
        await this.db('loan_payments')
            .where({ id: payment.id })
            .update({ 
                settlement_type: 'partial',
                prepayment_amount: amount 
            });

        // Recalculate EMI if requested
        let newEmi = null;
        if (recalculate_emi) {
            const remainingPrincipal = loan.outstanding_principal - amount;
            const remainingMonths = this.calculateTenureMonths(loan.start_date, loan.end_date) - loan.payment_count;
            
            if (remainingPrincipal > 0 && remainingMonths > 0) {
                newEmi = this.calculateEMI(
                    remainingPrincipal,
                    this.getEffectiveRate(loan),
                    remainingMonths
                );

                await this.db('loans')
                    .where({ id: loanId })
                    .update({ emi_amount: newEmi });
            }
        }

        return {
            success: true,
            prepayment: payment,
            previous_outstanding: loan.outstanding_principal,
            new_outstanding: roundCurrency(loan.outstanding_principal - amount),
            new_emi: newEmi,
            message: `Prepayment of Rs.${amount.toLocaleString()} recorded. Outstanding: Rs.${(loan.outstanding_principal - amount).toLocaleString()}`
        };
    }

    // ========================================
    // Loan Restructuring
    // ========================================

    async restructureLoan(loanId, data, userId) {
        const loan = await this.getById(loanId);
        
        if (loan.status !== 'active') {
            throw new AppError('Cannot restructure non-active loan', 400);
        }

        const { 
            new_end_date, 
            new_interest_rate, 
            new_emi,
            restructuring_fee = 0,
            reason 
        } = data;

        const updates = {
            updated_at: new Date(),
        };

        let emiChanged = false;
        let rateChanged = false;

        if (new_end_date) {
            updates.end_date = new_end_date;
        }

        if (new_interest_rate) {
            updates.interest_rate = Number(new_interest_rate);
            rateChanged = true;
        }

        if (new_emi) {
            updates.emi_amount = Number(new_emi);
            emiChanged = true;
        }

        // Add restructuring fee as expense
        if (restructuring_fee > 0) {
            const accounts = await this.getRequiredAccounts(this.db);
            
            await this.db('accounts')
                .where({ id: accounts.interest_expense, tenant_id: this.tenantId })
                .increment('current_balance', restructuring_fee);
        }

        // Update loan
        await this.db('loans')
            .where({ id: loanId, tenant_id: this.tenantId })
            .update(updates);

        const restructuredLoan = await this.getById(loanId);

        return {
            success: true,
            loan: restructuredLoan,
            changes: {
                new_end_date: updates.end_date,
                new_interest_rate: updates.interest_rate,
                new_emi: updates.emi_amount,
                restructuring_fee,
                reason,
            },
            message: 'Loan restructured successfully'
        };
    }

    // ========================================
    // Early Settlement / Full Payoff
    // ========================================

    async settleLoan(loanId, data, userId) {
        const loan = await this.getById(loanId);
        
        if (loan.status !== 'active') {
            throw new AppError('Loan is not active', 400);
        }

        const settlement = await this.calculateEarlySettlement(loanId);
        
        const { payment_date = new Date().toISOString().split('T')[0], payment_method = 'bank_transfer', payment_account_id } = data;

        // Record final payment with settlement
        const payment = await this.recordPayment(loanId, {
            payment_date,
            payment_type: 'settlement',
            principal_paid: settlement.outstanding_principal,
            interest_paid: settlement.accrued_interest,
            total_payment: settlement.settlement_amount,
            payment_method,
            payment_account_id,
            notes: 'Full and final settlement',
        }, userId);

        // Update settlement type
        await this.db('loan_payments')
            .where({ id: payment.id })
            .update({ settlement_type: 'early_settlement' });

        // Mark loan as paid off
        await this.db('loans')
            .where({ id: loanId })
            .update({ 
                status: 'paid_off',
                updated_at: new Date()
            });

        return {
            success: true,
            settlement,
            payment,
            message: 'Loan fully settled and marked as paid off'
        };
    }
}

module.exports = LoanService;
