const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Get all suppliers
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 50, search, active_only = true } = req.query;
        const offset = (page - 1) * limit;

        let query = db('suppliers').select('*');

        if (active_only === 'true') {
            query = query.where('is_active', true);
        }

        if (search) {
            query = query.where((builder) => {
                builder.whereILike('name', `%${search}%`).orWhereILike('code', `%${search}%`);
            });
        }

        const [{ count }] = await db('suppliers').where(active_only === 'true' ? { is_active: true } : {}).count();
        const suppliers = await query.orderBy('name').limit(limit).offset(offset);

        res.json({
            success: true,
            data: suppliers,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const supplier = await db('suppliers').where('id', req.params.id).first();
        if (!supplier) throw new AppError('Supplier not found', 404);
        res.json({ success: true, data: supplier });
    } catch (error) {
        next(error);
    }
});

const SequenceService = require('../services/sequence.service');
const sequenceService = new SequenceService(db);

router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { code, name, phone, email, address, city, contact_person, opening_balance } = req.body;
        if (!name) throw new AppError('Name is required', 400);

        // Generate code if not provided
        let supplierCode = code;
        if (!supplierCode) {
            supplierCode = await db.transaction(async (trx) => {
                return await sequenceService.getNextSequenceValue('supplier', trx);
            });
        }

        // Sanitize code (ensure no duplicate empty strings if we allowed nulls, but here we enforce code)

        const [supplier] = await db('suppliers')
            .insert({
                code: supplierCode,
                name,
                phone,
                email,
                address,
                city,
                contact_person,
                opening_balance: opening_balance || 0
            })
            .returning('*');

        res.status(201).json({ success: true, data: supplier });
    } catch (error) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            return next(new AppError('Supplier code or name already exists', 409));
        }
        next(error);
    }
});

router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { code, name, phone, email, address, city, contact_person, is_active } = req.body;

        const [supplier] = await db('suppliers')
            .where({ id: req.params.id })
            .update({ code, name, phone, email, address, city, contact_person, is_active, updated_at: new Date() })
            .returning('*');

        if (!supplier) throw new AppError('Supplier not found', 404);
        res.json({ success: true, data: supplier });
    } catch (error) {
        next(error);
    }
});

// Get supplier ledger (Khata)
router.get('/:id/ledger', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const supplier = await db('suppliers').where('id', req.params.id).first();

        if (!supplier) {
            throw new AppError('Supplier not found', 404);
        }

        let query = db('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .where('a.id', supplier.account_id)
            .select(
                'le.id',
                'le.entry_date',
                'le.entry_type',
                'le.amount',
                'le.reference_type',
                'le.reference_id',
                'le.narration',
                'le.created_at'
            )
            .orderBy('le.entry_date', 'asc')
            .orderBy('le.created_at', 'asc');

        if (from_date) {
            query = query.where('le.entry_date', '>=', from_date);
        }
        if (to_date) {
            query = query.where('le.entry_date', '<=', to_date);
        }

        const entries = await query;

        // Calculate running balance (Supplier is Liability/Creditor: Credit increases, Debit decreases)
        // Opening balance is usually Credit (+ve for liability)
        let balance = parseFloat(supplier.opening_balance);
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
