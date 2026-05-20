const { AppError } = require('../middleware/errorHandler');

const JOURNAL_BALANCE_TOLERANCE = 0.01;
const ZERO_LINE_TOLERANCE = 0.000001;

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

class LedgerService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
    }

    async previewJournal(entries) {
        if (!Array.isArray(entries) || entries.length < 2) {
            throw new AppError('Journal entry must contain at least two lines', 400);
        }

        const normalizedEntries = [];
        for (const entry of entries) {
            if (!entry.account_id) {
                throw new AppError('Each journal entry line requires account_id', 400);
            }
            if (!['debit', 'credit'].includes(entry.entry_type)) {
                throw new AppError(`Invalid entry_type: ${entry.entry_type}`, 400);
            }

            const numericAmount = Number(entry.amount);
            if (!Number.isFinite(numericAmount) || numericAmount < 0) {
                throw new AppError('Each journal entry line amount must be a valid non-negative number', 400);
            }

            if (numericAmount <= ZERO_LINE_TOLERANCE) {
                continue;
            }

            normalizedEntries.push({
                ...entry,
                amount: roundCurrency(numericAmount),
            });
        }

        if (normalizedEntries.length < 2) {
            throw new AppError('Journal entry must contain at least two non-zero lines', 400);
        }

        const totalDebits = roundCurrency(normalizedEntries
            .filter((entry) => entry.entry_type === 'debit')
            .reduce((sum, entry) => sum + Number(entry.amount), 0));
        const totalCredits = roundCurrency(normalizedEntries
            .filter((entry) => entry.entry_type === 'credit')
            .reduce((sum, entry) => sum + Number(entry.amount), 0));

        return {
            entries: normalizedEntries,
            total_debit: totalDebits,
            total_credit: totalCredits,
            is_balanced: Math.abs(totalDebits - totalCredits) <= JOURNAL_BALANCE_TOLERANCE,
        };
    }

    /**
     * Create a ledger entry
     * All accounting entries MUST go through this method
     */
    async createEntry(data, trx = null) {
        const query = trx || this.db;
        const { account_id, entry_type, amount, narration, journal_id, created_by } = data;

        if (!journal_id) {
            throw new AppError('journal_id is required for ledger entries', 400);
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new AppError('amount must be a positive number', 400);
        }

        const [entry] = await query('ledger_entries')
            .insert({
                account_id,
                entry_type,
                amount: roundCurrency(numericAmount),
                description: narration || null,
                journal_id,
                created_by,
                tenant_id: this.tenantId
            })
            .returning('*');

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
        const { journal_date, transaction_type, reference_type, reference_id, narration, entries, created_by } = data;

        const persistJournal = async (query) => {
            if (!Array.isArray(entries) || entries.length < 2) {
                throw new AppError('Journal entry must contain at least two lines', 400);
            }

            const normalizedEntries = [];

            for (const entry of entries) {
                if (!entry.account_id) {
                    throw new AppError('Each journal entry line requires account_id', 400);
                }
                if (!['debit', 'credit'].includes(entry.entry_type)) {
                    throw new AppError(`Invalid entry_type: ${entry.entry_type}`, 400);
                }
                const numericAmount = Number(entry.amount);
                if (!Number.isFinite(numericAmount)) {
                    throw new AppError('Each journal entry line amount must be a valid number', 400);
                }

                if (numericAmount < 0) {
                    throw new AppError('Each journal entry line amount must be zero or positive', 400);
                }

                // Ignore zero-value lines so callers can pass optional amounts safely.
                if (numericAmount <= ZERO_LINE_TOLERANCE) {
                    continue;
                }

                normalizedEntries.push({
                    ...entry,
                    amount: roundCurrency(numericAmount),
                });
            }

            if (normalizedEntries.length < 2) {
                throw new AppError('Journal entry must contain at least two non-zero lines', 400);
            }

            // Validate balance
            const totalDebits = roundCurrency(normalizedEntries
                .filter(e => e.entry_type === 'debit')
                .reduce((sum, e) => sum + Number(e.amount), 0));

            const totalCredits = roundCurrency(normalizedEntries
                .filter(e => e.entry_type === 'credit')
                .reduce((sum, e) => sum + Number(e.amount), 0));

            const balanceDifference = Math.abs(totalDebits - totalCredits);

            if (balanceDifference > JOURNAL_BALANCE_TOLERANCE) {
                throw new AppError(`Journal entry not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`, 400);
            }

            const resolvedReferenceType = reference_type || transaction_type || 'journal';

            // Create journal
            const journalNumber = await this.generateJournalNumber(query);
            const [journal] = await query('journals')
                .insert({
                    journal_number: journalNumber,
                    journal_date,
                    reference_type: resolvedReferenceType,
                    reference_id: reference_id || null,
                    description: narration,
                    total_debit: totalDebits,
                    total_credit: totalCredits,
                    is_balanced: balanceDifference <= JOURNAL_BALANCE_TOLERANCE,
                    created_by,
                    tenant_id: this.tenantId
                })
                .returning('*');

            // Create ledger entries
            for (const entry of normalizedEntries) {
                await query('ledger_entries').insert({
                    journal_id: journal.id,
                    account_id: entry.account_id,
                    entry_type: entry.entry_type,
                    amount: roundCurrency(entry.amount),
                    description: entry.narration || narration,
                    created_by,
                    tenant_id: this.tenantId
                });
            }

            return journal;
        };

        while (attempts < maxAttempts) {
            try {
                if (trx) {
                    return await persistJournal(trx);
                }

                return await this.db.transaction(async (innerTrx) => persistJournal(innerTrx));
            } catch (error) {
                const isJournalNumberConflict = error.code === '23505' && (
                    ['journals_journal_number_key', 'journals_tenant_journal_number_key', 'uq_journals_tenant_number'].includes(error.constraint) ||
                    /journal_number/i.test(error.detail || '')
                );

                if (isJournalNumberConflict) {
                    attempts++;
                    console.warn(`Duplicate journal number detected. Retrying attempt ${attempts}/${maxAttempts}...`);
                    try {
                        const syncQuery = trx || this.db;
                        await this.syncSequenceWithMaxValue('journal', 'journals', 'journal_number', syncQuery);
                    } catch (syncError) {
                        console.error('Failed to sync sequence:', syncError);
                    }
                    if (attempts === maxAttempts) throw new AppError('Failed to generate unique journal number', 500);
                    continue;
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
        const updated = await trx('sequences')
            .where({ name: 'journal', tenant_id: this.tenantId })
            .increment('current_value', 1)
            .returning(['current_value', 'prefix', 'pad_length']);

        const sequence = updated[0];
        if (!sequence) throw new AppError('Journal sequence not found', 500);

        const nextVal = parseInt(sequence.current_value, 10);
        const prefix = sequence.prefix || 'JRN-';
        const padLength = sequence.pad_length || 6;

        return `${prefix}${nextVal.toString().padStart(padLength, '0')}`;
    }

    /**
     * Update account's current balance
     */
    async updateAccountBalance(accountId, entryType, amount, trx = null) {
        const query = trx || this.db;
        const normalizedAmount = roundCurrency(Number(amount));
        if (!['debit', 'credit'].includes(entryType)) {
            throw new AppError(`Invalid entry type: ${entryType}`, 400);
        }
        if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
            throw new AppError('amount must be a valid non-negative number', 400);
        }

        const updatedRows = await query('accounts')
            .where({ id: accountId, tenant_id: this.tenantId })
            .update({
                current_balance: query.raw(
                    `
                        CASE
                            WHEN account_type IN ('asset', 'expense') THEN
                                CASE WHEN ? = 'debit' THEN current_balance + ? ELSE current_balance - ? END
                            ELSE
                                CASE WHEN ? = 'credit' THEN current_balance + ? ELSE current_balance - ? END
                        END
                    `,
                    [entryType, normalizedAmount, normalizedAmount, entryType, normalizedAmount, normalizedAmount]
                ),
                updated_at: query.fn.now(),
            })
            .returning('id');

        if (!updatedRows || updatedRows.length === 0) {
            throw new AppError(`Account not found: ${accountId}`, 404);
        }
    }

    /**
     * Sync a sequence current_value to the max numeric suffix present in table values.
     * Uses sequence prefix instead of hardcoded token parsing.
     */
    async syncSequenceWithMaxValue(sequenceName, tableName, numberColumn, trx = null) {
        const query = trx || this.db;
        const sequence = await query('sequences')
            .where({ name: sequenceName, tenant_id: this.tenantId })
            .first();

        if (!sequence) return;

        const prefix = sequence.prefix || '';
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchPattern = `^${escapedPrefix}[0-9]+$`;
        const stripPattern = `^${escapedPrefix}`;

        const rawResult = await query.raw(
            `
                SELECT COALESCE(
                    MAX(CAST(REGEXP_REPLACE(${numberColumn}, ?, '') AS INTEGER)),
                    0
                ) AS max_num
                FROM ${tableName}
                WHERE tenant_id = ?
                  AND ${numberColumn} ~ ?
            `,
            [stripPattern, this.tenantId, matchPattern]
        );

        const maxNum = Number(rawResult.rows?.[0]?.max_num || 0);
        if (maxNum > Number(sequence.current_value || 0)) {
            await query('sequences')
                .where({ name: sequenceName, tenant_id: this.tenantId })
                .update({ current_value: maxNum });
        }
    }

    /**
     * Get account ledger items with running balance
     */
    async getAccountLedger(accountId, options = {}) {
        const { from_date, to_date } = options;

        const account = await this.db('accounts').where('id', accountId).where('tenant_id', this.tenantId).first();
        if (!account) throw new AppError('Account not found', 404);

        let query = this.db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .where('le.account_id', accountId)
            .where('le.tenant_id', this.tenantId)
            .where('j.tenant_id', this.tenantId)
            .select('le.*', 'j.journal_date')
            .orderBy('j.journal_date', 'asc')
            .orderBy('le.created_at', 'asc');

        if (from_date) query = query.where('j.journal_date', '>=', from_date);
        if (to_date) query = query.where('j.journal_date', '<=', to_date);

        const entries = await query;

        // Calculate opening balance for the period
        let runningBalance = parseFloat(account.opening_balance);
        if (from_date) {
            const beforeEntries = await this.db('ledger_entries as le')
                .join('journals as j', 'le.journal_id', 'j.id')
                .where('le.account_id', accountId)
                .where('le.tenant_id', this.tenantId)
                .where('j.tenant_id', this.tenantId)
                .where('j.journal_date', '<=', from_date)
                .select('le.entry_type', 'le.amount');

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
            return { ...entry, entry_date: entry.journal_date, running_balance: runningBalance };
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
        const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];

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
            .where('a.tenant_id', this.tenantId)
            .orderBy('a.code');

        const accounts = await query;
        const balanceByAccount = new Map();

        const result = await this.db.raw(
            `
            SELECT
                le.account_id,
                COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS debit_total,
                COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS credit_total
            FROM ledger_entries le
            INNER JOIN journals j ON j.id = le.journal_id
            WHERE le.tenant_id = ?
              AND j.tenant_id = ?
              AND j.journal_date::date <= ?::date
            GROUP BY le.account_id
            `,
            [this.tenantId, this.tenantId, effectiveDate]
        );

        const movementMap = result.rows.reduce((acc, row) => {
            acc[row.account_id] = row;
            return acc;
        }, {});

        for (const acc of accounts) {
            const openingBalance = parseFloat(acc.opening_balance || 0);
            const movement = movementMap[acc.id] || { debit_total: 0, credit_total: 0 };
            const debitTotal = parseFloat(movement.debit_total || 0);
            const creditTotal = parseFloat(movement.credit_total || 0);

            const computedBalance = ['asset', 'expense'].includes(acc.account_type)
                ? openingBalance + debitTotal - creditTotal
                : openingBalance + creditTotal - debitTotal;

            balanceByAccount.set(acc.id, computedBalance);
        }

        let totalDebit = 0;
        let totalCredit = 0;

        const report = accounts.map(acc => {
            const balance = balanceByAccount.get(acc.id) || 0;
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
            date: effectiveDate,
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

