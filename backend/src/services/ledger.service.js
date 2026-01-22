class LedgerService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a ledger entry
     * All accounting entries MUST go through this method
     */
    async createEntry(data, trx = null) {
        const query = trx || this.db;
        const { entry_date, account_id, entry_type, amount, reference_type, reference_id, narration, journal_id, created_by } = data;

        const [entry] = await query('ledger_entries')
            .insert({
                entry_date,
                account_id,
                entry_type,
                amount,
                reference_type,
                reference_id,
                narration,
                journal_id,
                created_by
            })
            .returning('*');

        // Update account's current balance
        await this.updateAccountBalance(account_id, entry_type, amount, query);

        return entry;
    }

    /**
     * Create a balanced journal entry
     * Ensures debits = credits
     */
    async createJournalEntry(data, trx = null) {
        const query = trx || this.db;
        const { journal_date, journal_type, narration, entries, created_by } = data;

        // Validate balance
        const totalDebits = entries
            .filter(e => e.entry_type === 'debit')
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);

        const totalCredits = entries
            .filter(e => e.entry_type === 'credit')
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            throw new Error(`Journal entry not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`);
        }

        // Create journal
        const [journal] = await query('journals')
            .insert({
                journal_date,
                journal_type,
                narration,
                created_by
            })
            .returning('*');

        // Create ledger entries
        for (const entry of entries) {
            await this.createEntry({
                entry_date: journal_date,
                account_id: entry.account_id,
                entry_type: entry.entry_type,
                amount: entry.amount,
                reference_type: 'journal',
                reference_id: journal.id,
                narration: entry.narration || narration,
                journal_id: journal.id,
                created_by
            }, query);
        }

        return journal;
    }

    /**
     * Update account's current balance (cached for performance)
     */
    async updateAccountBalance(accountId, entryType, amount, trx = null) {
        const query = trx || this.db;
        const account = await query('accounts').where('id', accountId).first();

        if (!account) return;

        let newBalance = parseFloat(account.current_balance);

        // For Asset and Expense accounts: Debit increases, Credit decreases
        // For Liability, Capital, and Income accounts: Credit increases, Debit decreases
        if (['asset', 'expense'].includes(account.account_type)) {
            newBalance = entryType === 'debit'
                ? newBalance + parseFloat(amount)
                : newBalance - parseFloat(amount);
        } else {
            newBalance = entryType === 'credit'
                ? newBalance + parseFloat(amount)
                : newBalance - parseFloat(amount);
        }

        await query('accounts')
            .where('id', accountId)
            .update({ current_balance: newBalance });
    }

    /**
     * Get account balance as of a date
     */
    async getAccountBalance(accountId, asOfDate = null, trx = null) {
        const query = trx || this.db;

        let ledgerQuery = query('ledger_entries')
            .where('account_id', accountId)
            .select(
                query.raw('SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END) as debits'),
                query.raw('SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END) as credits')
            );

        if (asOfDate) {
            ledgerQuery = ledgerQuery.where('entry_date', '<=', asOfDate);
        }

        const result = await ledgerQuery.first();
        const account = await query('accounts').where('id', accountId).first();

        const debits = parseFloat(result.debits) || 0;
        const credits = parseFloat(result.credits) || 0;
        const opening = parseFloat(account?.opening_balance) || 0;

        // Calculate balance based on account type
        let balance;
        if (['asset', 'expense'].includes(account?.account_type)) {
            balance = opening + debits - credits;
        } else {
            balance = opening + credits - debits;
        }

        return {
            account_id: accountId,
            opening_balance: opening,
            total_debits: debits,
            total_credits: credits,
            closing_balance: balance
        };
    }

    /**
     * Get Trial Balance
     */
    async getTrialBalance(asOfDate = null, trx = null) {
        const query = trx || this.db;

        let ledgerQuery = query('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .select(
                'a.id',
                'a.code',
                'a.name',
                'a.account_type',
                'a.opening_balance',
                'g.name as group_name',
                query.raw('SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) as debits'),
                query.raw('SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) as credits')
            )
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'a.opening_balance', 'g.name')
            .orderBy('a.code');

        if (asOfDate) {
            ledgerQuery = ledgerQuery.where('le.entry_date', '<=', asOfDate);
        }

        const accounts = await ledgerQuery;

        // Calculate balances
        const result = accounts.map(acc => {
            const debits = parseFloat(acc.debits) || 0;
            const credits = parseFloat(acc.credits) || 0;
            const opening = parseFloat(acc.opening_balance) || 0;

            let balance;
            if (['asset', 'expense'].includes(acc.account_type)) {
                balance = opening + debits - credits;
            } else {
                balance = opening + credits - debits;
            }

            return {
                ...acc,
                balance,
                debit_balance: balance > 0 ? Math.abs(balance) : 0,
                credit_balance: balance < 0 ? Math.abs(balance) : 0
            };
        });

        const totals = result.reduce((sum, acc) => ({
            debit_balance: sum.debit_balance + acc.debit_balance,
            credit_balance: sum.credit_balance + acc.credit_balance
        }), { debit_balance: 0, credit_balance: 0 });

        return {
            accounts: result,
            totals,
            is_balanced: Math.abs(totals.debit_balance - totals.credit_balance) < 0.01
        };
    }
}

module.exports = LedgerService;
