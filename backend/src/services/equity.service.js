const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');
const LedgerService = require('./ledger.service');

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const PAYMENT_METHODS = new Set(['cash', 'bank_transfer', 'cheque']);

class EquityService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.ledgerService = new LedgerService(db, tenantId);
    }

    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.OWNER_CAPITAL,
            SYSTEM_ACCOUNTS.RETAINED_EARNINGS,
            SYSTEM_ACCOUNTS.OWNER_DRAWINGS,
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
        ]);

        return {
            owner_capital: accountIds[SYSTEM_ACCOUNTS.OWNER_CAPITAL],
            retained_earnings: accountIds[SYSTEM_ACCOUNTS.RETAINED_EARNINGS],
            owner_drawings: accountIds[SYSTEM_ACCOUNTS.OWNER_DRAWINGS],
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
        };
    }

    async resolvePaymentAccountId(trx, { paymentMethod = 'cash', paymentAccountId = null } = {}) {
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

    async recordCapitalContribution(data, userId) {
        const {
            amount,
            transaction_date,
            payment_method = 'cash',
            payment_account_id,
            reference_number,
            notes
        } = data;

        const numericAmount = Number(amount || 0);
        if (!numericAmount || numericAmount <= 0) {
            throw new AppError('Amount must be a positive number', 400);
        }

        if (!transaction_date) {
            throw new AppError('Transaction date is required', 400);
        }

        return this.db.transaction(async (trx) => {
            const accounts = await this.getRequiredAccounts(trx);

            const paymentAccountId = await this.resolvePaymentAccountId(trx, {
                paymentMethod: payment_method,
                paymentAccountId: payment_account_id,
            });

            await validateAccountTypes(trx, this.tenantId, [
                { accountId: paymentAccountId, allowedTypes: ['asset'], label: 'Payment account' },
                { accountId: accounts.owner_capital, allowedTypes: ['equity'], label: 'Owner capital account' },
            ]);

            // Journal Entry:
            // Dr Cash/Bank (increases asset)
            // Cr Owner Capital (increases equity)
            await this.ledgerService.createJournalEntry({
                journal_date: transaction_date,
                transaction_type: 'journal',
                narration: `Capital Contribution - ${reference_number || 'Investment'}`,
                entries: [
                    {
                        account_id: paymentAccountId,
                        entry_type: 'debit',
                        amount: numericAmount,
                        narration: 'Capital invested in business',
                    },
                    {
                        account_id: accounts.owner_capital,
                        entry_type: 'credit',
                        amount: numericAmount,
                        narration: `Capital contribution by owner`,
                    },
                ],
                created_by: userId,
            }, trx);

            // Update Owner Capital current_balance (credit increases equity)
            await trx('accounts')
                .where({ id: accounts.owner_capital, tenant_id: this.tenantId })
                .increment('current_balance', numericAmount);

            await trx('accounts')
                .where({ id: paymentAccountId, tenant_id: this.tenantId })
                .increment('current_balance', numericAmount);

            return {
                success: true,
                message: `Capital contribution of Rs. ${numericAmount.toLocaleString()} recorded`,
                amount: numericAmount,
            };
        });
    }

    async recordOwnerDrawing(data, userId) {
        const {
            amount,
            transaction_date,
            payment_method = 'cash',
            payment_account_id,
            reference_number,
            notes
        } = data;

        const numericAmount = Number(amount || 0);
        if (!numericAmount || numericAmount <= 0) {
            throw new AppError('Amount must be a positive number', 400);
        }

        if (!transaction_date) {
            throw new AppError('Transaction date is required', 400);
        }

        // Check if owner has sufficient capital
        const capitalAccount = await this.db('accounts')
            .where({ tenant_id: this.tenantId, code: '3001', is_active: true })
            .first();

        if (capitalAccount && Number(capitalAccount.current_balance || 0) < numericAmount) {
            throw new AppError('Insufficient capital balance for this withdrawal', 400);
        }

        return this.db.transaction(async (trx) => {
            const accounts = await this.getRequiredAccounts(trx);

            const paymentAccountId = await this.resolvePaymentAccountId(trx, {
                paymentMethod: payment_method,
                paymentAccountId: payment_account_id,
            });

            await validateAccountTypes(trx, this.tenantId, [
                { accountId: paymentAccountId, allowedTypes: ['asset'], label: 'Payment account' },
                { accountId: accounts.owner_drawings, allowedTypes: ['equity'], label: 'Owner drawings account' },
            ]);

            await this.ensureSufficientPaymentBalance(trx, paymentAccountId, numericAmount);

            // Journal Entry:
            // Dr Owner Drawings (increases debit balance, reduces equity)
            // Cr Cash/Bank (decreases asset)
            await this.ledgerService.createJournalEntry({
                journal_date: transaction_date,
                transaction_type: 'journal',
                narration: `Owner Drawing - ${reference_number || 'Withdrawal'}`,
                entries: [
                    {
                        account_id: accounts.owner_drawings,
                        entry_type: 'debit',
                        amount: numericAmount,
                        narration: 'Owner withdrawal',
                    },
                    {
                        account_id: paymentAccountId,
                        entry_type: 'credit',
                        amount: numericAmount,
                        narration: 'Cash withdrawn by owner',
                    },
                ],
                created_by: userId,
            }, trx);

            // Update Owner Drawings current_balance (debit increases)
            await trx('accounts')
                .where({ id: accounts.owner_drawings, tenant_id: this.tenantId })
                .increment('current_balance', numericAmount);

            await trx('accounts')
                .where({ id: paymentAccountId, tenant_id: this.tenantId })
                .decrement('current_balance', numericAmount);

            return {
                success: true,
                message: `Owner drawing of Rs. ${numericAmount.toLocaleString()} recorded`,
                amount: numericAmount,
            };
        });
    }

    async getEquitySummary() {
        const equityAccounts = await this.db('accounts')
            .where({ tenant_id: this.tenantId, account_type: 'equity', is_active: true })
            .orderBy('code');

        const summary = {
            accounts: [],
            total_equity: 0,
        };

        for (const account of equityAccounts) {
            const balance = Number(account.current_balance || 0);
            
            // For equity accounts: credit balance is positive, debit is negative
            // Owner Drawings (3003) normally has debit balance which reduces equity
            let effectiveBalance = balance;
            if (account.code === '3003' && balance > 0) {
                effectiveBalance = -balance; // Drawings reduce equity
            }

            summary.accounts.push({
                id: account.id,
                code: account.code,
                name: account.name,
                current_balance: balance,
                effective_balance: effectiveBalance,
            });
            summary.total_equity += effectiveBalance;
        }

        // Add net income from P&L
        const currentYearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const ReportService = require('./report.service');
        const reportService = new ReportService(this.db, this.tenantId);
        
        try {
            const pnl = await reportService.getProfitAndLoss(currentYearStart, new Date().toISOString().split('T')[0]);
            summary.current_period_income = pnl.net_profit;
            summary.total_equity += pnl.net_profit;
        } catch (e) {
            summary.current_period_income = 0;
        }

        return summary;
    }

    async getEquityTransactions(params = {}) {
        const { page = 1, limit = 50 } = params;
        const offset = (page - 1) * limit;

        // Get ledger entries for equity accounts.
        const equityAccounts = await this.db('accounts')
            .where({ tenant_id: this.tenantId, account_type: 'equity', is_active: true })
            .pluck('id');

        if (equityAccounts.length === 0) {
            return {
                transactions: [],
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                },
            };
        }

        const transactions = await this.db('ledger_entries as le')
            .leftJoin('journals as j', function joinJournals() {
                this.on('le.journal_id', '=', 'j.id')
                    .andOn('le.tenant_id', '=', 'j.tenant_id');
            })
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('le.account_id', '=', 'a.id')
                    .andOn('le.tenant_id', '=', 'a.tenant_id');
            })
            .whereIn('le.account_id', equityAccounts)
            .where('le.tenant_id', this.tenantId)
            .select(
                'le.id',
                'le.journal_id',
                'le.account_id',
                'le.entry_type',
                'le.amount',
                'le.description as narration',
                'j.journal_date',
                'j.reference_type as transaction_type',
                'j.reference_type',
                'a.code as account_code',
                'a.name as account_name'
            )
            .orderBy('j.journal_date', 'desc')
            .orderBy('le.created_at', 'desc')
            .limit(limit)
            .offset(offset);

        return {
            transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
            },
        };
    }

    async closeYear(fiscalYearEnd, userId) {
        const yearEndDate = fiscalYearEnd || new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split('T')[0];

        return this.db.transaction(async (trx) => {
            const accounts = await this.getRequiredAccounts(trx);

            const nominalAccounts = await trx('accounts')
                .where({ tenant_id: this.tenantId, is_active: true })
                .whereIn('account_type', ['income', 'expense'])
                .select('id', 'code', 'name', 'account_type', 'current_balance');

            const entries = [];
            let totalDebits = 0;
            let totalCredits = 0;

            for (const acc of nominalAccounts) {
                const balance = roundCurrency(acc.current_balance);
                if (Math.abs(balance) < 0.01) continue;

                const entryType = acc.account_type === 'income'
                    ? (balance > 0 ? 'debit' : 'credit')
                    : (balance > 0 ? 'credit' : 'debit');
                const amount = Math.abs(balance);

                if (entryType === 'debit') totalDebits += amount;
                if (entryType === 'credit') totalCredits += amount;

                entries.push({
                    account_id: acc.id,
                    entry_type: entryType,
                    amount,
                    narration: `Close ${acc.name} for year ${yearEndDate}`,
                });
            }

            const netIncome = roundCurrency(totalDebits - totalCredits);

            if (entries.length === 0) {
                return { success: true, message: 'No net income/loss to close', net_income: 0 };
            }

            if (netIncome > 0) {
                entries.push({
                    account_id: accounts.retained_earnings,
                    entry_type: 'credit',
                    amount: netIncome,
                    narration: `Year-end close: Net Profit ${yearEndDate}`,
                });
            } else if (netIncome < 0) {
                // Loss - debit retained earnings
                entries.push({
                    account_id: accounts.retained_earnings,
                    entry_type: 'debit',
                    amount: Math.abs(netIncome),
                    narration: `Year-end close: Net Loss ${yearEndDate}`,
                });
            }

            // Create the closing journal entry
            await this.ledgerService.createJournalEntry({
                journal_date: yearEndDate,
                transaction_type: 'journal',
                reference_type: 'year_close',
                narration: `Year-End Closing Entries ${yearEndDate}`,
                entries: entries,
                created_by: userId,
            }, trx);

            // Update retained earnings balance
            if (netIncome > 0) {
                await trx('accounts')
                    .where({ id: accounts.retained_earnings })
                    .increment('current_balance', netIncome);
            } else {
                await trx('accounts')
                    .where({ id: accounts.retained_earnings })
                    .decrement('current_balance', Math.abs(netIncome));
            }

            // Reset income and expense accounts to zero
            for (const acc of nominalAccounts) {
                await trx('accounts')
                    .where({ id: acc.id, tenant_id: this.tenantId })
                    .update({ current_balance: 0, updated_at: trx.fn.now() });
            }

            return {
                success: true,
                message: `Year-end closing completed. ${netIncome >= 0 ? 'Profit' : 'Loss'}: Rs. ${Math.abs(netIncome).toLocaleString()}`,
                net_income: netIncome,
                closed_on: yearEndDate,
            };
        });
    }
}

module.exports = EquityService;
