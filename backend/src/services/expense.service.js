const { AppError } = require('../middleware/errorHandler');

class ExpenseService {
    constructor(db, ledgerService) {
        this.db = db;
        this.ledgerService = ledgerService;
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
            const category = await trx('expense_categories').where('id', category_id).first();
            if (!category) throw new AppError('Invalid expense category', 400);

            const expenseAccount = category.account_id;
            if (!expenseAccount) throw new AppError('Expense category is not linked to a GL account', 500);

            const totalAmount = parseFloat(amount) + parseFloat(tax_amount);

            // 3. Create Expense Record
            const [expense] = await trx('expenses').insert({
                expense_number: expenseNumber,
                expense_date: expense_date || new Date(),
                category_id,
                account_id: expenseAccount,
                payment_account_id: payment_account_id,
                amount,
                tax_amount,
                total_amount: totalAmount,
                payment_method,
                reference_number,
                status: 'paid',
                notes,
                created_by: userId
            }).returning('*');

            // 4. ACCOUNTING: Journal & Ledger Entries
            const accounts = await this.getRequiredAccounts(trx);

            const journalEntries = [
                // Debit Expense (Increase Expense)
                { account_id: expenseAccount, entry_type: 'debit', amount, narration: `Expense: ${expenseNumber}` }
            ];

            // Handle Tax
            if (tax_amount > 0) {
                journalEntries.push({ account_id: accounts.tax_paid, entry_type: 'debit', amount: tax_amount, narration: `Tax on ${expenseNumber}` });
            }

            // Credit Cash/Bank/Payable (Decrease Asset or Increase Liability)
            journalEntries.push({
                account_id: payment_account_id,
                entry_type: 'credit',
                amount: totalAmount,
                narration: `Payment for ${expenseNumber}`
            });

            await this.ledgerService.createJournalEntry({
                journal_date: expense.expense_date,
                transaction_type: 'expense',
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
        const sequence = await trx('sequences').where('name', 'expense').forUpdate().first();
        if (!sequence) throw new AppError('Expense sequence not found', 500);

        const nextVal = sequence.current_value + 1;
        await trx('sequences').where('name', 'expense').update({ current_value: nextVal });

        return `${sequence.prefix}${nextVal.toString().padStart(sequence.pad_length || 6, '0')}`;
    }

    /**
     * Get system accounts
     */
    async getRequiredAccounts(trx) {
        const accounts = await trx('accounts').whereIn('code', ['2300', '1001']).select('id', 'code');
        const map = {};
        accounts.forEach(a => {
            if (a.code === '2300') map.tax_paid = a.id;
            if (a.code === '1001') map.cash = a.id;
        });
        return map;
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
            .where('e.is_deleted', false);

        if (from_date) query = query.where('e.expense_date', '>=', from_date);
        if (to_date) query = query.where('e.expense_date', '<=', to_date);
        if (category_id) query = query.where('e.category_id', category_id);

        const countQuery = this.db('expenses').where('is_deleted', false);
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

