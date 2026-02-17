const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');

class PurchaseService {
    constructor(db) {
        this.db = db;
        this.stockService = new StockService(db);
        this.ledgerService = new LedgerService(db);
    }

    /**
     * Create a new purchase with stock update and ledger entries
     */
    async createPurchase(data, userId) {
        const {
            supplier_id,
            purchase_date,
            reference_number,
            items,
            discount_amount = 0,
            tax_amount = 0,
            amount_paid = 0,
            payment_method = 'bank_transfer',
            notes
        } = data;

        // Retry loop for unique constraint violations
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                return await this.db.transaction(async (trx) => {
                    // 1. Generate Bill Number
                    const billNumber = await this.generateBillNumber(trx);

                    // 2. Process Items
                    let subtotal = 0;
                    const processedItems = [];

                    for (const item of items) {
                        const product = await trx('products').where('id', item.product_id).first();
                        if (!product) throw new AppError(`Product not found: ${item.product_id}`, 404);

                        const lineTotal = (item.quantity * item.unit_cost) - (item.line_discount || 0);
                        subtotal += (item.quantity * item.unit_cost);

                        processedItems.push({
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_cost: item.unit_cost,
                            line_discount: item.line_discount || 0,
                            tax_rate: item.tax_rate || 0,
                            line_total: lineTotal,
                            created_by: userId
                        });

                        // Create Stock Movement (IN)
                        await this.stockService.createMovement({
                            product_id: item.product_id,
                            movement_type: 'IN',
                            reference_type: 'purchase',
                            quantity: item.quantity,
                            unit_cost: item.unit_cost,
                            notes: `Purchase ${billNumber}`,
                            created_by: userId
                        }, trx);
                    }

                    const totalAmount = (subtotal - discount_amount) + tax_amount;
                    
                    // Handle overpayment: clamp amount_due to 0 (constraint requires >= 0)
                    let amountDue = totalAmount - amount_paid;
                    if (amountDue < 0) {
                        amountDue = 0; // Overpaid - no amount due
                    }
                    const status = amountDue <= 0 ? 'paid' : 'billed';

                    // 3. Update Supplier Balance if credit
                    if (supplier_id && amountDue > 0) {
                        await trx('suppliers')
                            .where('id', supplier_id)
                            .increment('current_balance', amountDue);
                    }

                    // 4. Create Purchase Record
                    const [purchase] = await trx('purchases').insert({
                        bill_number: billNumber,
                        supplier_id,
                        purchase_date: purchase_date || new Date(),
                        reference_number,
                        subtotal,
                        discount_amount,
                        tax_amount,
                        total_amount: totalAmount,
                        amount_paid,
                        amount_due: amountDue,
                        status,
                        notes,
                        created_by: userId
                    }).returning('*');

                    // 5. Create Purchase Items
                    for (const item of processedItems) {
                        await trx('purchase_items').insert({
                            purchase_id: purchase.id,
                            ...item
                        });
                    }

                    // 6. ACCOUNTING: Journal & Ledger Entries
                    const accounts = await this.getRequiredAccounts(trx);

                    const journalEntries = [
                        // Debit Inventory (Asset)
                        { account_id: accounts.inventory, entry_type: 'debit', amount: subtotal, narration: `Inventory In ${billNumber}` }
                    ];

                    // Handle Tax (Debit Tax Input - Asset/Expense)
                    if (tax_amount > 0) {
                        journalEntries.push({ account_id: accounts.tax_input, entry_type: 'debit', amount: tax_amount, narration: `Tax on ${billNumber}` });
                    }

                    // Handle Discount (Credit Discount Received - Income)
                    if (discount_amount > 0) {
                        journalEntries.push({ account_id: accounts.discount_received, entry_type: 'credit', amount: discount_amount, narration: `Discount on ${billNumber}` });
                    }

                    // Calculate overpayment using previously computed `totalAmount`
                    const overpayment = Math.max(0, amount_paid - totalAmount);

                    // Handle Payment - credit the full amount paid from cash/bank
                    if (amount_paid > 0) {
                        const paymentAccount = payment_method === 'cash' ? accounts.cash : accounts.bank;
                        journalEntries.push({ account_id: paymentAccount, entry_type: 'credit', amount: amount_paid, narration: `Payment for ${billNumber}` });
                    }

                    // Handle overpayment - Debit as an advance/receivable to balance the entry
                    if (overpayment > 0) {
                        // Use receivables or cash as a proxy for "Advance to Supplier"
                        journalEntries.push({ account_id: accounts.cash, entry_type: 'debit', amount: overpayment, narration: `Supplier Advance/Overpayment ${billNumber}` });
                    }

                    if (amountDue > 0 && supplier_id) {
                        const supplier = await trx('suppliers').where('id', supplier_id).select('account_id').first();
                        journalEntries.push({ account_id: supplier.account_id, entry_type: 'credit', amount: amountDue, narration: `Payable ${billNumber}`, reference_id: purchase.id });
                    }

                    await this.ledgerService.createJournalEntry({
                        journal_date: purchase.purchase_date,
                        transaction_type: 'purchase',
                        narration: `Purchase Bill ${billNumber}`,
                        entries: journalEntries,
                        created_by: userId
                    }, trx);

                    return purchase;
                });
            } catch (error) {
                if (error.code === '23505' && error.constraint === 'purchases_bill_number_key') {
                    attempts++;
                    console.warn(`Duplicate bill number detected. Retrying attempt ${attempts}/${maxAttempts}...`);
                    try {
                        const maxResult = await this.db.raw(`SELECT COALESCE(MAX(CAST(REPLACE(bill_number, 'PUR-', '') AS INTEGER)), 0) as max_num FROM purchases`);
                        const maxNum = maxResult.rows[0].max_num;
                        await this.db('sequences').where('name', 'purchase').update({ current_value: maxNum });
                    } catch (syncError) {
                        console.error('Failed to sync sequence:', syncError);
                    }
                    if (attempts === maxAttempts) throw new AppError('Failed to generate unique bill number', 500);
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Generate next bill number
     * Auto-syncs with actual max value in purchases table to ensure sequential numbering
     */
    async generateBillNumber(trx) {
        const sequence = await trx('sequences').where('name', 'purchase').forUpdate().first();
        if (!sequence) throw new AppError('Purchase sequence not found', 500);

        // Get actual max bill number from purchases table to stay in sync
        const prefix = sequence.prefix || 'PUR-';
        const maxResult = await trx.raw(
            `SELECT COALESCE(MAX(CAST(REPLACE(bill_number, ?, '') AS INTEGER)), 0) as max_num FROM purchases WHERE bill_number LIKE ?`,
            [prefix, prefix + '%']
        );
        const maxInTable = parseInt(maxResult.rows[0]?.max_num || 0);
        
        // Use the higher of sequence value or actual max from table
        const baseValue = Math.max(sequence.current_value, maxInTable);
        const nextVal = baseValue + 1;
        
        await trx('sequences').where('name', 'purchase').update({ current_value: nextVal });

        return `${prefix}${nextVal.toString().padStart(sequence.pad_length || 6, '0')}`;
    }

    /**
     * Get system accounts needed for purchases
     */
    async getRequiredAccounts(trx) {
        const codes = ['1001', '1002', '1004', '2001', '5001', '4001'];
        const accounts = await trx('accounts').whereIn('code', codes).select('id', 'code');
        const map = accounts.reduce((acc, a) => ({ ...acc, [a.code]: a.id }), {});

        return {
            cash: map['1001'],
            bank: map['1002'],
            inventory: map['1004'],
            payables: map['2001'],
            cogs: map['5001'],
            tax_input: map['1004'], // Proxy: For now using inventory or create specific
            discount_received: map['4001'] // Proxy: Revenue
        };
    }

    /**
     * List purchases with pagination
     */
    async list(params) {
        const { page = 1, limit = 50, from_date, to_date, supplier_id, status } = params;
        const offset = (page - 1) * limit;

        let query = this.db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select('p.*', 's.name as supplier_name')
            .where('p.is_deleted', false);

        if (supplier_id) query = query.where('p.supplier_id', supplier_id);
        if (status) query = query.where('p.status', status);
        if (from_date) query = query.where('p.purchase_date', '>=', from_date);
        if (to_date) query = query.where('p.purchase_date', '<=', to_date);

        const countQuery = this.db('purchases').where('is_deleted', false);
        if (status) countQuery.where('status', status);
        if (supplier_id) countQuery.where('supplier_id', supplier_id);
        if (from_date) countQuery.where('purchase_date', '>=', from_date);
        if (to_date) countQuery.where('purchase_date', '<=', to_date);

        const [{ count }] = await countQuery.count();

        const purchases = await query.orderBy('p.purchase_date', 'desc').limit(limit).offset(offset);

        return {
            data: purchases,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }
}

module.exports = PurchaseService;

