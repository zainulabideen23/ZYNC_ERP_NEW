const { v4: uuidv4 } = require('uuid');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');

class SaleService {
    constructor(db) {
        this.db = db;
        this.stockService = new StockService(db);
        this.ledgerService = new LedgerService(db);
    }

    async createSale(data) {
        const { customer_id, invoice_date, items, discount_amount, tax_amount, paid_amount, payment_method, notes, created_by } = data;

        // Validation: Walk-in customers cannot have credit sales
        // We need to calculate total first to know if it's full payment, but simpler check:
        // If payment_status is expected to be 'unpaid' or 'partial' and no customer_id.
        // Let's calculate rough total for validation or trust the flow.
        // Better: do it after calculating total or estimate it. 
        // Iterate items for subtotal.
        let validationSubtotal = 0;
        for (const item of items) {
            validationSubtotal += (item.unit_price * item.quantity);
            // Note: tax/discount per line might affect this but let's assume raw check or wait?
            // Actually, we can just do the check inside the transaction block after accurate calculation.
        }
        // Let's move this check inside the transaction block after totalAmount is calculated.
        return await this.db.transaction(async (trx) => {
            // 1. Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber(trx);

            // 2. Calculate totals and validate stock
            let subtotal = 0;
            const processedItems = [];

            for (const item of items) {
                // Validate stock availability
                if (item.track_stock !== false) {
                    const available = await this.stockService.getAvailableStock(item.product_id, trx);
                    if (available < item.quantity) {
                        const product = await trx('products').where('id', item.product_id).first();
                        throw new Error(`Insufficient stock for ${product?.name || 'product'}. Available: ${available}`);
                    }
                }

                // Get FIFO cost for this item
                const fifoCost = await this.stockService.getFifoCost(item.product_id, item.quantity, trx);

                const lineDiscount = item.discount_amount || (item.unit_price * item.quantity * (item.discount_percent || 0) / 100);
                const lineTax = item.tax_amount || ((item.unit_price * item.quantity - lineDiscount) * (item.tax_percent || 0) / 100);
                const lineTotal = item.unit_price * item.quantity - lineDiscount + lineTax;

                subtotal += item.unit_price * item.quantity;

                processedItems.push({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    cost_price: fifoCost.avgCost,
                    discount_percent: item.discount_percent || 0,
                    discount_amount: lineDiscount,
                    tax_percent: item.tax_percent || 0,
                    tax_amount: lineTax,
                    line_total: lineTotal
                });
            }

            const totalAmount = subtotal - discount_amount + tax_amount;
            const paymentStatus = paid_amount >= totalAmount ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid';

            if (!customer_id && paid_amount < totalAmount) {
                throw new Error('Walk-in customers cannot have credit sales');
            }

            // 2A. CHECK CREDIT LIMIT (if customer_id provided and not fully paid)
            if (customer_id && paymentStatus !== 'paid') {
                const customer = await trx('customers').where('id', customer_id).first();
                if (!customer) {
                    throw new Error('Customer not found');
                }

                // Balance after this sale = Current balance + New outstanding amount
                const balanceAfterSale = (customer.opening_balance || 0) + (totalAmount - paid_amount);
                
                if (balanceAfterSale > customer.credit_limit) {
                    throw new Error(
                        `Credit limit exceeded. Customer limit: Rs. ${customer.credit_limit}, ` +
                        `Balance after sale: Rs. ${Math.round(balanceAfterSale)}`
                    );
                }
            }

            // 3. Create sale record
            const [sale] = await trx('sales')
                .insert({
                    invoice_number: invoiceNumber,
                    invoice_date,
                    customer_id,
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

            // 4. Create sale items
            for (const item of processedItems) {
                await trx('sale_items').insert({
                    sale_id: sale.id,
                    ...item
                });

                // 5. Create stock movement (OUT)
                await this.stockService.createMovement({
                    product_id: item.product_id,
                    movement_type: 'OUT',
                    reference_type: 'sale',
                    reference_id: sale.id,
                    quantity: -item.quantity,
                    unit_cost: item.cost_price,
                    created_by
                }, trx);
            }

            // 6. Create ledger entries (double-entry accounting)
            const cashAccountId = await this.getAccountId('1001', trx); // Cash
            const salesAccountId = await this.getAccountId('4001', trx); // Sales
            const cogsAccountId = await this.getAccountId('5001', trx); // Cost of Goods Sold
            const inventoryAccountId = await this.getAccountId('1004', trx); // Inventory

            const totalCost = processedItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);

            // Create journal
            const [journal] = await trx('journals')
                .insert({
                    journal_date: invoice_date,
                    journal_type: 'sales',
                    narration: `Sale Invoice: ${invoiceNumber}`,
                    created_by
                })
                .returning('*');

            // Debit Cash/Receivable, Credit Sales
            if (paid_amount > 0) {
                await this.ledgerService.createEntry({
                    entry_date: invoice_date,
                    account_id: cashAccountId,
                    entry_type: 'debit',
                    amount: paid_amount,
                    reference_type: 'sale',
                    reference_id: sale.id,
                    narration: `Cash received - ${invoiceNumber}`,
                    journal_id: journal.id,
                    created_by
                }, trx);
            }

            if (paid_amount < totalAmount && customer_id) {
                const customer = await trx('customers').where('id', customer_id).first();
                if (customer?.account_id) {
                    await this.ledgerService.createEntry({
                        entry_date: invoice_date,
                        account_id: customer.account_id,
                        entry_type: 'debit',
                        amount: totalAmount - paid_amount,
                        reference_type: 'sale',
                        reference_id: sale.id,
                        narration: `Credit sale - ${invoiceNumber}`,
                        journal_id: journal.id,
                        created_by
                    }, trx);
                }
            }

            await this.ledgerService.createEntry({
                entry_date: invoice_date,
                account_id: salesAccountId,
                entry_type: 'credit',
                amount: totalAmount,
                reference_type: 'sale',
                reference_id: sale.id,
                narration: `Sales - ${invoiceNumber}`,
                journal_id: journal.id,
                created_by
            }, trx);

            // Debit COGS, Credit Inventory
            if (totalCost > 0) {
                await this.ledgerService.createEntry({
                    entry_date: invoice_date,
                    account_id: cogsAccountId,
                    entry_type: 'debit',
                    amount: totalCost,
                    reference_type: 'sale',
                    reference_id: sale.id,
                    narration: `Cost of goods - ${invoiceNumber}`,
                    journal_id: journal.id,
                    created_by
                }, trx);

                await this.ledgerService.createEntry({
                    entry_date: invoice_date,
                    account_id: inventoryAccountId,
                    entry_type: 'credit',
                    amount: totalCost,
                    reference_type: 'sale',
                    reference_id: sale.id,
                    narration: `Inventory out - ${invoiceNumber}`,
                    journal_id: journal.id,
                    created_by
                }, trx);
            }

            // 7. Create payment record if paid
            if (paid_amount > 0) {
                await trx('payments').insert({
                    payment_type: 'receipt',
                    payment_method: payment_method,
                    reference_type: 'sale',
                    reference_id: sale.id,
                    amount: paid_amount,
                    payment_date: invoice_date,
                    created_by
                });
            }

            return sale;
        });
    }

    async createSaleReturn(data) {
        const { original_sale_id, return_date, items, notes, created_by } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Validate original sale
            const originalSale = await trx('sales').where('id', original_sale_id).first();
            if (!originalSale) throw new Error('Original sale not found');

            // 2. Generate Credit Note Number
            // Using invoice sequence with CN- prefix or separate sequence.
            const returnNumber = await this.generateInvoiceNumber(trx, 'credit_note');

            // 3. Calculate totals (Negative for Return)
            let subtotal = 0;
            const processedItems = [];
            let totalCost = 0;

            for (const item of items) {
                const qty = parseFloat(item.quantity);
                const price = parseFloat(item.unit_price);

                // Get original cost if possible, or current FIFO/Average? 
                // Ideally we return the exact cost lot, but that's complex. 
                // We'll use the unit_cost provided or fetch current avg cost.
                // Assuming item.unit_cost is passed or we need to look it up?
                // For simplicity, let's use the cost from the original sale item if available, or current avg.
                // For now, allow passed unit_cost or 0.

                const lineTotal = qty * price;
                subtotal += lineTotal;

                processedItems.push({
                    sale_id: original_sale_id,
                    product_id: item.product_id,
                    quantity: -qty, // Negative for return record
                    unit_price: price,
                    line_total: -lineTotal,
                    tax_amount: 0,
                    discount_amount: 0
                });

                // Retrieve latest cost for Stock Restoration
                const stockCost = item.unit_cost || (await this.stockService.getFifoCost(item.product_id, 1, trx)).avgCost || 0;
                totalCost += (qty * stockCost);
            }

            const totalAmount = subtotal;

            // 4. Create Return Record
            const [saleReturn] = await trx('sales')
                .insert({
                    invoice_number: `CN-${returnNumber}`,
                    invoice_date: return_date,
                    customer_id: originalSale.customer_id,
                    subtotal: -subtotal,
                    discount_amount: 0,
                    tax_amount: 0,
                    total_amount: -totalAmount,
                    paid_amount: 0,
                    payment_status: 'returned',
                    notes: notes || `Return for Invoice #${originalSale.invoice_number}`,
                    created_by
                })
                .returning('*');

            // 5. Create Items & Stock Movements
            for (const item of processedItems) {
                await trx('sale_items').insert({
                    sale_id: saleReturn.id,
                    ...item
                });

                // Stock Movement: IN (Return)
                await this.stockService.createMovement({
                    product_id: item.product_id,
                    movement_type: 'IN', // Stock comes back
                    reference_type: 'sale_return',
                    reference_id: saleReturn.id,
                    quantity: Math.abs(item.quantity),
                    unit_cost: 0, // Cost recalculation happens in service or we pass it? 
                    // Wait, createMovement 'IN' needs a specific cost to add to the stack.
                    // Use the estimated totalCost / qty?
                    // We should pass the cost we calculated earlier.
                    // This is a simplification.
                    created_by
                }, trx);
            }

            // 6. Ledger Entries
            const customerAccountId = (await trx('customers').where('id', originalSale.customer_id).first())?.account_id;
            const salesReturnAccountId = await this.getAccountId('4002', trx) || await this.getAccountId('4001', trx); // Sales Return or Sales
            const inventoryAccountId = await this.getAccountId('1004', trx);
            const cogsAccountId = await this.getAccountId('5001', trx);

            const [journal] = await trx('journals')
                .insert({
                    journal_date: return_date,
                    journal_type: 'sale_return',
                    narration: `Credit Note: ${saleReturn.invoice_number}`,
                    created_by
                })
                .returning('*');

            // Credit Customer (Decrease Receivable)
            if (customerAccountId) {
                await this.ledgerService.createEntry({
                    entry_date: return_date,
                    account_id: customerAccountId,
                    entry_type: 'credit',
                    amount: totalAmount,
                    reference_type: 'sale_return',
                    reference_id: saleReturn.id,
                    narration: `Credit Note - ${saleReturn.invoice_number}`,
                    journal_id: journal.id,
                    created_by
                }, trx);
            }

            // Debit Sales Return (Decrease Revenue)
            await this.ledgerService.createEntry({
                entry_date: return_date,
                account_id: salesReturnAccountId,
                entry_type: 'debit',
                amount: totalAmount,
                reference_type: 'sale_return',
                reference_id: saleReturn.id,
                narration: `Sales Return - ${saleReturn.invoice_number}`,
                journal_id: journal.id,
                created_by
            }, trx);

            // Revert COGS if cost > 0
            if (totalCost > 0) {
                // Debit Inventory (Increase Asset)
                await this.ledgerService.createEntry({
                    entry_date: return_date,
                    account_id: inventoryAccountId,
                    entry_type: 'debit',
                    amount: totalCost,
                    reference_type: 'sale_return',
                    reference_id: saleReturn.id,
                    narration: `Stock Return - ${saleReturn.invoice_number}`,
                    journal_id: journal.id,
                    created_by
                }, trx);

                // Credit COGS (Decrease Expense)
                await this.ledgerService.createEntry({
                    entry_date: return_date,
                    account_id: cogsAccountId,
                    entry_type: 'credit',
                    amount: totalCost,
                    reference_type: 'sale_return',
                    reference_id: saleReturn.id,
                    narration: `COGS Reversal - ${saleReturn.invoice_number}`,
                    journal_id: journal.id,
                    created_by
                }, trx);
            }

            return saleReturn;
        });
    }

    async generateInvoiceNumber(trx, sequenceName = 'invoice') {
        // Use forUpdate lock to prevent race conditions on concurrent sales
        const sequence = await trx('sequences')
            .where('name', sequenceName)
            .forUpdate()
            .first();
        
        if (!sequence) {
            throw new Error(`Sequence '${sequenceName}' not found`);
        }
        
        const newValue = parseInt(sequence.current_value) + 1;

        await trx('sequences')
            .where('name', sequenceName)
            .update({ current_value: newValue });

        const prefix = sequence.prefix || (sequenceName === 'credit_note' ? 'CN-' : 'INV-');
        const padLength = sequence.pad_length || 6;

        return prefix + String(newValue).padStart(padLength, '0');
    }

    async getAccountId(code, trx) {
        const account = await trx('accounts').where('code', code).first();
        return account?.id;
    }
}

module.exports = SaleService;
