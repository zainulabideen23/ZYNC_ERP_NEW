const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const SupplierService = require('../services/supplier.service');
const audit = require('../utils/audit');

// Get all suppliers
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single supplier
router.get('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplier = await db('suppliers')
            .where({ id: req.params.id, is_deleted: false, tenant_id: req.tenantId })
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
        const supplierService = new SupplierService(db, req.tenantId);
        const supplier = await supplierService.create(req.body, req.user.id);

        // Audit supplier creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'suppliers',
            recordId: supplier.id,
            newValues: { id: supplier.id, code: supplier.code, name: supplier.name, phone_number: supplier.phone_number },
            ip: req.ip,
            tenantId: req.tenantId
        });

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
        const supplierService = new SupplierService(db, req.tenantId);

        // Fetch old values before update
        const oldSupplier = await db('suppliers')
            .where({ id: req.params.id, is_deleted: false, tenant_id: req.tenantId })
            .first();

        const supplier = await supplierService.update(req.params.id, req.body, req.user.id);

        // Audit supplier update
        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'suppliers',
            recordId: req.params.id,
            oldValues: { name: oldSupplier?.name, phone_number: oldSupplier?.phone_number, is_active: oldSupplier?.is_active },
            newValues: { name: supplier.name, phone_number: supplier.phone_number, is_active: supplier.is_active },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: supplier });
    } catch (error) {
        next(error);
    }
});

// Delete supplier (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        // Fetch supplier before deletion
        const oldSupplier = await db('suppliers')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        await db('suppliers')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({ is_deleted: true, updated_at: new Date() });

        // Audit supplier deletion
        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'suppliers',
            recordId: req.params.id,
            oldValues: { id: oldSupplier?.id, code: oldSupplier?.code, name: oldSupplier?.name },
            newValues: { is_deleted: true, deleted_at: new Date().toISOString() },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Get supplier ledger
router.get('/:id/ledger', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const supplier = await db('suppliers').where('id', req.params.id).where('tenant_id', req.tenantId).first();

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
