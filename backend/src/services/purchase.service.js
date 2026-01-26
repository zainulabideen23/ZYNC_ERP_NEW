const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');

class PurchaseService {
    constructor(db) {
        this.db = db;
        this.stockService = new StockService(db);
        this.ledgerService = new LedgerService(db);
    }

    async createPurchase(data) {
        const { supplier_id, bill_date, reference_number, items, discount_amount, tax_amount, paid_amount, payment_method, notes, created_by } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Generate bill number
            const billNumber = await this.generateBillNumber(trx);

            // 2. Calculate totals
            let subtotal = 0;
            const processedItems = [];

            for (const item of items) {
                const lineDiscount = item.discount_amount || (item.unit_cost * item.quantity * (item.discount_percent || 0) / 100);
                const lineTax = item.tax_amount || ((item.unit_cost * item.quantity - lineDiscount) * (item.tax_percent || 0) / 100);
                const lineTotal = item.unit_cost * item.quantity - lineDiscount + lineTax;

                subtotal += item.unit_cost * item.quantity;

                processedItems.push({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    discount_percent: item.discount_percent || 0,
                    discount_amount: lineDiscount,
                    tax_percent: item.tax_percent || 0,
                    tax_amount: lineTax,
                    line_total: lineTotal
                });
            }

            const totalAmount = subtotal - discount_amount + tax_amount;
            const paymentStatus = paid_amount >= totalAmount ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid';

            // 3. Create purchase record
            const [purchase] = await trx('purchases')
                .insert({
                    bill_number: billNumber,
                    bill_date,
                    supplier_id,
                    reference_number,
                    subtotal,
                    discount_amount,
                    tax_amount,
                    total_amount: totalAmount,
                    paid_amount,
                    payment_status: paymentStatus,
                    notes,
                    created_by
                })
                .returning('*');

            // 4. Create purchase items and stock movements
            for (const item of processedItems) {
                await trx('purchase_items').insert({
                    purchase_id: purchase.id,
                    ...item
                });

                // Create stock movement (IN)
                await this.stockService.createMovement({
                    product_id: item.product_id,
                    movement_type: 'IN',
                    reference_type: 'purchase',
                    reference_id: purchase.id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    created_by
                }, trx);
            }

            // 5. Create ledger entries
            const cashAccountId = await this.getAccountId('1001', trx);
            const payablesAccountId = await this.getAccountId('2001', trx);
            const inventoryAccountId = await this.getAccountId('1004', trx);

            const [journal] = await trx('journals')
                .insert({
                    journal_date: bill_date,
                    journal_type: 'purchase',
                    narration: `Purchase Bill: ${billNumber}`,
                    created_by
                })
                .returning('*');

            // Debit Inventory
            await this.ledgerService.createEntry({
                entry_date: bill_date,
                account_id: inventoryAccountId,
                entry_type: 'debit',
                amount: totalAmount,
                reference_type: 'purchase',
                reference_id: purchase.id,
                narration: `Inventory - ${billNumber}`,
                journal_id: journal.id,
                created_by
            }, trx);

            // Credit Cash if paid
            if (paid_amount > 0) {
                await this.ledgerService.createEntry({
                    entry_date: bill_date,
                    account_id: cashAccountId,
                    entry_type: 'credit',
                    amount: paid_amount,
                    reference_type: 'purchase',
                    reference_id: purchase.id,
                    narration: `Payment - ${billNumber}`,
                    journal_id: journal.id,
                    created_by
                }, trx);
            }

            // Credit Payables for remaining
            if (paid_amount < totalAmount) {
                const supplierAccountId = supplier_id
                    ? (await trx('suppliers').where('id', supplier_id).first())?.account_id
                    : payablesAccountId;

                await this.ledgerService.createEntry({
                    entry_date: bill_date,
                    account_id: supplierAccountId || payablesAccountId,
                    entry_type: 'credit',
                    amount: totalAmount - paid_amount,
                    reference_type: 'purchase',
                    reference_id: purchase.id,
                    narration: `Payable - ${billNumber}`,
                    journal_id: journal.id,
                    created_by
                }, trx);
            }

            // 6. Create payment record if paid
            if (paid_amount > 0) {
                await trx('payments').insert({
                    payment_type: 'payment',
                    payment_method,
                    reference_type: 'purchase',
                    reference_id: purchase.id,
                    amount: paid_amount,
                    payment_date: bill_date,
                    created_by
                });
            }

            return purchase;
        });
    }

    async generateBillNumber(trx, sequenceName = 'purchase') {
        const sequence = await trx('sequences').where('name', sequenceName).first();
        const newValue = (sequence?.current_value || 0) + 1;

        if (sequence) {
             await trx('sequences')
            .where('name', sequenceName)
            .update({ current_value: newValue });
        }

        const prefix = sequence?.prefix || (sequenceName === 'debit_note' ? 'DN-' : 'PUR-');
        const padLength = sequence?.pad_length || 6;

        return prefix + String(newValue).padStart(padLength, '0');
    }

    async createPurchaseReturn(data) {
        const { original_purchase_id, return_date, items, notes, created_by } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Get original purchase
            const originalPurchase = await trx('purchases').where('id', original_purchase_id).first();
            if (!originalPurchase) throw new Error('Original purchase not found');

            // 2. Generate Debit Note Number
            // We use the same purchase sequence but maybe with specific prefix if needed, 
            // or just a new sequence for 'debit_note' if we had one. 
            // For now, let's use the purchase sequence but maybe append -RET or just use it.
            // Better: use a separate sequence for returns/debit notes if possible, or share.
            // Let's reuse purchase sequence for simplicity but mark as returned.
            const returnNumber = await this.generateBillNumber(trx);

            // 3. Calculate totals (Negative for Return)
            let subtotal = 0;
            let totalTax = 0;
            let totalDiscount = 0;
            const processedItems = [];

            for (const item of items) {
                // item: { product_id, quantity, unit_cost }
                // Quantity should be positive in input, but we treat it as return
                const qty = parseFloat(item.quantity);
                const cost = parseFloat(item.unit_cost);

                // Proportionate tax/discount from original? 
                // For simplicity, we assume we return at the cost we bought, no complex tax calc for now unless provided.
                // We'll calculate simple line total.

                const lineTotal = qty * cost;
                subtotal += lineTotal;

                processedItems.push({
                    product_id: item.product_id,
                    quantity: -qty, // Negative quantity for return record
                    unit_cost: cost,
                    line_total: -lineTotal,
                    tax_amount: 0, // Simplify for now
                    discount_amount: 0 // Simplify for now
                });
            }

            const totalAmount = subtotal; // Negative logic applied below

            // 4. Create Return Record (Negative Values)
            const [purchaseReturn] = await trx('purchases')
                .insert({
                    bill_number: `DN-${returnNumber}`, // Debit Note prefix
                    bill_date: return_date,
                    supplier_id: originalPurchase.supplier_id,
                    reference_number: originalPurchase.bill_number, // Reference original bill
                    subtotal: -subtotal,
                    discount_amount: 0,
                    tax_amount: 0,
                    total_amount: -totalAmount,
                    paid_amount: 0, // Usually adjusted against balance, not cash back immediately
                    payment_status: 'returned', // New status
                    notes: notes || `Return for Bill #${originalPurchase.bill_number}`,
                    created_by
                })
                .returning('*');

            // 5. Create Items & Stock Movements
            for (const item of processedItems) {
                await trx('purchase_items').insert({
                    purchase_id: purchaseReturn.id,
                    ...item
                });

                // Stock Movement: OUT (Return)
                // We send POSITIVE quantity to stock service with type 'OUT'
                await this.stockService.createMovement({
                    product_id: item.product_id,
                    movement_type: 'OUT',
                    reference_type: 'purchase_return',
                    reference_id: purchaseReturn.id,
                    quantity: Math.abs(item.quantity), // Stock service expects positive qty for movement
                    unit_cost: item.unit_cost,
                    created_by
                }, trx);
            }

            // 6. Ledger Entries
            // Debit Supplier (Decrease Liability) -> handled by negative Credit if we reuse logic?
            // Let's be explicit for Returns to avoid confusion.

            const inventoryAccountId = await this.getAccountId('1004', trx);
            const supplierAccountId = (await trx('suppliers').where('id', originalPurchase.supplier_id).first())?.account_id
                || await this.getAccountId('2001', trx); // Default Payables

            const [journal] = await trx('journals')
                .insert({
                    journal_date: return_date,
                    journal_type: 'purchase_return',
                    narration: `Debit Note: ${purchaseReturn.bill_number}`,
                    created_by
                })
                .returning('*');

            // Debit Supplier (Decrease Payable)
            await this.ledgerService.createEntry({
                entry_date: return_date,
                account_id: supplierAccountId,
                entry_type: 'debit',
                amount: totalAmount, // Positive amount for Debit
                reference_type: 'purchase_return',
                reference_id: purchaseReturn.id,
                narration: `Debit Note - ${purchaseReturn.bill_number}`,
                journal_id: journal.id,
                created_by
            }, trx);

            // Credit Inventory (Decrease Asset)
            await this.ledgerService.createEntry({
                entry_date: return_date,
                account_id: inventoryAccountId,
                entry_type: 'credit',
                amount: totalAmount, // Positive amount for Credit
                reference_type: 'purchase_return',
                reference_id: purchaseReturn.id,
                narration: `Inventory Return - ${purchaseReturn.bill_number}`,
                journal_id: journal.id,
                created_by
            }, trx);

            return purchaseReturn;
        });
    }

    async getAccountId(code, trx) {
        const account = await trx('accounts').where('code', code).first();
        return account?.id;
    }
}

module.exports = PurchaseService;
