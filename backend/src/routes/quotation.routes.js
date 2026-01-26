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
        const { status, customer_id } = req.query;
        let query = db('quotations as q')
            .leftJoin('customers as c', 'q.customer_id', 'c.id')
            .leftJoin('users as u', 'q.created_by', 'u.id')
            .select('q.*', 'c.name as customer_name', 'u.full_name as created_by_name');

        if (status && status !== 'all') {
            query = query.where('q.status', status);
        }
        if (customer_id) {
            query = query.where('q.customer_id', customer_id);
        }

        const quotations = await query.orderBy('q.created_at', 'desc');
        res.json({ success: true, data: quotations });
    } catch (error) {
        next(error);
    }
});

// Get single quotation with items
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
        const { customer_id, quote_date, valid_until, items, notes } = req.body;

        if (!items || !items.length) {
            throw new AppError('At least one item is required', 400);
        }

        const quotation = await quotationService.createQuotation({
            customer_id,
            quote_date,
            valid_until,
            items,
            notes,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

// Update quotation status
router.patch('/:id/status', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'converted'];

        if (!validStatuses.includes(status)) {
            throw new AppError('Invalid status', 400);
        }

        const [quotation] = await db('quotations')
            .where('id', req.params.id)
            .update({ status, updated_at: new Date() })
            .returning('*');

        if (!quotation) throw new AppError('Quotation not found', 404);

        res.json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
