const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');

class ExpenseService {
    constructor(db, ledgerService, tenantId) {
        this.db = db;
        this.ledgerService = ledgerService;
        this.tenantId = tenantId;
    }

    /**
     * Create a new expense
     */
    async create(data, userId) {
        const {
            expense_date,
            category_id,
            amount,
            tax_amount = 0,
            payment_method,
            payment_account_id,
            reference_number,
            notes
        } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Generate Expense Number
            const expenseNumber = await this.generateExpenseNumber(trx);

            // 2. Validate Category and Accounts
            const category = await trx('expense_categories')
                .where({ id: category_id, tenant_id: this.tenantId, is_active: true })
                .first();
            if (!category) throw new AppError('Invalid expense category', 400);

            const expenseAccount = category.account_id;
            if (!expenseAccount) throw new AppError('Expense category is not linked to a GL account', 500);

            const numericAmount = Number(amount);
            const numericTax = Number(tax_amount || 0);
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new AppError('Expense amount must be a valid positive number', 400);
            }
            if (!Number.isFinite(numericTax) || numericTax < 0) {
                throw new AppError('tax_amount must be a valid non-negative number', 400);
            }

            const accounts = await this.getRequiredAccounts(trx);
            const resolvedPaymentAccountId = payment_account_id ||
                (payment_method === 'cash' ? accounts.cash : accounts.bank);

            const paymentAccount = await trx('accounts')
                .where({ id: resolvedPaymentAccountId, tenant_id: this.tenantId, is_active: true })
                .first();

            if (!paymentAccount) {
                throw new AppError('Invalid payment account', 400);
            }

            const totalAmount = numericAmount + numericTax;

            // 3. Create Expense Record
            const [expense] = await trx('expenses').insert({
                expense_number: expenseNumber,
                expense_date: expense_date || new Date(),
                category_id,
                account_id: expenseAccount,
                payment_account_id: paymentAccount.id,
                amount: numericAmount,
                tax_amount: numericTax,
                total_amount: totalAmount,
                payment_method,
                reference_number,
                status: 'paid',
                notes,
                created_by: userId,
                tenant_id: this.tenantId
            }).returning('*');

            // 4. ACCOUNTING: Journal & Ledger Entries

            const accountTypeRules = [
                { accountId: expenseAccount, allowedTypes: ['expense'], label: 'Expense account' },
                { accountId: paymentAccount.id, allowedTypes: ['asset'], label: 'Payment account' },
            ];

            if (numericTax > 0) {
                accountTypeRules.push({ accountId: accounts.input_tax, allowedTypes: ['asset'], label: 'Input tax account' });
                accountTypeRules.push({ accountId: accounts.tax_payable, allowedTypes: ['liability'], label: 'Tax payable account' });
            }

            await validateAccountTypes(trx, this.tenantId, accountTypeRules);

            const journalEntries = [
                // Debit Expense (Increase Expense)
                { account_id: expenseAccount, entry_type: 'debit', amount: numericAmount, narration: `Expense: ${expenseNumber}` }
            ];

            // Input tax receivable (1203) with matching tax payable credit.
            if (numericTax > 0) {
                journalEntries.push({
                    account_id: accounts.input_tax,
                    entry_type: 'debit',
                    amount: numericTax,
                    narration: `Input Tax on ${expenseNumber}`,
                });
                journalEntries.push({
                    account_id: accounts.tax_payable,
                    entry_type: 'credit',
                    amount: numericTax,
                    narration: `Tax Payable on ${expenseNumber}`,
                });
                // Update current_balance for tax accounts
                await trx('accounts')
                    .where({ id: accounts.input_tax })
                    .increment('current_balance', numericTax);
                await trx('accounts')
                    .where({ id: accounts.tax_payable })
                    .increment('current_balance', numericTax);
            }

            // Credit Cash/Bank/Payable (Decrease Asset or Increase Liability)
            // Only credit for base amount (excluding tax), since tax is tracked separately via tax_payable
            journalEntries.push({
                account_id: paymentAccount.id,
                entry_type: 'credit',
                amount: numericAmount,  // Original amount without tax
                narration: `Payment for ${expenseNumber}`
            });

            await this.ledgerService.createJournalEntry({
                journal_date: expense.expense_date,
                transaction_type: 'expense',
                reference_type: 'expense',
                reference_id: expense.id,
                narration: `Expense ${expenseNumber} - ${category.name}`,
                entries: journalEntries,
                created_by: userId
            }, trx);

            return expense;
        });
    }

    /**
     * Generate next expense number
     */
    async generateExpenseNumber(trx) {
        const sequence = await trx('sequences').where({ name: 'expense', tenant_id: this.tenantId }).forUpdate().first();
        if (!sequence) throw new AppError('Expense sequence not found', 500);

        const nextVal = sequence.current_value + 1;
        await trx('sequences').where({ name: 'expense', tenant_id: this.tenantId }).update({ current_value: nextVal });

        return `${sequence.prefix}${nextVal.toString().padStart(sequence.pad_length || 6, '0')}`;
    }

    /**
     * Get system accounts
     */
    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
            SYSTEM_ACCOUNTS.INPUT_TAX_RECEIVABLE,
            SYSTEM_ACCOUNTS.TAX_PAYABLE,
        ]);

        return {
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
            input_tax: accountIds[SYSTEM_ACCOUNTS.INPUT_TAX_RECEIVABLE],
            tax_payable: accountIds[SYSTEM_ACCOUNTS.TAX_PAYABLE],
        };
    }

    /**
     * List expenses
     */
    async list(params) {
        const { page = 1, limit = 50, from_date, to_date, category_id } = params;
        const offset = (page - 1) * limit;


        let query = this.db('expenses as e')
            .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
            .select('e.*', 'ec.name as category_name')
            .where('e.is_deleted', false)
            .where('e.tenant_id', this.tenantId);

        if (from_date) query = query.where('e.expense_date', '>=', from_date);
        if (to_date) query = query.where('e.expense_date', '<=', to_date);
        if (category_id) query = query.where('e.category_id', category_id);

        const countQuery = this.db('expenses').where('is_deleted', false).where('tenant_id', this.tenantId);
        if (from_date) countQuery.where('expense_date', '>=', from_date);
        if (to_date) countQuery.where('expense_date', '<=', to_date);
        if (category_id) countQuery.where('category_id', category_id);

        const [{ count }] = await countQuery.count();
        const expenses = await query.orderBy('e.expense_date', 'desc').limit(limit).offset(offset);

        return {
            data: expenses,
            pagination: { page, limit, total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }
}

module.exports = ExpenseService;

