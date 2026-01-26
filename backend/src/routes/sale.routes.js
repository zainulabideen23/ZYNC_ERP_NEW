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
        const { page = 1, limit = 50, from_date, to_date, customer_id, status = 'completed' } = req.query;
        const offset = (page - 1) * limit;

        let query = db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .leftJoin('users as u', 's.created_by', 'u.id')
            .select('s.*', 'c.name as customer_name', 'c.phone as customer_phone', 'u.full_name as created_by_name');

        if (status) query = query.where('s.status', status);
        if (customer_id) query = query.where('s.customer_id', customer_id);
        if (from_date) query = query.where('s.invoice_date', '>=', from_date);
        if (to_date) query = query.where('s.invoice_date', '<=', to_date);

        const countQuery = db('sales').where('status', status);
        const [{ count }] = await countQuery.count();

        const sales = await query.orderBy('s.created_at', 'desc').limit(limit).offset(offset);

        res.json({
            success: true,
            data: sales,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) }
        });
    } catch (error) {
        next(error);
    }
});

// Get single sale with items
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const sale = await db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .select('s.*', 'c.name as customer_name', 'c.phone as customer_phone', 'c.address as customer_address')
            .where('s.id', req.params.id)
            .first();

        if (!sale) throw new AppError('Sale not found', 404);

        const items = await db('sale_items as si')
            .join('products as p', 'si.product_id', 'p.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .select('si.*', 'p.name as product_name', 'p.code as product_code', 'u.abbreviation as unit')
            .where('si.sale_id', req.params.id);

        const payments = await db('payments')
            .where({ reference_type: 'sale', reference_id: req.params.id });

        res.json({ success: true, data: { ...sale, items, payments } });
    } catch (error) {
        next(error);
    }
});

// Create sale (CRITICAL - uses transaction)
router.post('/', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const { customer_id, invoice_date, items, discount_amount, tax_amount, paid_amount, payment_method, notes } = req.body;

        if (!items || !items.length) {
            throw new AppError('At least one item is required', 400);
        }

        const sale = await saleService.createSale({
            customer_id,
            invoice_date: invoice_date || new Date().toISOString().split('T')[0],
            items,
            discount_amount: discount_amount || 0,
            tax_amount: tax_amount || 0,
            paid_amount: paid_amount || 0,
            payment_method: payment_method || 'cash',
            notes,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        next(error);
    }
});

// Create sale return
router.post('/return', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const { original_sale_id, return_date, items, notes } = req.body;

        if (!original_sale_id || !items || !items.length) {
            throw new AppError('Original sale ID and items are required', 400);
        }

        const saleReturn = await saleService.createSaleReturn({
            original_sale_id,
            return_date: return_date || new Date().toISOString().split('T')[0],
            items,
            notes,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, data: saleReturn });
    } catch (error) {
        next(error);
    }
});

// Create sale return
router.post('/return', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const { original_sale_id, return_date, items, notes } = req.body;

        if (!original_sale_id || !items || !items.length) {
            throw new AppError('Original sale ID and items are required', 400);
        }

        const saleReturn = await saleService.createSaleReturn({
            original_sale_id,
            return_date: return_date || new Date().toISOString().split('T')[0],
            items,
            notes,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, data: saleReturn });
    } catch (error) {
        next(error);
    }
});

// Today's sales summary
router.get('/summary/today', authenticate, async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const summary = await db('sales')
            .where('invoice_date', today)
            .where('status', 'completed')
            .select(
                db.raw('COUNT(*) as total_invoices'),
                db.raw('COALESCE(SUM(total_amount), 0) as total_sales'),
                db.raw('COALESCE(SUM(paid_amount), 0) as total_received'),
                db.raw('COALESCE(SUM(balance_amount), 0) as total_credit')
            )
            .first();

        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
