class StockService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a stock movement record
     * All stock changes MUST go through this method
     */
    async createMovement(data, trx = null) {
        const query = trx || this.db;
        const { product_id, movement_type, reference_type, reference_id, quantity, unit_cost, notes, created_by } = data;

        const [movement] = await query('stock_movements')
            .insert({
                product_id,
                movement_type,
                reference_type,
                reference_id,
                quantity,
                unit_cost,
                remaining_qty: movement_type === 'IN' ? Math.abs(quantity) : null,
                notes,
                created_by
            })
            .returning('*');

        // Update product cost_price for purchases
        if (movement_type === 'IN' && reference_type === 'purchase') {
            await query('products')
                .where('id', product_id)
                .update({ cost_price: unit_cost, updated_at: new Date() });
        }

        return movement;
    }

    /**
     * Get current available stock for a product
     */
    async getAvailableStock(productId, trx = null) {
        const query = trx || this.db;

        const result = await query('stock_movements')
            .where('product_id', productId)
            .sum('quantity as total')
            .first();

        return parseFloat(result.total) || 0;
    }

    /**
     * Get FIFO cost for a given quantity
     * Returns the weighted average cost based on FIFO
     * CRITICAL: Must be called within transaction to prevent race conditions
     */
    async getFifoCost(productId, requiredQty, trx = null) {
        const query = trx || this.db;

        // Get available stock movements (IN) with remaining quantity, ordered by date (FIFO)
        // Lock rows for update if using transaction
        let movementQuery = query('stock_movements')
            .where('product_id', productId)
            .where('movement_type', 'IN')
            .whereRaw('remaining_qty > 0')
            .orderBy('created_at', 'asc')
            .select('id', 'unit_cost', 'remaining_qty');

        // Use row-level locking if in transaction
        if (trx) {
            movementQuery = movementQuery.forUpdate();
        }

        const movements = await movementQuery;

        if (movements.length === 0) {
            // No stock available
            const product = await query('products').where('id', productId).first();
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
        const updates = []; // Collect updates for batch processing

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

            // Queue update for remaining quantity
            updates.push({
                id: movement.id,
                newRemaining: mvRemaining - takeQty
            });
        }

        // Apply all remaining_qty updates
        for (const update of updates) {
            await query('stock_movements')
                .where('id', update.id)
                .update({ remaining_qty: update.newRemaining });
        }

        const avgCost = requiredQty > 0 ? totalCost / requiredQty : 0;

        return { 
            avgCost, 
            breakdown, 
            totalCost,
            shortage: remainingQty > 0 ? remainingQty : 0  // Report if insufficient stock
        };
    }

    /**
     * Get stock by product with valuation
     */
    async getStockWithValuation(productId, trx = null) {
        const query = trx || this.db;

        const stock = await this.getAvailableStock(productId, query);

        const valuation = await query('stock_movements')
            .where('product_id', productId)
            .where('movement_type', 'IN')
            .where('remaining_qty', '>', 0)
            .select(
                query.raw('SUM(remaining_qty) as total_qty'),
                query.raw('SUM(remaining_qty * unit_cost) as total_value')
            )
            .first();

        return {
            product_id: productId,
            current_stock: stock,
            stock_value: parseFloat(valuation.total_value) || 0,
            avg_cost: valuation.total_qty > 0 ? valuation.total_value / valuation.total_qty : 0
        };
    }

    /**
     * Adjust stock (for corrections, opening stock, etc.)
     */
    async adjustStock(data, trx = null) {
        const { product_id, quantity, unit_cost, notes, created_by } = data;

        const movementType = quantity >= 0 ? 'IN' : 'OUT';

        return await this.createMovement({
            product_id,
            movement_type: movementType,
            reference_type: 'adjustment',
            quantity: Math.abs(quantity) * (quantity >= 0 ? 1 : -1),
            unit_cost: unit_cost || 0,
            notes,
            created_by
        }, trx);
    }

    /**
     * Add opening stock
     */
    async addOpeningStock(data, trx = null) {
        const { product_id, quantity, unit_cost, created_by } = data;

        return await this.createMovement({
            product_id,
            movement_type: 'IN',
            reference_type: 'opening',
            quantity,
            unit_cost,
            notes: 'Opening stock',
            created_by
        }, trx);
    }
}

module.exports = StockService;
