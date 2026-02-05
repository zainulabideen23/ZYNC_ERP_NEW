const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const AccountService = require('../services/account.service');

const accountService = new AccountService(db);

// Get Chart of Accounts (grouped)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const groupsWithAccounts = await accountService.listGroupsWithAccounts();
        res.json({ success: true, data: groupsWithAccounts });
    } catch (error) {
        next(error);
    }
});

// Get all groups
router.get('/groups', authenticate, async (req, res, next) => {
    try {
        const groups = await db('account_groups').orderBy('sequence_order').orderBy('name');
        res.json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
});

// Get single account
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const account = await accountService.getById(req.params.id);
        res.json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
});

// Get Trial Balance
router.get('/report/trial-balance', authenticate, async (req, res, next) => {
    try {
        const { as_of_date } = req.query;
        const result = await accountService.getTrialBalance(as_of_date);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get account ledger
router.get('/:id/ledger', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const account = await db('accounts').where('id', req.params.id).first();

        if (!account) throw new AppError('Account not found', 404);

        let query = db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .select('le.*', 'j.journal_date', 'j.journal_number', 'j.description as journal_description')
            .where('le.account_id', req.params.id)
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

module.exports = router;

