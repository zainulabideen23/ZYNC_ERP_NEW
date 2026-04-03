const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const AccountService = require('../services/account.service');

// Get Chart of Accounts (grouped)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const accountService = new AccountService(db, req.tenantId);
        const groupsWithAccounts = await accountService.listGroupsWithAccounts();
        res.json({ success: true, data: groupsWithAccounts });
    } catch (error) {
        next(error);
    }
});

// Get all groups
router.get('/groups', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const groups = await db('account_groups').where('tenant_id', req.tenantId).orderBy('sequence_order').orderBy('name');
        res.json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
});

// Get single account
router.get('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const accountService = new AccountService(db, req.tenantId);
        const account = await accountService.getById(req.params.id);
        res.json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
});

// Get Trial Balance
router.get('/report/trial-balance', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const accountService = new AccountService(db, req.tenantId);
        const { as_of_date } = req.query;
        const result = await accountService.getTrialBalance(as_of_date);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get account ledger
router.get('/:id/ledger', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const account = await db('accounts').where('id', req.params.id).where('tenant_id', req.tenantId).first();

        if (!account) throw new AppError('Account not found', 404);

        let query = db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .select('le.*', 'j.journal_date', 'j.journal_number', 'j.description as journal_description')
            .where('le.account_id', req.params.id)
            .where('le.tenant_id', req.tenantId)
            .orderBy('j.journal_date', 'asc')
            .orderBy('le.created_at', 'asc');

        if (from_date) query = query.where('j.journal_date', '>=', from_date);
        if (to_date) query = query.where('j.journal_date', '<=', to_date);

        const entries = await query;

        let balance = parseFloat(account.opening_balance);
        const ledger = entries.map(entry => {
            if (['asset', 'expense'].includes(account.account_type)) {
                balance = entry.entry_type === 'debit' ? balance + parseFloat(entry.amount) : balance - parseFloat(entry.amount);
            } else {
                balance = entry.entry_type === 'credit' ? balance + parseFloat(entry.amount) : balance - parseFloat(entry.amount);
            }
            return { ...entry, entry_date: entry.journal_date, running_balance: balance };
        });

        res.json({
            success: true,
            data: {
                account,
                opening_balance: account.opening_balance,
                closing_balance: balance,
                entries: ledger
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/accounts/opening-balances
// Post opening balance journal entry (admin only, one-time, idempotent)
router.post('/opening-balances', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;

        // Check if opening balance journal was already posted
        const existing = await db('journals')
            .where({ tenant_id: tenantId, reference_type: 'opening' })
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

            const amount = Math.abs(parseFloat(account.opening_balance));
            if (amount === 0) continue;

            if (['asset', 'expense'].includes(account.account_type)) {
                entries.push({ account_id: account.id, entry_type: 'debit', amount });
                totalDebits += amount;
            } else {
                entries.push({ account_id: account.id, entry_type: 'credit', amount });
                totalCredits += amount;
            }
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
            // Get next journal sequence
            const seq = await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .forUpdate()
                .first();

            const nextNum = seq.current_value + 1;
            const journalNumber = `${seq.prefix}${String(nextNum).padStart(seq.pad_length, '0')}`;

            await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .update({ current_value: nextNum });

            // Create the journal
            const [journal] = await trx('journals').insert({
                tenant_id: tenantId,
                journal_number: journalNumber,
                reference_type: 'opening',
                reference_id: null,
                journal_date: new Date(),
                description: 'Opening Balance Entry — Beginning balances brought forward',
                total_debit: totalDebits,
                total_credit: totalCredits,
                is_balanced: totalDebits === totalCredits,
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            // Insert ledger entries (trigger will update current_balance on each)
            for (const entry of entries) {
                await trx('ledger_entries').insert({
                    tenant_id: tenantId,
                    journal_id: journal.id,
                    account_id: entry.account_id,
                    entry_type: entry.entry_type,
                    amount: entry.amount,
                    description: 'Opening balance',
                    created_at: trx.fn.now(),
                });
            }
        });

        return res.json({
            success: true,
            message: 'Opening balances posted successfully.',
        });

    } catch (error) {
        next(error);
    }
});

// PATCH /:id - Update account (with system account protection)
router.patch('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const account = await db('accounts')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        if (!account) throw new AppError('Account not found', 404);

        if (account.is_system) {
            // Only allow changing description and is_active for system accounts
            const allowedFields = ['description', 'is_active'];
            const attempted = Object.keys(req.body).filter(k => !allowedFields.includes(k));
            if (attempted.length > 0) {
                return res.status(403).json({
                    error: `Cannot modify ${attempted.join(', ')} on system accounts.`
                });
            }
        }

        await db('accounts')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({ ...req.body, updated_at: new Date() });

        return res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// DELETE /:id - Delete account (with system account protection)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
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

module.exports = router;

