const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const SaleService = require('../services/sale.service');

const saleService = new SaleService(db);

// Get all sales
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await saleService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single sale with items
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const sale = await db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .select('s.*', 'c.name as customer_name', 'c.phone_number as customer_phone', 'c.address_line1 as customer_address')
            .where('s.id', req.params.id)
            .first();

        if (!sale) throw new AppError('Sale not found', 404);

        const items = await db('sale_items as si')
            .join('products as p', 'si.product_id', 'p.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .select('si.*', 'p.name as product_name', 'p.code as product_code', 'u.abbreviation as unit')
            .where('si.sale_id', req.params.id);

        res.json({ success: true, data: { ...sale, items } });
    } catch (error) {
        next(error);
    }
});

// Create sale
router.post('/', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const sale = await saleService.createSale(req.body, req.user.id);
        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        next(error);
    }
});

// Today's sales summary
router.get('/summary/today', authenticate, async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const summary = await db('sales')
            .whereRaw('sale_date::date = ?', [today])
            .where('status', 'completed')
            .where('is_deleted', false)
            .select(
                db.raw('COUNT(*) as total_invoices'),
                db.raw('COALESCE(SUM(total_amount), 0) as total_sales'),
                db.raw('COALESCE(SUM(amount_paid), 0) as total_received'),
                db.raw('COALESCE(SUM(amount_due), 0) as total_credit')
            )
            .first();

        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
});

module.exports = router;


module.exports = router;
