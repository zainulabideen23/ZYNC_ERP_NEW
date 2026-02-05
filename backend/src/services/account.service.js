const { AppError } = require('../middleware/errorHandler');

class AccountService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a new account
     */
    async create(data, userId) {
        const { code, name, group_id, account_type, opening_balance = 0, notes } = data;

        // Verify group exists
        const group = await this.db('account_groups').where('id', group_id).first();
        if (!group) throw new AppError('Account group not found', 404);

        const [account] = await this.db('accounts').insert({
            code,
            name,
            group_id,
            account_type,
            opening_balance,
            current_balance: opening_balance,
            notes,
            created_by: userId
        }).returning('*');

        return account;
    }

    /**
     * Get account with current balance
     */
    async getById(id) {
        const account = await this.db('accounts as a')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .select('a.*', 'g.name as group_name')
            .where('a.id', id)
            .first();

        if (!account) throw new AppError('Account not found', 404);

        return account;
    }

    /**
     * List accounts by group
     */
    async listGroupsWithAccounts() {
        const groups = await this.db('account_groups').orderBy('sequence_order').orderBy('name');
        const accounts = await this.db('accounts').where('is_active', true).orderBy('code');

        return groups.map(group => ({
            ...group,
            accounts: accounts.filter(a => a.group_id === group.id)
        }));
    }

    /**
     * Get Trial Balance
     */
    async getTrialBalance(asOfDate = new Date()) {
        const accounts = await this.db('accounts as a')
            .leftJoin('ledger_entries as le', 'a.id', 'le.account_id')
            .leftJoin('journals as j', 'le.journal_id', 'j.id')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .select(
                'a.id',
                'a.code',
                'a.name',
                'a.account_type',
                'a.opening_balance',
                'g.name as group_name',
                this.db.raw('SUM(CASE WHEN le.entry_type = \'debit\' AND (j.journal_date IS NULL OR j.journal_date <= ?) THEN le.amount ELSE 0 END) as total_debit', [asOfDate]),
                this.db.raw('SUM(CASE WHEN le.entry_type = \'credit\' AND (j.journal_date IS NULL OR j.journal_date <= ?) THEN le.amount ELSE 0 END) as total_credit', [asOfDate])
            )
            .where('a.is_active', true)
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'a.opening_balance', 'g.name')
            .orderBy('a.code');

        let totalDebits = 0;
        let totalCredits = 0;

        const processedAccounts = accounts.map(acc => {
            const debits = parseFloat(acc.total_debit) || 0;
            const credits = parseFloat(acc.total_credit) || 0;
            const opening = parseFloat(acc.opening_balance) || 0;

            let closingBalance = 0;
            // Asset & Expense: Opening + Debit - Credit
            if (['asset', 'expense'].includes(acc.account_type)) {
                closingBalance = opening + debits - credits;
            } else {
                // Liability, Equity, Income: Opening + Credit - Debit
                closingBalance = opening + credits - debits;
            }

            // For trial balance, show debit or credit balance based on type
            let trialDebit = 0;
            let trialCredit = 0;
            if (['asset', 'expense'].includes(acc.account_type)) {
                if (closingBalance >= 0) trialDebit = closingBalance;
                else trialCredit = Math.abs(closingBalance);
            } else {
                if (closingBalance >= 0) trialCredit = closingBalance;
                else trialDebit = Math.abs(closingBalance);
            }

            totalDebits += trialDebit;
            totalCredits += trialCredit;

            return {
                ...acc,
                debits: trialDebit,
                credits: trialCredit,
                closing_balance: closingBalance
            };
        });

        return {
            accounts: processedAccounts,
            totals: { debits: totalDebits, credits: totalCredits },
            is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
        };
    }
}

module.exports = AccountService;
