const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const SaleService = require('../services/sale.service');
const SaleReturnService = require('../services/saleReturn.service');
const audit = require('../utils/audit');

// Get all sales
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const saleService = new SaleService(db, req.tenantId);
        const result = await saleService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Today's sales summary
// NOTE: Keep this route above /:id so it is not shadowed by dynamic params.
router.get('/summary/today', async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const summary = await db('sales')
            .whereRaw('sale_date::date = ?', [today])
            .where('status', 'completed')
            .where('is_deleted', false)
            .where('tenant_id', req.tenantId)
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

// List sale returns
router.get('/returns', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const saleReturnService = new SaleReturnService(db, req.tenantId);
        const result = await saleReturnService.listReturns(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// List returns for a single sale
router.get('/:id/returns', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const saleReturnService = new SaleReturnService(db, req.tenantId);
        const result = await saleReturnService.listReturns({ ...req.query, sale_id: req.params.id });
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single sale return
router.get('/returns/:returnId', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const saleReturnService = new SaleReturnService(db, req.tenantId);
        const result = await saleReturnService.getReturnById(req.params.returnId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Return impact preview (smart excess handling prompt)
router.post('/:id/return-preview', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const saleReturnService = new SaleReturnService(db, req.tenantId);
        const preview = await saleReturnService.getReturnPreview(req.params.id, {
            items: req.body?.items || [],
        });

        res.json({ success: true, data: preview });
    } catch (error) {
        next(error);
    }
});

// Create sale
router.post('/', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const saleService = new SaleService(db, req.tenantId);
        const sale = await saleService.createSale(req.body, req.user.id);

        // Audit sale creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'sales',
            recordId: sale.id,
            newValues: {
                invoice_number: sale.invoice_number,
                total_amount: sale.total_amount,
                customer_id: sale.customer_id
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        next(error);
    }
});

// Record payment on sale
router.post('/:id/payment', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const saleService = new SaleService(db, req.tenantId);
        const result = await saleService.recordPayment(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Create sale return (preferred endpoint)
const createSaleReturnHandler = async (req, res, next) => {
    try {
        const saleReturnService = new SaleReturnService(db, req.tenantId);
        const payload = {
            ...req.body,
            applyToPrevious: req.body?.applyToPrevious === true,
        };
        const saleReturn = await saleReturnService.createReturn(req.params.id, payload, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'sales',
            recordId: saleReturn.id,
            newValues: {
                return_number: saleReturn.return_number || saleReturn.invoice_number,
                sale_id: saleReturn.original_sale_id,
                total_amount: saleReturn.total_amount,
                is_return: true,
                excess_handling: saleReturn.return_breakdown?.handling || 'standard',
                applied_to_previous: saleReturn.return_breakdown?.applied_to_previous || 0,
                cash_refund: saleReturn.return_breakdown?.cash_refund || 0,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.status(201).json({ success: true, data: saleReturn });
    } catch (error) {
        next(error);
    }
};

router.post('/:id/return', authorize('admin', 'manager'), createSaleReturnHandler);
router.post('/:id/returns', authorize('admin', 'manager'), createSaleReturnHandler);

// Create sale return (legacy compatibility endpoint)
router.post('/return', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { original_sale_id } = req.body;
        if (!original_sale_id) {
            throw new AppError('original_sale_id is required', 400);
        }

        const saleReturnService = new SaleReturnService(db, req.tenantId);
        const payload = {
            ...req.body,
            applyToPrevious: req.body?.applyToPrevious === true,
        };
        const saleReturn = await saleReturnService.createReturn(original_sale_id, payload, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'sales',
            recordId: saleReturn.id,
            newValues: {
                return_number: saleReturn.return_number || saleReturn.invoice_number,
                sale_id: saleReturn.original_sale_id,
                total_amount: saleReturn.total_amount,
                is_return: true,
                excess_handling: saleReturn.return_breakdown?.handling || 'standard',
                applied_to_previous: saleReturn.return_breakdown?.applied_to_previous || 0,
                cash_refund: saleReturn.return_breakdown?.cash_refund || 0,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.status(201).json({ success: true, data: saleReturn });
    } catch (error) {
        next(error);
    }
});

// Get single sale with items
router.get('/:id', async (req, res, next) => {
    try {
        const coreReturnAggSubquery = db('sales as rs')
            .select('rs.original_sale_id as sale_id')
            .sum({ returned_amount: 'rs.total_amount' })
            .count('* as return_count')
            .where('rs.tenant_id', req.tenantId)
            .where('rs.is_return', true)
            .groupBy('rs.original_sale_id')
            .as('core_ret_agg');

        const legacyReturnAggSubquery = db('sale_returns as sr')
            .select('sr.sale_id')
            .sum({ returned_amount: 'sr.total_amount' })
            .count('* as return_count')
            .where('sr.tenant_id', req.tenantId)
            .where('sr.status', 'processed')
            .groupBy('sr.sale_id')
            .as('legacy_ret_agg');

        const sale = await db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .leftJoin(coreReturnAggSubquery, 'core_ret_agg.sale_id', 's.id')
            .leftJoin(legacyReturnAggSubquery, 'legacy_ret_agg.sale_id', 's.id')
            .select(
                's.*',
                'c.name as customer_name',
                'c.phone_number as customer_phone',
                'c.address_line1 as customer_address',
                db.raw('COALESCE(core_ret_agg.returned_amount, 0) + COALESCE(legacy_ret_agg.returned_amount, 0) as returned_amount'),
                db.raw('COALESCE(core_ret_agg.return_count, 0) + COALESCE(legacy_ret_agg.return_count, 0) as return_count')
            )
            .where('s.id', req.params.id)
            .where('s.tenant_id', req.tenantId)
            .first();

        if (!sale) throw new AppError('Sale not found', 404);

        const items = await db('sale_items as si')
            .join('products as p', 'si.product_id', 'p.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .select('si.*', 'p.name as product_name', 'p.code as product_code', 'u.abbreviation as unit')
            .where('si.sale_id', req.params.id)
            .where('si.tenant_id', req.tenantId);

        const coreItemReturns = await db('sale_items as rsi')
            .join('sales as rs', 'rsi.sale_id', 'rs.id')
            .where('rs.tenant_id', req.tenantId)
            .where('rs.is_return', true)
            .where('rs.original_sale_id', req.params.id)
            .whereNotNull('rsi.original_sale_item_id')
            .select('rsi.original_sale_item_id')
            .sum({ returned_qty: 'rsi.quantity' })
            .groupBy('rsi.original_sale_item_id');

        const legacyItemReturns = await db('sale_return_items as sri')
            .join('sale_returns as sr', 'sri.sale_return_id', 'sr.id')
            .where('sr.tenant_id', req.tenantId)
            .where('sr.sale_id', req.params.id)
            .where('sr.status', 'processed')
            .select('sri.sale_item_id')
            .sum({ returned_qty: 'sri.quantity' })
            .groupBy('sri.sale_item_id');

        const returnedMap = new Map();
        for (const row of coreItemReturns) {
            returnedMap.set(row.original_sale_item_id, Number(row.returned_qty || 0));
        }
        for (const row of legacyItemReturns) {
            const current = Number(returnedMap.get(row.sale_item_id) || 0);
            returnedMap.set(row.sale_item_id, current + Number(row.returned_qty || 0));
        }

        const itemsWithReturnState = items.map((item) => {
            const returnedQuantity = Number(returnedMap.get(item.id) || 0);
            const soldQuantity = Number(item.quantity || 0);
            const returnableQuantity = Math.max(0, soldQuantity - returnedQuantity);

            return {
                ...item,
                returned_quantity: returnedQuantity,
                returnable_quantity: returnableQuantity,
            };
        });

        res.json({ success: true, data: { ...sale, items: itemsWithReturnState } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
