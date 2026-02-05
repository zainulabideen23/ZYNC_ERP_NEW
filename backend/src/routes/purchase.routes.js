const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const PurchaseService = require('../services/purchase.service');

const purchaseService = new PurchaseService(db);

// Get all purchases
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await purchaseService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single purchase with items
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const purchase = await db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select('p.*', 's.name as supplier_name')
            .where('p.id', req.params.id)
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
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchase = await purchaseService.createPurchase(req.body, req.user.id);
        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

