const { v4: uuidv4 } = require('uuid');
const LedgerService = require('./ledger.service');

class ExpenseService {
    constructor(db) {
        this.db = db;
        this.ledgerService = new LedgerService(db);
    }

    async createExpense(data) {
        const { expense_date, category_id, amount, payment_method, bank_account_id, description, created_by } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Generate Expense Number
            const expenseNumber = await this.generateExpenseNumber(trx);

            // 2. Validate Category
            const category = await trx('expense_categories').where('id', category_id).first();
            if (!category) throw new Error('Invalid expense category');

            // 3. Create Expense Record
            const [expense] = await trx('expenses')
                .insert({
                    expense_number: expenseNumber,
                    expense_date,
                    category_id,
                    amount,
                    payment_method,
                    bank_account_id: bank_account_id || null, // If paying by bank
                    description,
                    created_by
                })
                .returning('*');

            // 4. Ledger Entries
            const paymentAccountId = bank_account_id || await this.getAccountId('1001', trx); // Bank or Cash (1001)
            const expenseAccountId = category.account_id || await this.getAccountId('5002', trx); // Default Expense

            const [journal] = await trx('journals')
                .insert({
                    journal_date: expense_date,
                    journal_type: 'expense',
                    narration: `Expense: ${description || category.name}`,
                    created_by
                })
                .returning('*');

            // Debit Expense (Increase Expense)
            await this.ledgerService.createEntry({
                entry_date: expense_date,
                account_id: expenseAccountId,
                entry_type: 'debit',
                amount: amount,
                reference_type: 'expense',
                reference_id: expense.id,
                narration: `Expense - ${category.name}`,
                journal_id: journal.id,
                created_by
            }, trx);

            // Credit Cash/Bank (Decrease Asset)
            await this.ledgerService.createEntry({
                entry_date: expense_date,
                account_id: paymentAccountId,
                entry_type: 'credit',
                amount: amount,
                reference_type: 'expense',
                reference_id: expense.id,
                narration: `Payment for ${expenseNumber}`,
                journal_id: journal.id,
                created_by
            }, trx);

            // 5. Create Payment Record (for completeness)
            await trx('payments').insert({
                payment_type: 'payment',
                payment_method,
                reference_type: 'expense',
                reference_id: expense.id,
                amount,
                payment_date: expense_date,
                bank_account_id: bank_account_id || null,
                notes: description,
                created_by
            });

            return expense;
        });
    }

    async getExpenses(filters) {
        const { page = 1, limit = 50, from_date, to_date, category_id } = filters;
        const offset = (page - 1) * limit;

        const query = this.db('expenses as e')
            .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
            .leftJoin('users as u', 'e.created_by', 'u.id')
            .select('e.*', 'ec.name as category_name', 'u.full_name as created_by_name');

        if (from_date) query.where('e.expense_date', '>=', from_date);
        if (to_date) query.where('e.expense_date', '<=', to_date);
        if (category_id) query.where('e.category_id', category_id);

        const countQuery = this.db('expenses');
        if (from_date) countQuery.where('expense_date', '>=', from_date);
        if (to_date) countQuery.where('expense_date', '<=', to_date);
        if (category_id) countQuery.where('category_id', category_id);

        const [{ count }] = await countQuery.count();
        const expenses = await query.orderBy('e.expense_date', 'desc').limit(limit).offset(offset);

        return {
            data: expenses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(count),
                pages: Math.ceil(count / limit)
            }
        };
    }

    async createCategory(data) {
        const { name, account_id } = data;

        // If no account_id provided, create a new sub-account under 'Operating Expenses' (5200...)
        // or usage existing one. 
        // Ideally, creating a category triggers creating an Account in Chart of Accounts.

        return await this.db.transaction(async (trx) => {
            let finalAccountId = account_id;

            if (!finalAccountId) {
                // Find Operating Expenses Group
                const group = await trx('account_groups').where('name', 'Operating Expenses').first();
                if (group) {
                    // Create new account
                    const existingAccounts = await trx('accounts').where('group_id', group.id);
                    // Simple logic for code generation: find max code or append
                    // We assume user provides account_id OR we map to a generic one?
                    // Let's force mapping to 'General Expense' for now if specific not provided 
                    // OR simple create logic. 
                    // For simplicity: Map to 'Miscellaneous Expenses' (create if not exists) 
                    // or require account_id.

                    // Better: Create Expense Category WITHOUT account, default to General Expense?
                    // No, ledger needs account.

                    // Let's implement: Create Account if not exists.
                    // But that requires code generation for account '5201', '5202' etc.
                    // Let's skip auto-account creation for now and check if we can pick one.
                    // We'll use a default if not provided.

                    const defaultAcc = await trx('accounts').where('code', '5002').first(); // Misc Expense?
                    finalAccountId = defaultAcc?.id;
                }
            }

            const [category] = await trx('expense_categories')
                .insert({ name, account_id: finalAccountId })
                .returning('*');
            return category;
        });
    }

    async getCategories() {
        return await this.db('expense_categories').select('*').where('is_active', true);
    }

    async generateExpenseNumber(trx) {
        const sequence = await trx('sequences').where('name', 'expense').first();
        const newValue = (sequence?.current_value || 0) + 1;

        if (sequence) {
            await trx('sequences').where('name', 'expense').update({ current_value: newValue });
        }

        const prefix = sequence?.prefix || 'EXP-';
        const padLength = sequence?.pad_length || 6;
        return prefix + String(newValue).padStart(padLength, '0');
    }

    async getAccountId(code, trx) {
        const account = await trx('accounts').where('code', code).first();
        return account?.id;
    }
}

module.exports = ExpenseService;
