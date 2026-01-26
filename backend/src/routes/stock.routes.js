const express = require('express');
const router = express.Router();
const db = require('../config/database');
const StockService = require('../services/stock.service');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const stockService = new StockService(db);

// Batch stock adjustment
router.post('/adjust', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { adjustments, notes } = req.body;

        if (!adjustments || !adjustments.length) {
            throw new AppError('Adjustment list is empty', 400);
        }

        const results = await db.transaction(async (trx) => {
            const processed = [];
            for (const adj of adjustments) {
                const { product_id, quantity, adjustment_type, reason, notes: adjNotes } = adj;

                // Final quantity to add to database (+ve for add, -ve for remove)
                const adjQty = adjustment_type === 'remove' ? -Math.abs(quantity) : Math.abs(quantity);

                // Fetch product for unit_cost if adding stock or use avg cost
                const product = await trx('products').where('id', product_id).first();
                if (!product) throw new AppError(`Product ${product_id} not found`, 404);

                const movement = await stockService.adjustStock({
                    product_id,
                    quantity: adjQty,
                    unit_cost: product.cost_price || 0,
                    notes: `${reason.toUpperCase()}: ${adjNotes || notes || ''}`,
                    created_by: req.user.id
                }, trx);

                processed.push(movement);
            }
            return processed;
        });

        res.status(201).json({ success: true, data: results });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
