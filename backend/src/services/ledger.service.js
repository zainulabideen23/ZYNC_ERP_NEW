const { AppError } = require('../middleware/errorHandler');

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
                entry_type, // 'debit' or 'credit'
                amount,
                reference_type: reference_type || 'journal',
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
        // Retry loop for unique constraint violations
        let attempts = 0;
        const maxAttempts = 3;
        const { journal_date, transaction_type, narration, entries, created_by } = data;

        while (attempts < maxAttempts) {
            try {
                return await this.db.transaction(async (trx) => {
                    const query = trx;
                    // Validate balance
                    const totalDebits = entries
                        .filter(e => e.entry_type === 'debit')
                        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

                    const totalCredits = entries
                        .filter(e => e.entry_type === 'credit')
                        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

                    if (Math.abs(totalDebits - totalCredits) > 0.001) {
                        throw new AppError(`Journal entry not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`, 400);
                    }

                    // Create journal
                    const journalNumber = await this.generateJournalNumber(query);
                    const [journal] = await query('journals')
                        .insert({
                            journal_number: journalNumber,
                            journal_date,
                            reference_type: transaction_type || 'journal',
                            description: narration,
                            total_debit: totalDebits,
                            total_credit: totalCredits,
                            is_balanced: true,
                            created_by
                        })
                        .returning('*');

                    // Create ledger entries
                    for (const entry of entries) {
                        await query('ledger_entries').insert({
                            journal_id: journal.id,
                            account_id: entry.account_id,
                            entry_type: entry.entry_type,
                            amount: entry.amount,
                            description: entry.narration || narration,
                            created_by
                        });

                        // Update account's current balance
                        await this.updateAccountBalance(entry.account_id, entry.entry_type, entry.amount, query);
                    }

                    return journal;
                });
            } catch (error) {
                if (error.code === '23505' && error.constraint === 'journals_journal_number_key') {
                    attempts++;
                    console.warn(`Duplicate journal number detected. Retrying attempt ${attempts}/${maxAttempts}...`);
                    try {
                        const maxResult = await this.db.raw(`SELECT COALESCE(MAX(CAST(REPLACE(journal_number, 'JV-', '') AS INTEGER)), 0) as max_num FROM journals`);
                        const maxNum = maxResult.rows[0].max_num;
                        // Update sequence
                        await this.db('sequences').where('name', 'journal').update({ current_value: maxNum });
                    } catch (syncError) {
                        console.error('Failed to sync sequence:', syncError);
                    }
                    if (attempts === maxAttempts) throw new AppError('Failed to generate unique journal number', 500);
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Generate next Journal Number
     */
    async generateJournalNumber(trx) {
        const sequence = await trx('sequences').where('name', 'journal').forUpdate().first();
        if (!sequence) throw new AppError('Journal sequence not found', 500);

        const nextVal = parseInt(sequence.current_value) + 1;
        await trx('sequences').where('name', 'journal').update({ current_value: nextVal });

        return `${sequence.prefix}${nextVal.toString().padStart(sequence.pad_length, '0')}`;
    }

    /**
     * Update account's current balance
     */
    async updateAccountBalance(accountId, entryType, amount, trx = null) {
        const query = trx || this.db;
        const account = await query('accounts').where('id', accountId).first();

        if (!account) throw new AppError(`Account not found: ${accountId}`, 404);

        let newBalance = parseFloat(account.current_balance);
        const amt = parseFloat(amount);

        // Account Types: asset, liability, equity, income, expense
        // Asset & Expense: Debit increases (+), Credit decreases (-)
        // Liability, Equity, Income: Credit increases (+), Debit decreases (-)
        if (['asset', 'expense'].includes(account.account_type)) {
            newBalance = entryType === 'debit' ? newBalance + amt : newBalance - amt;
        } else {
            newBalance = entryType === 'credit' ? newBalance + amt : newBalance - amt;
        }

        await query('accounts')
            .where('id', accountId)
            .update({
                current_balance: newBalance,
                updated_at: new Date()
            });
    }

    /**
     * Get account ledger items with running balance
     */
    async getAccountLedger(accountId, options = {}) {
        const { from_date, to_date } = options;

        const account = await this.db('accounts').where('id', accountId).first();
        if (!account) throw new AppError('Account not found', 404);

        let query = this.db('ledger_entries')
            .where('account_id', accountId)
            .orderBy('entry_date', 'asc')
            .orderBy('created_at', 'asc');

        if (from_date) query = query.where('entry_date', '>=', from_date);
        if (to_date) query = query.where('entry_date', '<=', to_date);

        const entries = await query;

        // Calculate opening balance for the period
        let runningBalance = parseFloat(account.opening_balance);
        if (from_date) {
            const beforeEntries = await this.db('ledger_entries')
                .where('account_id', accountId)
                .where('entry_date', '<', from_date)
                .select('entry_type', 'amount');

            for (const entry of beforeEntries) {
                const amt = parseFloat(entry.amount);
                if (['asset', 'expense'].includes(account.account_type)) {
                    runningBalance = entry.entry_type === 'debit' ? runningBalance + amt : runningBalance - amt;
                } else {
                    runningBalance = entry.entry_type === 'credit' ? runningBalance + amt : runningBalance - amt;
                }
            }
        }

        const openingBalance = runningBalance;
        const ledger = entries.map(entry => {
            const amt = parseFloat(entry.amount);
            if (['asset', 'expense'].includes(account.account_type)) {
                runningBalance = entry.entry_type === 'debit' ? runningBalance + amt : runningBalance - amt;
            } else {
                runningBalance = entry.entry_type === 'credit' ? runningBalance + amt : runningBalance - amt;
            }
            return { ...entry, running_balance: runningBalance };
        });

        return {
            account,
            opening_balance: openingBalance,
            closing_balance: runningBalance,
            entries: ledger
        };
    }

    /**
     * Get Trial Balance
     */
    async getTrialBalance(asOfDate = null) {
        let query = this.db('accounts as a')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .select(
                'a.id',
                'a.code',
                'a.name',
                'a.account_type',
                'a.opening_balance',
                'a.current_balance',
                'g.name as group_name'
            )
            .where('a.is_active', true)
            .orderBy('a.code');

        const accounts = await query;

        let totalDebit = 0;
        let totalCredit = 0;

        const report = accounts.map(acc => {
            const balance = parseFloat(acc.current_balance);
            let debit = 0;
            let credit = 0;

            if (['asset', 'expense'].includes(acc.account_type)) {
                if (balance >= 0) debit = balance;
                else credit = Math.abs(balance);
            } else {
                if (balance >= 0) credit = balance;
                else debit = Math.abs(balance);
            }

            totalDebit += debit;
            totalCredit += credit;

            return {
                ...acc,
                debit,
                credit
            };
        });

        return {
            date: asOfDate || new Date(),
            accounts: report,
            totals: {
                debit: totalDebit,
                credit: totalCredit
            },
            is_balanced: Math.abs(totalDebit - totalCredit) < 0.01
        };
    }
}

module.exports = LedgerService;

