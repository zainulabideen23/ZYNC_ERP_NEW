const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const LedgerService = require('../services/ledger.service');

const ledgerService = new LedgerService(db);

// List journals
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const journals = await db('journals')
            .orderBy('journal_date', 'desc')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset);

        res.json({ success: true, data: journals });
    } catch (error) {
        next(error);
    }
});

// Get journal details (with entries)
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const journal = await db('journals').where('id', req.params.id).first();
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

// Create manual journal
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { journal_date, narration, entries } = req.body;

        // entries: [{ account_id, entry_type, amount, narration }]

        const journal = await db.transaction(async (trx) => {
            return await ledgerService.createJournalEntry({
                journal_date,
                journal_type: 'general',
                narration,
                entries,
                created_by: req.user.id
            }, trx);
        });

        res.json({ success: true, data: journal });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
