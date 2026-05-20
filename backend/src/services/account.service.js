const { AppError } = require('../middleware/errorHandler');
const LedgerService = require('./ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

class AccountService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
    }

    /** Tenant-scoped query helper */
    tdb(table, trx = null) {
        return (trx || this.db)(table).where(`${table}.tenant_id`, this.tenantId);
    }

    /**
     * Create a new account
     */
    async create(data, userId) {
        const { code, name, group_id, account_type, opening_balance = 0, notes } = data;
        const numericOpeningBalance = Number(opening_balance || 0);

        if (!Number.isFinite(numericOpeningBalance)) {
            throw new AppError('opening_balance must be a valid number', 400);
        }

        // Verify group exists
        const group = await this.tdb('account_groups').where('id', group_id).first();
        if (!group) throw new AppError('Account group not found', 404);

        return this.db.transaction(async (trx) => {
            const [account] = await trx('accounts').insert({
                code,
                name,
                group_id,
                account_type,
                opening_balance: numericOpeningBalance,
                current_balance: numericOpeningBalance,
                notes,
                created_by: userId,
                tenant_id: this.tenantId
            }).returning('*');

            return account;
        });
    }

    async postOpeningBalances(accountsData, userId) {
        const ledgerService = new LedgerService(this.db, this.tenantId);

        return this.db.transaction(async (trx) => {
            const journalNumber = await this.generateJournalNumber(trx);
            const journalEntries = [];

            for (const account of accountsData) {
                const openingBalance = Number(account.opening_balance || 0);
                if (openingBalance === 0) continue;

                const isDebitNormal = ['asset', 'expense'].includes(account.account_type);
                const entryType = (isDebitNormal && openingBalance > 0) || (!isDebitNormal && openingBalance < 0)
                    ? 'debit'
                    : 'credit';

                journalEntries.push({
                    account_id: account.id,
                    entry_type: entryType,
                    amount: Math.abs(openingBalance),
                    description: `Opening Balance - ${account.name}`,
                });
            }

            if (journalEntries.length === 0) {
                return { success: true, message: 'No opening balances to post' };
            }

            let totalDebit = 0;
            let totalCredit = 0;
            for (const entry of journalEntries) {
                if (entry.entry_type === 'debit') totalDebit += entry.amount;
                else totalCredit += entry.amount;
            }

            const ownerCapital = await trx('accounts')
                .where({ tenant_id: this.tenantId, code: '3001', is_active: true })
                .first('id');

            if (!ownerCapital?.id) {
                throw new AppError('Owner Capital account not found', 500);
            }

            const difference = Number((totalDebit - totalCredit).toFixed(2));
            if (difference > 0) {
                journalEntries.push({ account_id: ownerCapital.id, entry_type: 'credit', amount: difference, description: 'Opening Balance Offset' });
                totalCredit += difference;
            } else if (difference < 0) {
                const adjustment = Math.abs(difference);
                journalEntries.push({ account_id: ownerCapital.id, entry_type: 'debit', amount: adjustment, description: 'Opening Balance Offset' });
                totalDebit += adjustment;
            }

            const [journal] = await trx('journals').insert({
                journal_number: journalNumber,
                journal_date: new Date(),
                transaction_type: 'opening',
                reference_type: 'opening',
                narration: 'Opening Balances',
                total_debit: totalDebit,
                total_credit: totalCredit,
                is_balanced: Math.abs(totalDebit - totalCredit) < 0.01,
                created_by: userId,
                tenant_id: this.tenantId,
            }).returning('*');

            for (const entry of journalEntries) {
                await trx('ledger_entries').insert({
                    journal_id: journal.id,
                    account_id: entry.account_id,
                    tenant_id: this.tenantId,
                    entry_type: entry.entry_type,
                    amount: entry.amount,
                    description: entry.description,
                    created_by: userId,
                });

                await ledgerService.updateAccountBalance(entry.account_id, entry.entry_type, entry.amount, trx);
            }

            return { success: true, journal_number: journalNumber };
        });
    }

    async generateJournalNumber(trx) {
        const prefix = 'JRN-';
        const sequence = await trx('sequences')
            .where({ name: 'journal', tenant_id: this.tenantId })
            .forUpdate()
            .first();

        if (!sequence) {
            await trx('sequences').insert({
                name: 'journal',
                prefix,
                current_value: 0,
                pad_length: 6,
                tenant_id: this.tenantId,
            });
            return `${prefix}000001`;
        }

        const nextVal = Number(sequence.current_value || 0) + 1;
        await trx('sequences')
            .where({ name: 'journal', tenant_id: this.tenantId })
            .update({ current_value: nextVal });

        return `${prefix}${String(nextVal).padStart(sequence.pad_length || 6, '0')}`;
    }

    async postOpeningBalances(accountsData, userId, trx) {
        const query = trx || this.db;
        const accounts = Array.isArray(accountsData) ? accountsData : [];
        if (accounts.length === 0) return [];

        const [ownerCapitalId] = Object.values(await resolveSystemAccounts(query, this.tenantId, [SYSTEM_ACCOUNTS.OWNER_CAPITAL]));
        if (!ownerCapitalId) {
            throw new AppError('Owner Capital account not found', 500);
        }

        const ledgerService = new LedgerService(this.db, this.tenantId);
        const journals = [];

        for (const account of accounts) {
            const openingBalance = roundCurrency(Number(account.opening_balance || 0));
            if (Math.abs(openingBalance) <= 0.000001) continue;

            const isDebitNormal = ['asset', 'expense'].includes(account.account_type);
            const accountEntryType = isDebitNormal
                ? (openingBalance >= 0 ? 'debit' : 'credit')
                : (openingBalance >= 0 ? 'credit' : 'debit');
            const offsetEntryType = accountEntryType === 'debit' ? 'credit' : 'debit';

            journals.push(await ledgerService.createJournalEntry({
                journal_date: new Date(),
                transaction_type: 'opening',
                reference_type: 'opening',
                reference_id: account.id,
                narration: `Opening Balance - ${account.code || account.name}`,
                entries: [
                    { account_id: account.id, entry_type: accountEntryType, amount: Math.abs(openingBalance), narration: 'Opening Balance' },
                    { account_id: ownerCapitalId, entry_type: offsetEntryType, amount: Math.abs(openingBalance), narration: 'Opening Balance Offset' },
                ],
                created_by: userId,
            }, query));
        }

        return journals;
    }

    /**
     * Get account with current balance
     */
    async getById(id) {
        const account = await this.db('accounts as a')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .select('a.*', 'g.name as group_name')
            .where('a.tenant_id', this.tenantId)
            .where('a.id', id)
            .first();

        if (!account) throw new AppError('Account not found', 404);

        return account;
    }

    /**
     * List accounts by group
     */
    async listGroupsWithAccounts() {
        const groups = await this.tdb('account_groups').orderBy('sequence_order').orderBy('name');
        const accounts = await this.tdb('accounts').where('is_active', true).whereNotIn('code', ['1200', '2200']).orderBy('code');
        const accountIds = accounts.map((account) => account.id);
        const movementRows = accountIds.length > 0
            ? await this.db('ledger_entries as le')
                .join('journals as j', 'le.journal_id', 'j.id')
                .where('le.tenant_id', this.tenantId)
                .where('j.tenant_id', this.tenantId)
                .whereIn('le.account_id', accountIds)
                .groupBy('le.account_id')
                .select(
                    'le.account_id',
                    this.db.raw('COALESCE(SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END), 0) as debit_total'),
                    this.db.raw('COALESCE(SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END), 0) as credit_total')
                )
            : [];

        const movementMap = new Map(movementRows.map((row) => [row.account_id, row]));

        const accountsWithComputedBalance = accounts.map((account) => {
            const movement = movementMap.get(account.id) || { debit_total: 0, credit_total: 0 };
            const openingBalance = Number(account.opening_balance || 0);
            const debitTotal = Number(movement.debit_total || 0);
            const creditTotal = Number(movement.credit_total || 0);
            const computedBalance = ['asset', 'expense'].includes(account.account_type)
                ? openingBalance + debitTotal - creditTotal
                : openingBalance + creditTotal - debitTotal;

            // For control accounts (1201, 2001) and individual customer/supplier accounts,
            // use current_balance which is kept in sync via transaction code
            // For other accounts, use computed from ledger
            const isControlOrIndividual = 
                account.code === '1201' || 
                account.code === '2001' ||
                (account.code >= '1204' && account.code <= '1299') ||  // Customer accounts
                (account.code >= '2204' && account.code <= '2299');  // Supplier accounts
            
            const finalBalance = isControlOrIndividual 
                ? account.current_balance 
                : computedBalance;

            return {
                ...account,
                computed_balance: roundCurrency(finalBalance),
            };
        });

        return groups.map(group => ({
            ...group,
            accounts: accountsWithComputedBalance.filter(a => a.group_id === group.id)
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
            .where('a.tenant_id', this.tenantId)
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
            .where('a.tenant_id', this.tenantId)
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
