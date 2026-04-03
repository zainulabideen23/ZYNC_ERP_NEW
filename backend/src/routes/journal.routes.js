const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const LedgerService = require('../services/ledger.service');
const audit = require('../utils/audit');

// List journals
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
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
router.get('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
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
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { journal_date, narration, entries } = req.body;

        // entries: [{ account_id, entry_type, amount, narration }]

        const journal = await db.transaction(async (trx) => {
            const ledgerService = new LedgerService(db, req.tenantId);
            return await ledgerService.createJournalEntry({
                journal_date,
                journal_type: 'general',
                narration,
                entries,
                created_by: req.user.id
            }, trx);
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

module.exports = router;
