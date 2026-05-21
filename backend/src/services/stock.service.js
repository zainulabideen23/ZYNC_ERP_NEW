const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const LedgerService = require('./ledger.service');

class StockService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.ledgerService = new LedgerService(db, tenantId);
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

        const validMovementTypes = ['IN', 'OUT', 'ADJUSTMENT', 'DAMAGE', 'RETURN'];
        const validReferenceTypes = ['purchase', 'sale', 'adjustment', 'opening', 'damage', 'return'];

        if (!validMovementTypes.includes(movement_type)) {
            throw new AppError(`Invalid stock movement_type: ${movement_type}`, 400);
        }

        if (!validReferenceTypes.includes(reference_type)) {
            throw new AppError(`Invalid stock reference_type: ${reference_type}`, 400);
        }

        // Validate created_by is a valid UUID
        const isValidUUID = (val) => {
            if (!val || typeof val !== 'string') return false;
            const regex = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
            return regex.test(val);
        };

        if (!isValidUUID(created_by)) {
            throw new AppError(`Invalid user ID format for stock movement: ${created_by}. Must be a valid UUID.`, 400);
        }

        const numericQuantity = Number(quantity);
        if (!Number.isFinite(numericQuantity) || numericQuantity === 0) {
            throw new AppError('Stock movement quantity must be a non-zero number', 400);
        }

        const numericUnitCost = Number(unit_cost || 0);
        if (!Number.isFinite(numericUnitCost) || numericUnitCost < 0) {
            throw new AppError('unit_cost must be a valid non-negative number', 400);
        }

        const product = await query('products')
            .where({ id: product_id, tenant_id: this.tenantId, is_deleted: false })
            .first();

        if (!product) {
            throw new AppError(`Product not found: ${product_id}`, 404);
        }

        // movement_type check (handled by DB ENUM, but for clarity)
        // IN, OUT, ADJUSTMENT, DAMAGE, RETURN

        // Update product current_stock
        // quantity should be treated based on movement_type
        let stockDelta = 0;
        if (['IN', 'RETURN'].includes(movement_type)) {
            stockDelta = Math.abs(numericQuantity);
        } else if (['OUT', 'DAMAGE'].includes(movement_type)) {
            stockDelta = -Math.abs(numericQuantity);
        } else if (movement_type === 'ADJUSTMENT') {
            stockDelta = numericQuantity; // Adjustments can be positive or negative
        }

        const currentStock = Number(product.current_stock || 0);
        if (currentStock + stockDelta < -0.0001) {
            throw new AppError(
                `Insufficient stock for ${product.name}. Requested change: ${stockDelta}, available: ${currentStock}`,
                400
            );
        }

        const absoluteQuantity = Math.abs(numericQuantity);
        const remainingQty = stockDelta > 0 ? absoluteQuantity : 0;

        const [movement] = await query('stock_movements')
            .insert({
                product_id,
                movement_type,
                reference_type,
                reference_id,
                quantity: absoluteQuantity,
                unit_cost: numericUnitCost,
                remaining_qty: remainingQty,
                notes,
                created_by,
                tenant_id: this.tenantId
            })
            .returning('*');

        const updatedRows = await query('products')
            .where({ id: product_id, tenant_id: this.tenantId })
            .update({
                current_stock: query.raw('current_stock + ?', [stockDelta]),
                updated_at: new Date()
            });

        if (!updatedRows) {
            throw new AppError(`Failed to update stock for product: ${product_id}`, 500);
        }

        // Update product cost_price for purchases
        if (movement_type === 'IN' && reference_type === 'purchase') {
            await query('products')
                .where({ id: product_id, tenant_id: this.tenantId })
                .update({ cost_price: numericUnitCost });
        }

        return movement;
    }

    /**
     * Adjust stock quantity and keep FIFO integrity for negative moves.
     */
    async adjustStock(data, trx = null) {
        const query = trx || this.db;
        const {
            product_id,
            quantity,
            unit_cost = 0,
            notes,
            created_by,
            adjustment_reason = 'other',
            reference_type = 'adjustment',
            reference_id = null,
        } = data;

        const numericQuantity = Number(quantity);
        if (!Number.isFinite(numericQuantity) || numericQuantity === 0) {
            throw new AppError('Adjustment quantity must be a non-zero number', 400);
        }

        let movementType = 'ADJUSTMENT';
        let effectiveCost = Number(unit_cost || 0);
        let movementQty = numericQuantity;

        if (numericQuantity < 0) {
            const qtyToConsume = Math.abs(numericQuantity);
            const consumption = await this.consumeStockFifo(product_id, qtyToConsume, query);
            if (consumption.shortage > 0) {
                throw new AppError(`Insufficient stock to adjust. Shortage: ${consumption.shortage}`, 400);
            }

            const reason = String(adjustment_reason || '').toLowerCase();
            movementType = ['damage', 'shrinkage', 'theft'].includes(reason) ? 'DAMAGE' : 'OUT';
            movementQty = qtyToConsume;
            if (!Number.isFinite(effectiveCost) || effectiveCost <= 0) {
                effectiveCost = Number(consumption.avgCost || 0);
            }
        }

        if (!Number.isFinite(effectiveCost) || effectiveCost < 0) {
            effectiveCost = 0;
        }

        return this.createMovement({
            product_id,
            movement_type: movementType,
            reference_type,
            reference_id,
            quantity: movementQty,
            unit_cost: effectiveCost,
            notes,
            created_by,
        }, query);
    }

    /**
     * Get FIFO cost for a given quantity and consume stock
     * CRITICAL: Must be called within transaction to prevent race conditions
     */
    async consumeStockFifo(productId, requiredQty, trx) {
        if (!trx) throw new Error('consumeStockFifo requires a transaction');

        const qty = Number(requiredQty);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new AppError('requiredQty must be a positive number', 400);
        }

        // Get available stock movements (IN) with remaining quantity, ordered by date (FIFO)
        const movements = await trx('stock_movements')
            .where('product_id', productId)
            .whereIn('movement_type', ['IN', 'RETURN', 'ADJUSTMENT'])
            .where('remaining_qty', '>', 0)
            .where('tenant_id', this.tenantId)
            .orderBy('created_at', 'asc')
            .forUpdate()
            .select('id', 'unit_cost', 'remaining_qty');

        if (movements.length === 0) {
            const product = await trx('products')
                .where({ id: productId, tenant_id: this.tenantId })
                .first();
            return {
                avgCost: product?.cost_price || 0,
                breakdown: [],
                totalCost: 0,
                shortage: qty
            };
        }

        let remainingQty = qty;
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

        const consumedQty = qty - (remainingQty > 0 ? remainingQty : 0);
        const avgCost = consumedQty > 0 ? totalCost / consumedQty : 0;

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
            .where('tenant_id', this.tenantId)
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
                created_by: userId,
                tenant_id: this.tenantId
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

        // Create the actual movement with FIFO-safe negative handling
        await this.adjustStock({
            product_id: adjustment.product_id,
            quantity: adjustment.quantity_adjusted,
            unit_cost: 0,
            notes: adjustment.reason_notes,
            created_by: userId,
            adjustment_reason: adjustment.adjustment_type,
            reference_type: 'adjustment',
            reference_id: adjustmentId,
        }, query);

        // For negative adjustments (stock reduction/write-offs), create GL journal entry
        if (adjustment.quantity_adjusted < 0) {
            await this.createWriteOffJournal(adjustment, query, userId);
        }
    }

    /**
     * Create GL journal entry for inventory write-offs
     * Debit: Inventory Loss (6004)
     * Credit: Inventory (1004)
     */
    async createWriteOffJournal(adjustment, trx, userId) {
        const adjustmentQty = Math.abs(adjustment.quantity_adjusted);

        // Get product to calculate write-off value
        const product = await trx('products')
            .where({ id: adjustment.product_id, tenant_id: this.tenantId })
            .first();
        const writeOffValue = adjustmentQty * (product?.cost_price || 0);

        if (writeOffValue <= 0) return;

        // Resolve required accounts
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.INVENTORY_LOSS,
            SYSTEM_ACCOUNTS.INVENTORY,
        ]);

        await this.ledgerService.createJournalEntry({
            journal_date: new Date(),
            transaction_type: 'adjustment',
            reference_type: 'adjustment',
            reference_id: adjustment.id,
            narration: `Stock Write-Off: ${product?.name || 'Product'} - ${adjustment.reason_notes || 'Adjustment'}`,
            entries: [
                {
                    account_id: accountIds[SYSTEM_ACCOUNTS.INVENTORY_LOSS],
                    entry_type: 'debit',
                    amount: writeOffValue,
                    narration: `Inventory Loss: ${product?.name || 'Product'}`,
                },
                {
                    account_id: accountIds[SYSTEM_ACCOUNTS.INVENTORY],
                    entry_type: 'credit',
                    amount: writeOffValue,
                    narration: `Stock Write-Off: ${product?.name || 'Product'}`,
                },
            ],
            created_by: userId,
        }, trx);
    }
}

module.exports = StockService;

