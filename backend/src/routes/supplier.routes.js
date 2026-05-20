const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const SupplierService = require('../services/supplier.service');
const audit = require('../utils/audit');
const {
    computeAccountOpeningBalanceForDate,
    getLedgerEntriesWithRunningBalance,
} = require('../utils/ledgerQuery');

// Get all suppliers
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Supplier vs GL balance reconciliation
router.get('/reconciliation/balances', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.reconcileBalances(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get supplier purchase history
router.get('/:id/purchases', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.getPurchaseHistory(req.params.id, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get supplier aging summary
router.get('/:id/aging', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.getAgingSummary(req.params.id, req.query.as_of_date || null);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get supplier statement (ledger-backed)
router.get('/:id/statement', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.getStatement(req.params.id, req.query);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get supplier dashboard summary
router.get('/:id/dashboard', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const supplierService = new SupplierService(db, req.tenantId);
        const result = await supplierService.getDashboard(req.params.id, req.query);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get single supplier
router.get('/:id', authorize('admin', 'manager'), async (req, res, next) => {
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
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
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
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
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
router.delete('/:id', authorize('admin'), async (req, res, next) => {
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
router.get('/:id/ledger', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date, page, limit } = req.query;
        const supplier = await db('suppliers')
            .where('id', req.params.id)
            .where('tenant_id', req.tenantId)
            .where('is_deleted', false)
            .first();

        if (!supplier) throw new AppError('Supplier not found', 404);
        if (!supplier.account_id) throw new AppError('Supplier account is not configured', 500);

        const account = await db('accounts')
            .where({ id: supplier.account_id, tenant_id: req.tenantId })
            .first();

        if (!account) throw new AppError('Supplier account not found', 404);

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
                supplier,
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

module.exports = router;
