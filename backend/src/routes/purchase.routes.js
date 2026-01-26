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
        const { page = 1, limit = 50, from_date, to_date, supplier_id } = req.query;
        const offset = (page - 1) * limit;

        let query = db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select('p.*', 's.name as supplier_name');

        if (supplier_id) query = query.where('p.supplier_id', supplier_id);
        if (from_date) query = query.where('p.bill_date', '>=', from_date);
        if (to_date) query = query.where('p.bill_date', '<=', to_date);

        const [{ count }] = await db('purchases').count();
        const purchases = await query.orderBy('p.created_at', 'desc').limit(limit).offset(offset);

        res.json({
            success: true,
            data: purchases,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) }
        });
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
        const { supplier_id, bill_date, reference_number, items, discount_amount, tax_amount, paid_amount, payment_method, notes } = req.body;

        if (!items || !items.length) {
            throw new AppError('At least one item is required', 400);
        }

        const purchase = await purchaseService.createPurchase({
            supplier_id,
            bill_date: bill_date || new Date().toISOString().split('T')[0],
            reference_number,
            items,
            discount_amount: discount_amount || 0,
            tax_amount: tax_amount || 0,
            paid_amount: paid_amount || 0,
            payment_method: payment_method || 'cash',
            notes,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
});

// Create purchase return
router.post('/return', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { original_purchase_id, return_date, items, notes } = req.body;

        if (!original_purchase_id || !items || !items.length) {
            throw new AppError('Original purchase ID and items are required', 400);
        }

        const purchaseReturn = await purchaseService.createPurchaseReturn({
            original_purchase_id,
            return_date: return_date || new Date().toISOString().split('T')[0],
            items,
            notes,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, data: purchaseReturn });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
