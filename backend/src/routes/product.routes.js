const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const ProductService = require('../services/product.service');
const audit = require('../utils/audit');

// Get all products with pagination
router.get('/', async (req, res, next) => {
    try {
        const productService = new ProductService(db, req.tenantId);
        const { page = 1, limit = 50, search, category_id, brand_id, is_active, track_stock, low_stock, active_only = true } = req.query;

        const result = await productService.getAll({
            page,
            limit,
            search,
            category_id,
            brand_id,
            is_active: is_active === undefined ? undefined : is_active === 'true',
            track_stock: track_stock === undefined ? undefined : track_stock === 'true',
            low_stock: low_stock === 'true',
            active_only: active_only === 'true'
        });

        // Strip cost_price from response for cashier role
        if (req.user && req.user.role === 'cashier' && result.data) {
            result.data = result.data.map(p => {
                const { cost_price, ...rest } = p;
                return rest;
            });
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
});

// Get product cost history
router.get('/:id/cost-history', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const productService = new ProductService(db, req.tenantId);
        const result = await productService.getCostHistory(req.params.id, req.query);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

// Get single product
router.get('/:id', async (req, res, next) => {
    try {
        const productService = new ProductService(db, req.tenantId);
        const product = await productService.getById(req.params.id);

        // Strip cost_price from response for cashier role
        if (req.user && req.user.role === 'cashier' && product) {
            delete product.cost_price;
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
});

// Create product
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const productService = new ProductService(db, req.tenantId);
        const product = await productService.create(req.body, req.user.id);

        // Audit product creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'products',
            recordId: product.id,
            newValues: { id: product.id, code: product.code, name: product.name, retail_price: product.retail_price, category_id: product.category_id },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        if (error.code === '23505') {
            if (error.detail && error.detail.includes('code')) return res.status(409).json({ success: false, message: 'Product code already exists' });
            if (error.detail && error.detail.includes('barcode')) return res.status(409).json({ success: false, message: 'Barcode already exists' });
        }
        next(error);
    }
});

// Update product
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const productService = new ProductService(db, req.tenantId);

        // Fetch old values before update
        const oldProduct = await productService.getById(req.params.id);
        const product = await productService.update(req.params.id, req.body, req.user.id);

        // Audit product update
        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'products',
            recordId: req.params.id,
            oldValues: { name: oldProduct?.name, retail_price: oldProduct?.retail_price, cost_price: oldProduct?.cost_price, current_stock: oldProduct?.current_stock },
            newValues: { name: product.name, retail_price: product.retail_price, cost_price: product.cost_price, current_stock: product.current_stock },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

// Delete (soft) product
router.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
        const productService = new ProductService(db, req.tenantId);

        // Fetch product before deletion
        const oldProduct = await productService.getById(req.params.id);
        await productService.delete(req.params.id, req.user.id);

        // Audit product deletion
        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'products',
            recordId: req.params.id,
            oldValues: { id: oldProduct?.id, code: oldProduct?.code, name: oldProduct?.name },
            newValues: { is_deleted: true, deleted_at: new Date().toISOString() },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Get product stock
router.get('/:id/stock', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const movements = await db('stock_movements')
            .where('product_id', req.params.id)
            .where('tenant_id', req.tenantId)
            .orderBy('created_at', 'desc')
            .limit(100);

        const totalStock = await db('stock_movements')
            .where('product_id', req.params.id)
            .where('tenant_id', req.tenantId)
            .sum('quantity as total')
            .first();

        res.json({
            success: true,
            data: {
                current_stock: parseFloat(totalStock.total) || 0,
                movements
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
