const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');

class SaleService {
    constructor(db) {
        this.db = db;
        this.stockService = new StockService(db);
        this.ledgerService = new LedgerService(db);
    }

    /**
     * Create a new sale with stock update and ledger entries
     */
    async createSale(data, userId) {
        const {
            customer_id,
            sale_date,
            items,
            discount_amount = 0,
            discount_percentage = 0,
            tax_amount = 0,
            amount_paid = 0,
            payment_method = 'cash',
            notes
        } = data;

        // Retry loop for unique constraint violations (sequence out of sync)
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                return await this.db.transaction(async (trx) => {
                    // 1. Generate Invoice Number
                    const invoiceNumber = await this.generateInvoiceNumber(trx);

                    // 2. Process Items and Validate Stock
                    let subtotal = 0;
                    const processedItems = [];
                    let totalCogs = 0;

                    for (const item of items) {
                        const product = await trx('products').where('id', item.product_id).first();
                        if (!product) throw new AppError(`Product not found: ${item.product_id}`, 404);

                        // Consumed Stock via FIFO
                        const consumption = await this.stockService.consumeStockFifo(item.product_id, item.quantity, trx);
                        if (consumption.shortage > 0) {
                            throw new AppError(`Insufficient stock for ${product.name}. Shortage: ${consumption.shortage}`, 400);
                        }

                        const lineTotal = (item.quantity * item.unit_price) - (item.line_discount || 0);
                        subtotal += (item.quantity * item.unit_price);
                        totalCogs += consumption.totalCost;

                        processedItems.push({
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            line_discount: item.line_discount || 0,
                            tax_rate: item.tax_rate || 0,
                            line_total: lineTotal,
                            cost_price: consumption.avgCost, // Store avg cost for this sale line
                            created_by: userId
                        });

                        // Create Stock Movement (OUT)
                        await this.stockService.createMovement({
                            product_id: item.product_id,
                            movement_type: 'OUT',
                            reference_type: 'sale',
                            quantity: item.quantity,
                            unit_cost: consumption.avgCost,
                            notes: `Sale ${invoiceNumber}`,
                            created_by: userId
                        }, trx);
                    }

                    const totalAmount = (subtotal - discount_amount) + tax_amount;

                    // Handle overpayment: calculate amount_due and return_to_customer
                    let amountDue = totalAmount - amount_paid;
                    let returnToCustomer = 0;

                    // If customer paid more than total, they get change back
                    if (amountDue < 0) {
                        returnToCustomer = Math.abs(amountDue);
                        amountDue = 0; // No amount due, sale is fully paid
                    }

                    const status = amountDue <= 0 ? 'completed' : 'confirmed';

                    // 3. CREDIT LIMIT CHECK
                    if (customer_id && amountDue > 0) {
                        const customer = await trx('customers').where('id', customer_id).forUpdate().first();
                        if (customer.current_credit_used + amountDue > customer.credit_limit) {
                            throw new AppError(`Credit limit exceeded for ${customer.name}. Available: ${customer.credit_limit - customer.current_credit_used}`, 400);
                        }

                        // Update customer credit/balance
                        await trx('customers')
                            .where('id', customer_id)
                            .increment('current_credit_used', amountDue)
                            .increment('current_balance', amountDue);
                    }

                    // 4. Create Sale Record
                    const [sale] = await trx('sales').insert({
                        invoice_number: invoiceNumber,
                        customer_id: customer_id || null,
                        sale_date: sale_date || new Date(),
                        subtotal,
                        discount_amount,
                        discount_percentage,
                        tax_amount,
                        total_amount: totalAmount,
                        payment_method,
                        amount_paid,
                        amount_due: amountDue,
                        return_to_customer: returnToCustomer,
                        status,
                        notes,
                        created_by: userId
                    }).returning('*');

                    // 5. Create Sale Items
                    for (const item of processedItems) {
                        await trx('sale_items').insert({
                            sale_id: sale.id,
                            ...item
                        });
                    }

                    // 6. ACCOUNTING: Journal & Ledger Entries
                    const accounts = await this.getRequiredAccounts(trx);

                    const journalEntries = [
                        // Credit Sales (Revenue)
                        { account_id: accounts.sales, entry_type: 'credit', amount: subtotal, narration: `Sale ${invoiceNumber}` },
                        // Debit COGS (Expense)
                        { account_id: accounts.cogs, entry_type: 'debit', amount: totalCogs, narration: `COGS ${invoiceNumber}` },
                        // Credit Inventory (Asset)
                        { account_id: accounts.inventory, entry_type: 'credit', amount: totalCogs, narration: `Inventory Out ${invoiceNumber}` }
                    ];

                    // Handle Tax
                    if (tax_amount > 0) {
                        journalEntries.push({ account_id: accounts.tax_payable, entry_type: 'credit', amount: tax_amount, narration: `Tax on ${invoiceNumber}` });
                    }

                    // Handle Discount
                    if (discount_amount > 0) {
                        journalEntries.push({ account_id: accounts.discount_allowed, entry_type: 'debit', amount: discount_amount, narration: `Discount on ${invoiceNumber}` });
                    }

                    // Handle Payment & Receivables
                    // Note: When customer overpays, we receive amount_paid but return returnToCustomer as change
                    // Net cash received = amount_paid - returnToCustomer = totalAmount (when fully paid)
                    if (amount_paid > 0) {
                        const paymentAccount = payment_method === 'cash' ? accounts.cash : accounts.bank;
                        // Debit cash/bank for the NET amount received (after giving change)
                        const netPaymentReceived = amount_paid - returnToCustomer;
                        if (netPaymentReceived > 0) {
                            journalEntries.push({ account_id: paymentAccount, entry_type: 'debit', amount: netPaymentReceived, narration: `Payment for ${invoiceNumber}` });
                        }
                    }

                    if (amountDue > 0 && customer_id) {
                        const customer = await trx('customers').where('id', customer_id).select('account_id').first();
                        journalEntries.push({ account_id: customer.account_id, entry_type: 'debit', amount: amountDue, narration: `Receivable ${invoiceNumber}`, reference_id: sale.id });
                    }

                    await this.ledgerService.createJournalEntry({
                        journal_date: sale.sale_date,
                        transaction_type: 'sale',
                        narration: `Sale Invoice ${invoiceNumber}`,
                        entries: journalEntries,
                        created_by: userId
                    }, trx);

                    return sale;
                });
            } catch (error) {
                // Check for unique key violation on invoice_number
                if (error.code === '23505' && error.constraint === 'sales_invoice_number_key') {
                    attempts++;
                    console.warn(`Duplicate invoice number detected. Retrying attempt ${attempts}/${maxAttempts}...`);

                    // Attempt to repair sequence
                    try {
                        const maxResult = await this.db.raw(`SELECT COALESCE(MAX(CAST(REPLACE(invoice_number, 'SINV-', '') AS INTEGER)), 0) as max_num FROM sales`);
                        const maxNum = maxResult.rows[0].max_num;
                        // Update sequence to max + 1 to force next attempts to be safe (or logic in generateInvoiceNumber will take care)
                        // Actually generateInvoiceNumber takes current_value + 1. So we set current_value = maxNum
                        await this.db('sequences').where('name', 'invoice').update({ current_value: maxNum });
                    } catch (syncError) {
                        console.error('Failed to sync sequence during retry:', syncError);
                    }

                    if (attempts === maxAttempts) throw new AppError('Failed to generate unique invoice number after multiple attempts', 500);
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Generate next invoice number
     */
    async generateInvoiceNumber(trx) {
        const sequence = await trx('sequences').where('name', 'invoice').forUpdate().first();
        if (!sequence) throw new AppError('Invoice sequence not found', 500);

        const nextVal = sequence.current_value + 1;
        await trx('sequences').where('name', 'invoice').update({ current_value: nextVal });

        return `${sequence.prefix}${nextVal.toString().padStart(sequence.pad_length || 6, '0')}`;
    }

    /**
     * Get system accounts needed for sales
     */
    async getRequiredAccounts(trx) {
        const codes = ['1001', '1002', '1004', '1201', '2001', '4001', '5001'];
        // Generic lookup for others or use specific system flags
        const accounts = await trx('accounts').whereIn('code', codes).select('id', 'code');

        const map = accounts.reduce((acc, a) => ({ ...acc, [a.code]: a.id }), {});

        // Find Tax and Discount accounts (usually expense/liability)
        // For now, mapping to COGS/Expense if not found or using default codes if I created them
        return {
            cash: map['1001'],
            bank: map['1002'],
            inventory: map['1004'],
            receivables: map['1201'],
            sales: map['4001'],
            cogs: map['5001'],
            tax_payable: map['2001'], // Use payables as simple tax proxy for now or create specific
            discount_allowed: map['5001'] // Proxy
        };
    }

    /**
     * List sales with pagination
     */
    async list(params) {
        const { page = 1, limit = 50, from_date, to_date, customer_id, status } = params;
        const offset = (page - 1) * limit;

        let query = this.db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .leftJoin('users as u', 's.created_by', 'u.id')
            .select('s.*', 'c.name as customer_name', 'c.phone_number as customer_phone', 'u.full_name as created_by_name')
            .where('s.is_deleted', false);

        if (status) query = query.where('s.status', status);
        if (customer_id) query = query.where('s.customer_id', customer_id);
        if (from_date) query = query.where('s.sale_date', '>=', from_date);
        if (to_date) query = query.where('s.sale_date', '<=', to_date);

        const countQuery = this.db('sales').where('is_deleted', false);
        if (status) countQuery.where('status', status);

        const [{ count }] = await countQuery.count();

        const sales = await query.orderBy('s.sale_date', 'desc').limit(limit).offset(offset);

        return {
            data: sales,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }
}

module.exports = SaleService;

