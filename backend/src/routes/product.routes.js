const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Get all products with pagination
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 50, search, category_id, company_id, active_only = true } = req.query;
        const offset = (page - 1) * limit;

        let query = db('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('companies as co', 'p.company_id', 'co.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .select(
                'p.*',
                'c.name as category_name',
                'co.name as company_name',
                'u.name as unit_name',
                'u.abbreviation as unit_abbr'
            );

        if (active_only === 'true') {
            query = query.where('p.is_active', true);
        }

        if (search) {
            query = query.where((builder) => {
                builder
                    .whereILike('p.name', `%${search}%`)
                    .orWhereILike('p.code', `%${search}%`)
                    .orWhereILike('p.barcode', `%${search}%`);
            });
        }

        if (category_id) {
            query = query.where('p.category_id', category_id);
        }

        if (company_id) {
            query = query.where('p.company_id', company_id);
        }

        const [{ count }] = await db('products').where(active_only === 'true' ? { is_active: true } : {}).count();
        let products = await query.orderBy('p.name').limit(limit).offset(offset);

        // Calculate current_stock for each product from stock_movements
        products = await Promise.all(products.map(async (product) => {
            const [stockData] = await db('stock_movements')
                .where('product_id', product.id)
                .where('movement_type', 'IN')
                .sum('remaining_qty as total_stock');

            return {
                ...product,
                current_stock: stockData?.total_stock || 0
            };
        }));

        res.json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(count),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get single product
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const product = await db('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('companies as co', 'p.company_id', 'co.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .select(
                'p.*',
                'c.name as category_name',
                'co.name as company_name',
                'u.name as unit_name'
            )
            .where('p.id', req.params.id)
            .first();

        if (!product) {
            throw new AppError('Product not found', 404);
        }

        // Calculate current stock from stock_movements
        const [stockData] = await db('stock_movements')
            .where('product_id', product.id)
            .where('movement_type', 'IN')
            .sum('remaining_qty as total_stock');

        product.current_stock = stockData?.total_stock || 0;

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
});

const SequenceService = require('../services/sequence.service');
const sequenceService = new SequenceService(db);

// Create product
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const {
            code, barcode, name, description, category_id, company_id, unit_id,
            retail_price, wholesale_price, cost_price, min_stock_level, track_stock, image_path
        } = req.body;

        if (!name || !retail_price) {
            throw new AppError('Name and retail price are required', 400);
        }

        // Generate code if not provided
        let productCode = code;
        if (!productCode) {
            productCode = await db.transaction(async (trx) => {
                return await sequenceService.getNextSequenceValue('product', trx);
            });
        }

        const [product] = await db('products').insert({
            code: productCode,
            barcode: barcode || null,
            name, description,
            category_id: category_id || null,
            company_id: company_id || null,
            unit_id: unit_id || null,
            retail_price,
            wholesale_price: wholesale_price || null,
            cost_price: cost_price || null,
            min_stock_level: min_stock_level || 0,
            track_stock: track_stock !== false, image_path
        })
            .returning('*');

        // Handle Opening Stock
        if (req.body.opening_stock && parseFloat(req.body.opening_stock) > 0) {
            await db('stock_movements').insert({
                product_id: product.id,
                movement_type: 'IN',
                reference_type: 'opening',
                quantity: parseFloat(req.body.opening_stock),
                unit_cost: cost_price || 0, // Opening stock uses cost price
                remaining_qty: parseFloat(req.body.opening_stock), // For FIFO
                created_by: req.user.id,
                created_at: new Date()
            });
        }

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        if (error.code === '23505') {
            if (error.detail && error.detail.includes('code')) return next(new AppError('Product code already exists', 409));
            if (error.detail && error.detail.includes('barcode')) return next(new AppError('Barcode already exists', 409));
        }
        next(error);
    }
});

// Update product
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const {
            code, barcode, name, description, category_id, company_id, unit_id,
            retail_price, wholesale_price, cost_price, min_stock_level, track_stock, image_path, is_active
        } = req.body;

        const [product] = await db('products')
            .where({ id: req.params.id })
            .update({
                code,
                barcode: barcode || null,
                name, description,
                category_id: category_id || null,
                company_id: company_id || null,
                unit_id: unit_id || null,
                retail_price,
                wholesale_price: wholesale_price || null,
                cost_price: cost_price || null,
                min_stock_level, track_stock,
                image_path, is_active, updated_at: new Date()
            })
            .returning('*');

        if (!product) {
            throw new AppError('Product not found', 404);
        }

        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

// Delete (soft) product
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const [product] = await db('products')
            .where({ id: req.params.id })
            .update({ is_active: false, updated_at: new Date() })
            .returning('*');

        if (!product) {
            throw new AppError('Product not found', 404);
        }

        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        next(error);
    }
});

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
