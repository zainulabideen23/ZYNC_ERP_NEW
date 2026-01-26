const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Accounts (Chart of Accounts)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const accounts = await db('accounts as a')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .select('a.*', 'g.name as group_name')
            .where('a.is_active', true)
            .orderBy('a.code');

        res.json({ success: true, data: accounts });
    } catch (error) {
        next(error);
    }
});

router.get('/groups', authenticate, async (req, res, next) => {
    try {
        const groups = await db('account_groups').orderBy('sequence');
        res.json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/ledger', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const account = await db('accounts').where('id', req.params.id).first();

        if (!account) throw new AppError('Account not found', 404);

        let query = db('ledger_entries')
            .where('account_id', req.params.id)
            .orderBy('entry_date', 'asc')
            .orderBy('created_at', 'asc');

        if (from_date) query = query.where('entry_date', '>=', from_date);
        if (to_date) query = query.where('entry_date', '<=', to_date);

        const entries = await query;

        let balance = parseFloat(account.opening_balance);
        const ledger = entries.map(entry => {
            if (entry.entry_type === 'debit') {
                balance += parseFloat(entry.amount);
            } else {
                balance -= parseFloat(entry.amount);
            }
            return { ...entry, running_balance: balance };
        });

        res.json({
            success: true,
            data: { account, opening_balance: account.opening_balance, closing_balance: balance, entries: ledger }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
