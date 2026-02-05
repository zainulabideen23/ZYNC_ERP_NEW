const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const SupplierService = require('../services/supplier.service');

const supplierService = new SupplierService(db);

// Get all suppliers
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await supplierService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single supplier
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const supplier = await db('suppliers')
            .where({ id: req.params.id, is_deleted: false })
            .first();

        if (!supplier) throw new AppError('Supplier not found', 404);

        res.json({ success: true, data: supplier });
    } catch (error) {
        next(error);
    }
});

// Create supplier
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplier = await supplierService.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: supplier });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Supplier code or name already exists', 409));
        }
        next(error);
    }
});

// Update supplier
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplier = await supplierService.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: supplier });
    } catch (error) {
        next(error);
    }
});

// Get supplier ledger
router.get('/:id/ledger', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const supplier = await db('suppliers').where('id', req.params.id).first();

        if (!supplier) throw new AppError('Supplier not found', 404);

        let query = db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .select(
                'le.*',
                'j.journal_date as entry_date',
                'j.journal_number',
                'j.reference_type',
                'j.reference_id',
                'j.description as narration'
            )
            .where('le.account_id', supplier.account_id)
            .orderBy('j.journal_date', 'asc')
            .orderBy('le.created_at', 'asc');

        if (from_date) query = query.where('j.journal_date', '>=', from_date);
        if (to_date) query = query.where('j.journal_date', '<=', to_date);

        const entries = await query;

        let balance = parseFloat(supplier.opening_balance) || 0;
        const ledger = entries.map(entry => {
            if (entry.entry_type === 'credit') {
                balance += parseFloat(entry.amount);
            } else {
                balance -= parseFloat(entry.amount);
            }
            return { ...entry, running_balance: balance };
        });

        res.json({
            success: true,
            data: {
                supplier,
                opening_balance: supplier.opening_balance,
                closing_balance: balance,
                entries: ledger
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
