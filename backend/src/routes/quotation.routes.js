const express = require('express');
const router = express.Router();
const db = require('../config/database');
const QuotationService = require('../services/quotation.service');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const quotationService = new QuotationService(db);

// Get all quotations
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await quotationService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single quotation
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const quotation = await db('quotations as q')
            .leftJoin('customers as c', 'q.customer_id', 'c.id')
            .select('q.*', 'c.name as customer_name', 'c.phone as customer_phone', 'c.address as customer_address')
            .where('q.id', req.params.id)
            .first();

        if (!quotation) throw new AppError('Quotation not found', 404);

        const items = await db('quotation_items as qi')
            .join('products as p', 'qi.product_id', 'p.id')
            .select('qi.*', 'p.name as product_name', 'p.code as product_code')
            .where('qi.quotation_id', req.params.id);

        res.json({ success: true, data: { ...quotation, items } });
    } catch (error) {
        next(error);
    }
});

// Create quotation
router.post('/', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const quotation = await quotationService.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

// Update status
router.patch('/:id/status', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { status } = req.body;
        const [quotation] = await db('quotations')
            .where({ id: req.params.id, is_deleted: false })
            .update({ status, updated_at: new Date(), updated_by: req.user.id })
            .returning('*');

        if (!quotation) throw new AppError('Quotation not found', 404);
        res.json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

module.exports = router;


module.exports = router;
