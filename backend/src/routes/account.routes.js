const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const AccountService = require('../services/account.service');
const LedgerService = require('../services/ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const {
    computeAccountOpeningBalanceForDate,
    getLedgerEntriesWithRunningBalance,
} = require('../utils/ledgerQuery');

const RECONCILIATION_TOLERANCE = 0.01;
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

// Get Chart of Accounts (grouped)
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const accountService = new AccountService(db, req.tenantId);
        const groupsWithAccounts = await accountService.listGroupsWithAccounts();
        res.json({ success: true, data: groupsWithAccounts });
    } catch (error) {
        next(error);
    }
});

// Get all groups
router.get('/groups', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const groups = await db('account_groups').where('tenant_id', req.tenantId).orderBy('sequence_order').orderBy('name');
        res.json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
});

// Get single account
router.get('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const accountService = new AccountService(db, req.tenantId);
        const account = await accountService.getById(req.params.id);
        res.json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
});

// Get Trial Balance
router.get('/report/trial-balance', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const accountService = new AccountService(db, req.tenantId);
        const { as_of_date } = req.query;
        const result = await accountService.getTrialBalance(as_of_date);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get customer/supplier reconciliation against linked control accounts
router.get('/report/party-reconciliation', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const customers = await db('customers as c')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 'c.account_id').andOn('a.tenant_id', '=', 'c.tenant_id');
            })
            .where('c.tenant_id', req.tenantId)
            .where('c.is_deleted', false)
            .select(
                'c.id',
                'c.code',
                'c.name',
                'c.account_id',
                'c.current_balance as party_balance',
                'a.current_balance as ledger_balance'
            );

        const suppliers = await db('suppliers as s')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 's.account_id').andOn('a.tenant_id', '=', 's.tenant_id');
            })
            .where('s.tenant_id', req.tenantId)
            .where('s.is_deleted', false)
            .select(
                's.id',
                's.code',
                's.name',
                's.account_id',
                's.current_balance as party_balance',
                'a.current_balance as ledger_balance'
            );

        const normalizeRows = (rows, type) => rows.map((row) => {
            const partyBalance = round2(row.party_balance);
            const ledgerBalance = round2(row.ledger_balance);
            const difference = round2(ledgerBalance - partyBalance);
            return {
                party_type: type,
                id: row.id,
                code: row.code,
                name: row.name,
                account_id: row.account_id,
                party_balance: partyBalance,
                ledger_balance: ledgerBalance,
                difference,
                is_mismatch: Math.abs(difference) > RECONCILIATION_TOLERANCE,
            };
        });

        const normalizedCustomers = normalizeRows(customers, 'customer');
        const normalizedSuppliers = normalizeRows(suppliers, 'supplier');

        const customerMismatches = normalizedCustomers.filter((row) => row.is_mismatch);
        const supplierMismatches = normalizedSuppliers.filter((row) => row.is_mismatch);

        res.json({
            success: true,
            data: {
                summary: {
                    customer_total: normalizedCustomers.length,
                    supplier_total: normalizedSuppliers.length,
                    customer_mismatches: customerMismatches.length,
                    supplier_mismatches: supplierMismatches.length,
                    mismatch_total: customerMismatches.length + supplierMismatches.length,
                    tolerance: RECONCILIATION_TOLERANCE,
                },
                customers: normalizedCustomers,
                suppliers: normalizedSuppliers,
                mismatches: {
                    customers: customerMismatches,
                    suppliers: supplierMismatches,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get account ledger
router.get('/:id/ledger', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date, page, limit } = req.query;
        const account = await db('accounts').where('id', req.params.id).where('tenant_id', req.tenantId).first();

        if (!account) throw new AppError('Account not found', 404);

        const openingBalance = await computeAccountOpeningBalanceForDate({
            trx: db,
            tenantId: req.tenantId,
            accountId: account.id,
            accountType: account.account_type,
            openingBalance: account.opening_balance,
            fromDate: from_date,
        });

        const ledger = await getLedgerEntriesWithRunningBalance({
            db,
            tenantId: req.tenantId,
            accountId: account.id,
            accountType: account.account_type,
            fromDate: from_date || null,
            toDate: to_date || null,
            openingBalance,
            page,
            limit,
        });

        res.json({
            success: true,
            data: {
                account,
                opening_balance: openingBalance,
                page_opening_balance: ledger.pageOpeningBalance,
                closing_balance: ledger.closingBalance,
                entries: ledger.entries,
                pagination: ledger.pagination,
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/accounts/opening-balances
// Post opening balance journal entry (admin only, one-time, idempotent)
router.post('/opening-balances', authorize('admin'), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;

        // Check if opening balance journal was already posted
        const existing = await db('journals')
            .where({ tenant_id: tenantId, reference_type: 'opening' })
            .whereNull('reference_id')
            .first();

        if (existing) {
            return res.status(409).json({
                error: 'Opening balances have already been posted. Use a manual journal for corrections.'
            });
        }

        // Fetch all accounts with non-zero opening_balance
        const accounts = await db('accounts')
            .where('tenant_id', tenantId)
            .where('is_active', true)
            .whereRaw('opening_balance != 0')
            .select('id', 'code', 'name', 'account_type', 'opening_balance');

        if (accounts.length === 0) {
            return res.status(400).json({
                error: 'No accounts have opening balances set. Set opening_balance values on accounts first.'
            });
        }

        // Get Owner Capital account as the balancing entry
        const ownerCapital = await db('accounts')
            .where({ tenant_id: tenantId, code: '3001' })
            .first();

        if (!ownerCapital) {
            return res.status(500).json({ error: 'Owner Capital account (3001) not found.' });
        }

        // Build journal entries
        // Rule: Asset/Expense (debit-normal) → DEBIT, Liability/Equity/Income (credit-normal) → CREDIT
        const entries = [];
        let totalDebits = 0;
        let totalCredits = 0;

        for (const account of accounts) {
            if (account.code === '3001') continue; // Owner Capital handled separately

            const openingBalance = Number(account.opening_balance || 0);
            if (!Number.isFinite(openingBalance)) {
                return res.status(400).json({ error: `Invalid opening balance for account ${account.code}` });
            }

            const amount = Math.abs(openingBalance);
            if (amount === 0) continue;

            const isDebitNormal = ['asset', 'expense'].includes(account.account_type);
            const entryType = isDebitNormal
                ? (openingBalance >= 0 ? 'debit' : 'credit')
                : (openingBalance >= 0 ? 'credit' : 'debit');

            entries.push({ account_id: account.id, entry_type: entryType, amount });

            if (entryType === 'debit') {
                totalDebits += amount;
            } else {
                totalCredits += amount;
            }
        }

        if (entries.length === 0) {
            return res.status(400).json({
                error: 'No non-zero opening balances found to post (excluding owner capital).'
            });
        }

        // Calculate balancing entry for Owner Capital
        const difference = totalDebits - totalCredits;

        if (difference > 0) {
            entries.push({ account_id: ownerCapital.id, entry_type: 'credit', amount: difference });
            totalCredits += difference;
        } else if (difference < 0) {
            entries.push({ account_id: ownerCapital.id, entry_type: 'debit', amount: Math.abs(difference) });
            totalDebits += Math.abs(difference);
        }

        // Post journal in a transaction
        await db.transaction(async (trx) => {
            const ledgerService = new LedgerService(db, tenantId);

            await ledgerService.createJournalEntry({
                journal_date: new Date(),
                transaction_type: 'opening',
                reference_type: 'opening',
                reference_id: null,
                narration: 'Opening Balance Entry - Beginning balances brought forward',
                entries,
                created_by: req.user.id,
            }, trx);
        });

        return res.json({
            success: true,
            message: 'Opening balances posted successfully.',
        });

    } catch (error) {
        next(error);
    }
});

const updateAccount = async (req, res, next) => {
    try {
        const account = await db('accounts')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        if (!account) throw new AppError('Account not found', 404);

        const inputFields = [
            'code',
            'name',
            'group_id',
            'account_type',
            'is_bank_account',
            'bank_name',
            'account_number',
            'opening_balance',
            'description',
            'is_active',
            'notes'
        ];

        const updateData = { updated_at: new Date() };
        for (const field of inputFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        if (account.is_system) {
            // System accounts allow only safe metadata and onboarding opening balance updates.
            const allowedFields = ['description', 'is_active', 'opening_balance'];
            const attempted = Object.keys(updateData).filter(k => k !== 'updated_at' && !allowedFields.includes(k));
            if (attempted.length > 0) {
                return res.status(403).json({
                    error: `Cannot modify ${attempted.join(', ')} on system accounts.`
                });
            }
        }

        if (updateData.opening_balance !== undefined) {
            const openingBalance = Number(updateData.opening_balance);
            if (!Number.isFinite(openingBalance)) {
                return res.status(400).json({ error: 'opening_balance must be a valid number.' });
            }

            const hasLedgerEntries = await db('ledger_entries')
                .where({ tenant_id: req.tenantId, account_id: account.id })
                .first();

            if (hasLedgerEntries) {
                return res.status(409).json({
                    error: 'Cannot change opening balance after ledger transactions exist for this account.'
                });
            }

            updateData.opening_balance = openingBalance;
            updateData.current_balance = openingBalance;
        }

        await db('accounts')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update(updateData);

        // Sync 1201 control account if this is a customer account (code 1204-1299)
        await syncControlAccount(req.tenantId);

        return res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

// PUT|PATCH /:id - Update account (with system account protection)
router.put('/:id', authorize('admin'), updateAccount);
router.patch('/:id', authorize('admin'), updateAccount);

// DELETE /:id - Delete account (with system account protection)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
        const account = await db('accounts')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        if (!account) throw new AppError('Account not found', 404);

        // Block deletion of system accounts
        if (account.is_system) {
            return res.status(403).json({
                error: 'System accounts cannot be deleted. They are required for core accounting operations.'
            });
        }

        const hasLedgerEntries = await db('ledger_entries')
            .where({ tenant_id: req.tenantId, account_id: account.id })
            .first('id');

        if (hasLedgerEntries) {
            return res.status(409).json({
                error: 'Cannot delete account because ledger entries exist for it.'
            });
        }

        // The FK RESTRICT on ledger_entries.account_id will prevent
        // deletion if any journal entries reference this account.
        await db('accounts')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .delete();

        return res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Reconcile Customer Receivables
router.get('/reconcile-customer-receivables', authorize('admin'), async (req, res, next) => {
    try {
        const { reconcileCustomerReceivables } = require('../utils/reconcileCustomerReceivables');
        const result = await reconcileCustomerReceivables(db, req.tenantId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Migrate Customer Receivables Balances
router.post('/migrate-customer-receivables', authorize('admin'), async (req, res, next) => {
    try {
        const { migrateCustomerReceivables } = require('../utils/migrateCustomerReceivables');
        const result = await migrateCustomerReceivables(db, req.tenantId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Helper to sync 1201 and 2001 control accounts
async function syncControlAccount(tenantId) {
    try {
        // Sync customer receivables (1201)
        const customerAccountIds = await resolveSystemAccounts(db, tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES]);
        const customerControlId = customerAccountIds[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES];
        
        const customerAccounts = await db('accounts')
            .where('tenant_id', tenantId)
            .whereRaw("code >= '1204' AND code <= '1299'")
            .where('is_active', true)
            .select('id', 'current_balance');
        
        let totalCustomer = 0;
        for (const acc of customerAccounts) {
            totalCustomer += parseFloat(acc.current_balance || 0);
        }
        
        await db('accounts')
            .where({ id: customerControlId })
            .update({ current_balance: totalCustomer });
        
        // Sync supplier payables (2001)
        const supplierAccountIds = await resolveSystemAccounts(db, tenantId, [SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES]);
        const supplierControlId = supplierAccountIds[SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES];
        
        const supplierAccounts = await db('accounts')
            .where('tenant_id', tenantId)
            .whereRaw("code >= '2204' AND code <= '2299'")
            .where('is_active', true)
            .select('id', 'current_balance');
        
        let totalSupplier = 0;
        for (const acc of supplierAccounts) {
            totalSupplier += parseFloat(acc.current_balance || 0);
        }
        
        await db('accounts')
            .where({ id: supplierControlId })
            .update({ current_balance: totalSupplier });
    } catch (error) {
        console.error('Error syncing control account:', error.message);
    }
}

module.exports = router;

