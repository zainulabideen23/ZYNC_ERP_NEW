const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const LedgerService = require('../services/ledger.service');
const audit = require('../utils/audit');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');

// List journals
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const [{ count }] = await db('journals').where('tenant_id', req.tenantId).count();
        const journals = await db('journals')
            .where('tenant_id', req.tenantId)
            .orderBy('journal_date', 'desc')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset);

        res.json({
            success: true,
            data: journals,
            pagination: {
                total: parseInt(count),
                page: Math.floor(offset / limit) + 1,
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get journal details (with entries)
router.get('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const journal = await db('journals').where('id', req.params.id).where('tenant_id', req.tenantId).first();
        if (!journal) return res.status(404).json({ success: false, error: 'Journal not found' });

        const entries = await db('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .select('le.*', 'a.name as account_name', 'a.code as account_code')
            .where('le.journal_id', req.params.id)
            .orderBy('le.amount', 'desc'); // Show debits first usually

        res.json({ success: true, data: { ...journal, entries } });
    } catch (error) {
        next(error);
    }
});

// Create manual journal (ADMIN ONLY)
router.post('/', authorize('admin'), async (req, res, next) => {
    try {
        const { journal_date, narration, entries } = req.body;

        // entries: [{ account_id, entry_type, amount, narration }]

        const journal = await db.transaction(async (trx) => {
            const ledgerService = new LedgerService(db, req.tenantId);
            const result = await ledgerService.createJournalEntry({
                journal_date,
                journal_type: 'general',
                narration,
                entries,
                created_by: req.user.id
            }, trx);

            // Handle customer receivable accounts sync
            await syncCustomerAccountBalances(trx, req.tenantId, entries);
            
            // Handle supplier payable accounts sync
            await syncSupplierAccountBalances(trx, req.tenantId, entries);

            return result;
        });

        // Audit journal creation
        const totalDebit = (entries || []).filter(e => e.entry_type === 'debit').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        const totalCredit = (entries || []).filter(e => e.entry_type === 'credit').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'journals',
            recordId: journal.id,
            newValues: { id: journal.id, journal_number: journal.journal_number, description: narration, total_debit: totalDebit, total_credit: totalCredit },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: journal });
    } catch (error) {
        next(error);
    }
});

// Helper function to sync customer account balances
async function syncCustomerAccountBalances(trx, tenantId, entries) {
    // Get 1201 control account
    const accountIds = await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES]);
    const controlAccountId = accountIds[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES];
    
    // Get all customer individual accounts (code 1204-1299)
    const customerAccounts = await trx('accounts')
        .where('tenant_id', tenantId)
        .whereRaw("code >= '1204' AND code <= '1299'")
        .where('is_active', true)
        .select('id', 'code');
    
    // Check if any entries affect customer accounts
    const affectedAccountIds = new Set();
    for (const entry of entries || []) {
        if (entry.account_id) {
            affectedAccountIds.add(entry.account_id);
        }
    }
    
    // Update each affected customer account balance
    for (const account of customerAccounts) {
        if (affectedAccountIds.has(account.id)) {
            // Get current balance from ledger
            const ledgerEntries = await trx('ledger_entries')
                .where({ tenant_id: tenantId, account_id: account.id });
            
            let balance = 0;
            for (const e of ledgerEntries) {
                if (e.entry_type === 'debit') balance += parseFloat(e.amount);
                else balance -= parseFloat(e.amount);
            }
            
            // Update account current_balance
            await trx('accounts')
                .where({ id: account.id })
                .update({ current_balance: balance });
        }
    }
    
    // Update 1201 control account to sum of all individual accounts
    let totalIndividual = 0;
    for (const account of customerAccounts) {
        const acc = await trx('accounts').where({ id: account.id }).first();
        totalIndividual += parseFloat(acc?.current_balance || 0);
    }
    
    await trx('accounts')
        .where({ id: controlAccountId })
        .update({ current_balance: totalIndividual });
    
    // Also sync supplier accounts (2001 control with 2204-2299)
    await syncSupplierAccountBalances(trx, tenantId, entries);
}

async function syncSupplierAccountBalances(trx, tenantId, entries) {
    // Get 2001 control account
    const accountIds = await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES]);
    const controlAccountId = accountIds[SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES];
    
    // Get all supplier individual accounts (code 2204-2299)
    const supplierAccounts = await trx('accounts')
        .where('tenant_id', tenantId)
        .whereRaw("code >= '2204' AND code <= '2299'")
        .where('is_active', true)
        .select('id', 'code');
    
    // Check if any entries affect supplier accounts
    const affectedAccountIds = new Set();
    for (const entry of entries || []) {
        if (entry.account_id) {
            affectedAccountIds.add(entry.account_id);
        }
    }
    
    // Update each affected supplier account balance
    for (const account of supplierAccounts) {
        if (affectedAccountIds.has(account.id)) {
            const ledgerEntries = await trx('ledger_entries')
                .where({ tenant_id: tenantId, account_id: account.id });
            
            let balance = 0;
            for (const e of ledgerEntries) {
                if (e.entry_type === 'credit') balance += parseFloat(e.amount);
                else balance -= parseFloat(e.amount);
            }
            
            await trx('accounts')
                .where({ id: account.id })
                .update({ current_balance: balance });
        }
    }
    
    // Update 2001 control account
    let totalIndividual = 0;
    for (const account of supplierAccounts) {
        const acc = await trx('accounts').where({ id: account.id }).first();
        totalIndividual += parseFloat(acc?.current_balance || 0);
    }
    
    await trx('accounts')
        .where({ id: controlAccountId })
        .update({ current_balance: totalIndividual });
}

// Preview manual journal entries before posting
router.post('/preview', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { entries, journal_date, narration } = req.body;
        const ledgerService = new LedgerService(db, req.tenantId);
        const preview = await ledgerService.previewJournal(entries, { journal_date, narration });
        res.json({ success: true, data: preview });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
