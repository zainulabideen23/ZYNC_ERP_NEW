const express = require('express');
const router = express.Router();
const db = require('../config/database');
const StockService = require('../services/stock.service');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');

// Batch stock adjustment
router.post('/adjust', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const stockService = new StockService(db, req.tenantId);
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

// Approve stock adjustment (admin only)
router.post('/adjust/approve', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { adjustment_id } = req.body;
        if (!adjustment_id) throw new AppError('adjustment_id is required', 400);

        const stockService = new StockService(db, req.tenantId);
        await stockService.approveAdjustment(adjustment_id, req.user.id);

        // Audit the approval
        const adjustment = await db('stock_adjustments').where('id', adjustment_id).first();
        await audit(db, {
            userId: req.user.id,
            action: 'approve',
            tableName: 'stock_adjustments',
            recordId: adjustment_id,
            newValues: {
                product_id: adjustment?.product_id,
                quantity_adjusted: adjustment?.quantity_adjusted,
                adjustment_type: adjustment?.adjustment_type
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Adjustment approved' });
    } catch (error) {
        next(error);
    }
});

// Reverse stock adjustment (admin only)
router.post('/adjust/reverse', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { adjustment_id } = req.body;
        if (!adjustment_id) throw new AppError('adjustment_id is required', 400);

        const adjustment = await db('stock_adjustments')
            .where({ id: adjustment_id, tenant_id: req.tenantId })
            .first();

        if (!adjustment) throw new AppError('Adjustment not found', 404);
        if (!adjustment.is_approved) throw new AppError('Cannot reverse unapproved adjustment', 400);

        const stockService = new StockService(db, req.tenantId);

        // Create reverse movement
        await db.transaction(async (trx) => {
            await stockService.createMovement({
                product_id: adjustment.product_id,
                movement_type: 'ADJUSTMENT',
                reference_type: 'adjustment_reversal',
                reference_id: adjustment_id,
                quantity: -adjustment.quantity_adjusted,
                unit_cost: 0,
                notes: `REVERSAL of adjustment ${adjustment_id}`,
                created_by: req.user.id
            }, trx);

            await trx('stock_adjustments')
                .where('id', adjustment_id)
                .update({ is_reversed: true, reversed_by: req.user.id, reversed_at: new Date() });
        });

        // Audit stock adjustment rejection/reversal
        await audit(db, {
            userId: req.user.id,
            action: 'reject',
            tableName: 'stock_adjustments',
            recordId: adjustment_id,
            newValues: { id: adjustment_id, product_id: adjustment.product_id, reason: 'reversed' },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Adjustment reversed' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
