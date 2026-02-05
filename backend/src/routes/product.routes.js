const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const ProductService = require('../services/product.service');

const productService = new ProductService(db);

// Get all products with pagination
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 50, search, category_id, active_only = true } = req.query;

        const result = await productService.getAll({
            page,
            limit,
            search,
            category_id,
            active_only: active_only === 'true'
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
});

// Get single product
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const product = await productService.getById(req.params.id);
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
});

// Create product
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const product = await productService.create(req.body, req.user.id);
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
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const product = await productService.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

// Delete (soft) product
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        await productService.delete(req.params.id, req.user.id);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;


// Get product stock
router.get('/:id/stock', authenticate, async (req, res, next) => {
    try {
        const movements = await db('stock_movements')
            .where('product_id', req.params.id)
            .orderBy('created_at', 'desc')
            .limit(100);

        const totalStock = await db('stock_movements')
            .where('product_id', req.params.id)
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
