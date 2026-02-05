const { AppError } = require('../middleware/errorHandler');

class StockService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a stock movement record
     * Centrally handles products.current_stock update
     */
    async createMovement(data, trx = null) {
        const query = trx || this.db;
        const {
            product_id,
            movement_type,
            reference_type,
            reference_id,
            quantity,
            unit_cost,
            notes,
            created_by
        } = data;

        // movement_type check (handled by DB ENUM, but for clarity)
        // IN, OUT, ADJUSTMENT, DAMAGE, RETURN

        const [movement] = await query('stock_movements')
            .insert({
                product_id,
                movement_type,
                reference_type,
                reference_id,
                quantity: Math.abs(quantity),
                unit_cost: unit_cost || 0,
                remaining_qty: (movement_type === 'IN' || reference_type === 'opening') ? Math.abs(quantity) : 0,
                notes,
                created_by
            })
            .returning('*');

        // Update product current_stock
        // quantity should be treated based on movement_type
        let stockDelta = 0;
        if (['IN', 'RETURN'].includes(movement_type)) {
            stockDelta = Math.abs(quantity);
        } else if (['OUT', 'DAMAGE'].includes(movement_type)) {
            stockDelta = -Math.abs(quantity);
        } else if (movement_type === 'ADJUSTMENT') {
            stockDelta = quantity; // Adjustments can be positive or negative
        }

        await query('products')
            .where('id', product_id)
            .increment('current_stock', stockDelta)
            .update({ updated_at: new Date() });

        // Update product cost_price for purchases
        if (movement_type === 'IN' && reference_type === 'purchase') {
            await query('products')
                .where('id', product_id)
                .update({ cost_price: unit_cost });
        }

        return movement;
    }

    /**
     * Get FIFO cost for a given quantity and consume stock
     * CRITICAL: Must be called within transaction to prevent race conditions
     */
    async consumeStockFifo(productId, requiredQty, trx) {
        if (!trx) throw new Error('consumeStockFifo requires a transaction');

        // Get available stock movements (IN) with remaining quantity, ordered by date (FIFO)
        const movements = await trx('stock_movements')
            .where('product_id', productId)
            .where('movement_type', 'IN')
            .where('remaining_qty', '>', 0)
            .orderBy('created_at', 'asc')
            .forUpdate()
            .select('id', 'unit_cost', 'remaining_qty');

        if (movements.length === 0) {
            const product = await trx('products').where('id', productId).first();
            return {
                avgCost: product?.cost_price || 0,
                breakdown: [],
                totalCost: 0,
                shortage: requiredQty
            };
        }

        let remainingQty = requiredQty;
        let totalCost = 0;
        const breakdown = [];

        for (const movement of movements) {
            if (remainingQty <= 0) break;

            const mvRemaining = parseFloat(movement.remaining_qty);
            const takeQty = Math.min(remainingQty, mvRemaining);
            const cost = takeQty * parseFloat(movement.unit_cost);

            totalCost += cost;
            remainingQty -= takeQty;

            breakdown.push({
                movement_id: movement.id,
                quantity: takeQty,
                unit_cost: parseFloat(movement.unit_cost),
                total_cost: cost
            });

            // Update remaining quantity in DB
            await trx('stock_movements')
                .where('id', movement.id)
                .update({ remaining_qty: mvRemaining - takeQty });
        }

        const avgCost = requiredQty > 0 ? totalCost / (requiredQty - (remainingQty > 0 ? remainingQty : 0)) : 0;

        return {
            avgCost: isNaN(avgCost) ? 0 : avgCost,
            breakdown,
            totalCost,
            shortage: remainingQty > 0 ? remainingQty : 0
        };
    }

    /**
     * Get stock by product with valuation (Current weighted average)
     */
    async getStockValuation(productId) {
        const result = await this.db('stock_movements')
            .where('product_id', productId)
            .where('movement_type', 'IN')
            .where('remaining_qty', '>', 0)
            .select(
                this.db.raw('SUM(remaining_qty) as total_qty'),
                this.db.raw('SUM(remaining_qty * unit_cost) as total_value')
            )
            .first();

        const totalQty = parseFloat(result.total_qty) || 0;
        const totalValue = parseFloat(result.total_value) || 0;

        return {
            current_stock: totalQty,
            stock_value: totalValue,
            avg_cost: totalQty > 0 ? totalValue / totalQty : 0
        };
    }

    /**
     * Create stock adjustment with approval workflow
     */
    async createAdjustment(data, userId) {
        const { product_id, adjustment_type, quantity_adjusted, reason_notes, reference_attachment_url } = data;

        return await this.db.transaction(async (trx) => {
            const [adjustment] = await trx('stock_adjustments').insert({
                product_id,
                adjustment_type,
                quantity_adjusted,
                reason_notes,
                reference_attachment_url,
                created_by: userId
            }).returning('*');

            // For now, we'll auto-approve unless specified otherwise, 
            // but the logic is there for future extension
            await this.approveAdjustment(adjustment.id, userId, trx);

            return adjustment;
        });
    }

    /**
     * Approve stock adjustment and create movement
     */
    async approveAdjustment(adjustmentId, userId, trx = null) {
        const query = trx || this.db;

        const adjustment = await query('stock_adjustments').where('id', adjustmentId).first();
        if (!adjustment || adjustment.is_approved) return;

        await query('stock_adjustments')
            .where('id', adjustmentId)
            .update({
                is_approved: true,
                approved_by: userId,
                approved_at: new Date()
            });

        // Create the actual movement
        await this.createMovement({
            product_id: adjustment.product_id,
            movement_type: 'ADJUSTMENT',
            reference_type: 'adjustment',
            reference_id: adjustmentId,
            quantity: adjustment.quantity_adjusted,
            unit_cost: 0, // Should we track cost for adjustments?
            notes: adjustment.reason_notes,
            created_by: userId
        }, query);
    }
}

module.exports = StockService;

