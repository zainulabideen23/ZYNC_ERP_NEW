const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const PurchaseService = require('../services/purchase.service');
const audit = require('../utils/audit');

// Get all purchases
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const result = await purchaseService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single purchase with items
router.get('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchase = await db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select('p.*', 's.name as supplier_name')
            .where('p.id', req.params.id)
            .where('p.tenant_id', req.tenantId)
            .first();

        if (!purchase) throw new AppError('Purchase not found', 404);

        const items = await db('purchase_items as pi')
            .join('products as pr', 'pi.product_id', 'pr.id')
            .select('pi.*', 'pr.name as product_name', 'pr.code as product_code')
            .where('pi.purchase_id', req.params.id);

        res.json({ success: true, data: { ...purchase, items } });
    } catch (error) {
        next(error);
    }
});

// Create purchase
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const purchase = await purchaseService.createPurchase(req.body, req.user.id);

        // Audit purchase creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'purchases',
            recordId: purchase.id,
            newValues: { id: purchase.id, bill_number: purchase.bill_number, supplier_id: purchase.supplier_id, total_amount: purchase.total_amount, status: purchase.status },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

