const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');
const SaleReturnService = require('./saleReturn.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

class SaleService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.stockService = new StockService(db, tenantId);
        this.ledgerService = new LedgerService(db, tenantId);
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

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError('At least one sale item is required', 400);
        }

        const numericDiscountAmount = Number(discount_amount || 0);
        const numericDiscountPercentage = Number(discount_percentage || 0);
        const numericTaxAmount = Number(tax_amount || 0);
        const numericAmountPaid = Number(amount_paid || 0);

        if (!Number.isFinite(numericDiscountAmount) || numericDiscountAmount < 0) {
            throw new AppError('discount_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericDiscountPercentage) || numericDiscountPercentage < 0 || numericDiscountPercentage > 100) {
            throw new AppError('discount_percentage must be between 0 and 100', 400);
        }
        if (!Number.isFinite(numericTaxAmount) || numericTaxAmount < 0) {
            throw new AppError('tax_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericAmountPaid) || numericAmountPaid < 0) {
            throw new AppError('amount_paid must be a valid non-negative number', 400);
        }

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
                        const quantity = Number(item.quantity);
                        const unitPrice = Number(item.unit_price);
                        const lineDiscount = Number(item.line_discount || 0);

                        if (!Number.isFinite(quantity) || quantity <= 0) {
                            throw new AppError('Item quantity must be a positive number', 400);
                        }
                        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                            throw new AppError('Item unit_price must be a valid non-negative number', 400);
                        }
                        if (!Number.isFinite(lineDiscount) || lineDiscount < 0) {
                            throw new AppError('Item line_discount must be a valid non-negative number', 400);
                        }
                        if (lineDiscount > (quantity * unitPrice) + 0.01) {
                            throw new AppError('Item line_discount cannot exceed line gross amount', 400);
                        }

                        const product = await trx('products')
                            .where({ id: item.product_id, tenant_id: this.tenantId, is_deleted: false })
                            .first();
                        if (!product) throw new AppError(`Product not found: ${item.product_id}`, 404);

                        // Consumed Stock via FIFO
                        const consumption = await this.stockService.consumeStockFifo(item.product_id, quantity, trx);
                        if (consumption.shortage > 0) {
                            throw new AppError(`Insufficient stock for ${product.name}. Shortage: ${consumption.shortage}`, 400);
                        }

                        const lineTotal = (quantity * unitPrice) - lineDiscount;
                        subtotal += (quantity * unitPrice);
                        totalCogs += consumption.totalCost;

                        processedItems.push({
                            product_id: item.product_id,
                            quantity,
                            unit_price: unitPrice,
                            line_discount: lineDiscount,
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
                            quantity,
                            unit_cost: consumption.avgCost,
                            notes: `Sale ${invoiceNumber}`,
                            created_by: userId
                        }, trx);
                    }

                    if (numericDiscountAmount > subtotal + 0.01) {
                        throw new AppError('discount_amount cannot exceed subtotal', 400);
                    }

                    const totalAmount = roundCurrency((subtotal - numericDiscountAmount) + numericTaxAmount);

                    // Handle overpayment: calculate amount_due and return_to_customer
                    let amountDue = roundCurrency(totalAmount - numericAmountPaid);
                    let returnToCustomer = 0;

                    // If customer paid more than total, they get change back
                    if (amountDue < 0) {
                        returnToCustomer = roundCurrency(Math.abs(amountDue));
                        amountDue = 0; // No amount due, sale is fully paid
                    }

                    // Credit/partially paid sales must be linked to a customer account
                    if (amountDue > 0 && !customer_id) {
                        throw new AppError('Customer is required for unpaid or credit sales', 400);
                    }

                    const status = amountDue <= 0 ? 'completed' : 'confirmed';

                    // 3. CREDIT LIMIT CHECK
                    if (customer_id && amountDue > 0) {
                        const customer = await trx('customers')
                            .where({ id: customer_id, tenant_id: this.tenantId, is_deleted: false })
                            .forUpdate()
                            .first();
                        if (!customer) {
                            throw new AppError('Customer not found', 404);
                        }
                        const customerAccount = await trx('accounts')
                            .where({ id: customer.account_id, tenant_id: this.tenantId })
                            .forUpdate()
                            .first('current_balance');

                        const currentReceivable = Number(customerAccount?.current_balance || 0);
                        const creditLimit = Number(customer.credit_limit || 0);

                        if (!Number.isFinite(currentReceivable) || !Number.isFinite(creditLimit)) {
                            throw new AppError('Invalid customer credit configuration', 400);
                        }

                        const normalizedReceivable = Math.max(0, roundCurrency(currentReceivable));
                        const projectedReceivable = roundCurrency(normalizedReceivable + amountDue);
                        const availableCredit = Math.max(0, roundCurrency(creditLimit - normalizedReceivable));

                        if (projectedReceivable > creditLimit + 0.0001) {
                            throw new AppError(`Credit limit exceeded for ${customer.name}. Available: ${availableCredit}`, 400);
                        }

                        // Update customer credit/balance
                        await trx('customers')
                            .where({ id: customer_id, tenant_id: this.tenantId })
                            .increment('current_credit_used', roundCurrency(amountDue))
                            .increment('current_balance', roundCurrency(amountDue));
                    }

                    // 4. Create Sale Record
                    const [sale] = await trx('sales').insert({
                        invoice_number: invoiceNumber,
                        customer_id: customer_id || null,
                        sale_date: sale_date || new Date(),
                        subtotal,
                        discount_amount: numericDiscountAmount,
                        discount_percentage: numericDiscountPercentage,
                        tax_amount: numericTaxAmount,
                        total_amount: totalAmount,
                        payment_method,
                        amount_paid: numericAmountPaid,
                        amount_due: amountDue,
                        return_to_customer: returnToCustomer,
                        status,
                        notes,
                        created_by: userId,
                        tenant_id: this.tenantId
                    }).returning('*');

                    // 5. Create Sale Items
                    for (const item of processedItems) {
                        await trx('sale_items').insert({
                            sale_id: sale.id,
                            ...item,
                            tenant_id: this.tenantId
                        });
                    }

                    // 6. ACCOUNTING: Journal & Ledger Entries
                    const accounts = await this.getRequiredAccounts(trx);
                    const netSalesRevenue = roundCurrency(subtotal - numericDiscountAmount);

                    const journalEntries = [
                        // Credit Sales (Revenue)
                        { account_id: accounts.sales, entry_type: 'credit', amount: netSalesRevenue, narration: `Sale ${invoiceNumber}` },
                        // Debit COGS (Expense)
                        { account_id: accounts.cogs, entry_type: 'debit', amount: totalCogs, narration: `COGS ${invoiceNumber}` },
                        // Credit Inventory (Asset)
                        { account_id: accounts.inventory, entry_type: 'credit', amount: totalCogs, narration: `Inventory Out ${invoiceNumber}` }
                    ];

                    // Handle Tax
                    if (numericTaxAmount > 0) {
                        journalEntries.push({ account_id: accounts.tax_payable, entry_type: 'credit', amount: numericTaxAmount, narration: `Tax on ${invoiceNumber}` });
                        // Update tax payable current_balance (liability - credit increases)
                        await trx('accounts')
                            .where({ id: accounts.tax_payable })
                            .increment('current_balance', numericTaxAmount);
                    }

                    // Handle Payment & Receivables
                    // Note: When customer overpays, we receive amount_paid but return returnToCustomer as change
                    // Net cash received = amount_paid - returnToCustomer = totalAmount (when fully paid)
                    const paymentAccount = payment_method === 'cash' ? accounts.cash : accounts.bank;

                    if (numericAmountPaid > 0) {
                        // Debit cash/bank for the NET amount received (after giving change)
                        const netPaymentReceived = numericAmountPaid - returnToCustomer;
                        if (netPaymentReceived > 0) {
                            journalEntries.push({ account_id: paymentAccount, entry_type: 'debit', amount: netPaymentReceived, narration: `Payment for ${invoiceNumber}` });
                        }
                    }

                    // ===== RESTORED: Use individual customer GL accounts =====
                    // Each customer has their own GL account (1204, 1205, etc.)
                    let receivableAccountId = null;
                    if (amountDue > 0 && customer_id) {
                        const customer = await trx('customers')
                            .where({ id: customer_id, tenant_id: this.tenantId })
                            .first();
                        
                        if (!customer) {
                            throw new AppError('Customer not found', 404);
                        }
                        
                        // Use customer's individual GL account if available, else fallback to 1201
                        receivableAccountId = customer.account_id || accounts.receivables;
                        
                        journalEntries.push({ 
                            account_id: receivableAccountId, 
                            entry_type: 'debit', 
                            amount: amountDue, 
                            narration: `Receivable - ${customer.name} (${invoiceNumber})`, 
                            reference_id: sale.id,
                            reference_type: 'sale'
                        });
                        
                        // Control account entries handled via current_balance field only (not journal)
                        
                        // Update account current_balance and add entries to both individual and control (1201)
                        if (customer.account_id) {
                            // Update individual customer account
                            await trx('accounts')
                                .where({ id: customer.account_id })
                                .increment('current_balance', amountDue);
                            
                            // Update 1201 control account
                            await trx('accounts')
                                .where({ id: accounts.receivables })
                                .increment('current_balance', amountDue);
                            
                            // Add entry to 1201 for audit trail + matching offset to 1200
                            journalEntries.push({
                                account_id: accounts.receivables,
                                entry_type: 'debit',
                                amount: amountDue,
                                narration: `Receivable - ${customer.name} (${invoiceNumber}) [1201]`,
                                reference_id: sale.id,
                                reference_type: 'sale'
                            });
                            journalEntries.push({
                                account_id: accounts.receivables_summary,
                                entry_type: 'credit',
                                amount: amountDue,
                                narration: `Summary Offset ${invoiceNumber}`,
                                reference_id: sale.id,
                                reference_type: 'sale'
                            });
                        }
                    }

                    const accountTypeRules = [
                        { accountId: accounts.sales, allowedTypes: ['income'], label: 'Sales income account' },
                        { accountId: accounts.cogs, allowedTypes: ['expense'], label: 'COGS account' },
                        { accountId: accounts.inventory, allowedTypes: ['asset'], label: 'Inventory account' },
                    ];

                    if (numericAmountPaid > 0 && (numericAmountPaid - returnToCustomer) > 0) {
                        accountTypeRules.push({ accountId: paymentAccount, allowedTypes: ['asset'], label: 'Payment account' });
                    }

                    if (numericTaxAmount > 0) {
                        accountTypeRules.push({ accountId: accounts.tax_payable, allowedTypes: ['liability'], label: 'Tax payable account' });
                    }

                    if (receivableAccountId) {
                        accountTypeRules.push({ accountId: receivableAccountId, allowedTypes: ['asset'], label: 'Customer receivable account' });
                    }

                    await validateAccountTypes(trx, this.tenantId, accountTypeRules);

                    await this.ledgerService.createJournalEntry({
                        journal_date: sale.sale_date,
                        transaction_type: 'sale',
                        reference_type: 'sale',
                        reference_id: sale.id,
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
                        await this.syncInvoiceSequence(this.db);
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
        const updated = await trx('sequences')
            .where({ name: 'invoice', tenant_id: this.tenantId })
            .increment('current_value', 1)
            .returning(['current_value', 'prefix', 'pad_length']);

        const sequence = updated[0];
        if (!sequence) throw new AppError('Invoice sequence not found', 500);

        const nextVal = parseInt(sequence.current_value, 10);
        const prefix = sequence.prefix || 'INV-';
        const padLength = sequence.pad_length || 6;

        return `${prefix}${nextVal.toString().padStart(padLength, '0')}`;
    }

    async syncInvoiceSequence(query) {
        const sequence = await query('sequences')
            .where({ name: 'invoice', tenant_id: this.tenantId })
            .first();

        if (!sequence) return;

        const prefix = sequence.prefix || 'INV-';
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const stripPattern = `^${escapedPrefix}`;
        const matchPattern = `^${escapedPrefix}[0-9]+$`;

        const result = await query.raw(
            `
                SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(invoice_number, ?, '') AS INTEGER)), 0) AS max_num
                FROM sales
                WHERE tenant_id = ?
                  AND invoice_number ~ ?
            `,
            [stripPattern, this.tenantId, matchPattern]
        );

        const maxNum = Number(result.rows?.[0]?.max_num || 0);
        if (maxNum > Number(sequence.current_value || 0)) {
            await query('sequences')
                .where({ name: 'invoice', tenant_id: this.tenantId })
                .update({ current_value: maxNum });
        }
    }

    /**
     * Get system accounts needed for sales
     */
    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
            SYSTEM_ACCOUNTS.INVENTORY,
            SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES,
            SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY,
            SYSTEM_ACCOUNTS.TAX_PAYABLE,
            SYSTEM_ACCOUNTS.SALES_INCOME,
            SYSTEM_ACCOUNTS.SALES_RETURNS,
            SYSTEM_ACCOUNTS.COGS,
        ]);

        return {
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
            inventory: accountIds[SYSTEM_ACCOUNTS.INVENTORY],
            receivables: accountIds[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES],
            receivables_summary: accountIds[SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY],
            sales: accountIds[SYSTEM_ACCOUNTS.SALES_INCOME],
            cogs: accountIds[SYSTEM_ACCOUNTS.COGS],
            tax_payable: accountIds[SYSTEM_ACCOUNTS.TAX_PAYABLE],
            sales_returns: accountIds[SYSTEM_ACCOUNTS.SALES_RETURNS],
        };
    }

    async generateSaleReturnNumber(trx) {
        const updated = await trx('sequences')
            .where({ name: 'sale_return', tenant_id: this.tenantId })
            .increment('current_value', 1)
            .returning(['current_value', 'prefix', 'pad_length']);

        const sequence = updated[0];
        if (!sequence) {
            throw new AppError('Sale return sequence not found', 500);
        }

        const nextVal = parseInt(sequence.current_value, 10);
        const prefix = sequence.prefix || 'SRN-';
        const padLength = sequence.pad_length || 6;

        return `${prefix}${nextVal.toString().padStart(padLength, '0')}`;
    }

    isSalesReturnsEnabled() {
        const rawFlag = process.env.ENABLE_SALES_RETURNS;
        if (rawFlag === undefined || rawFlag === null || String(rawFlag).trim() === '') {
            return true;
        }
        return String(rawFlag).toLowerCase() === 'true';
    }

    async createSaleReturn(saleId, data, userId) {
        const saleReturnService = new SaleReturnService(this.db, this.tenantId);
        return saleReturnService.createReturn(
            saleId,
            {
                ...data,
                applyToPrevious: data?.applyToPrevious === true,
            },
            userId
        );
    }

    async listSaleReturns(params) {
        if (!this.isSalesReturnsEnabled()) {
            throw new AppError('Sales returns are disabled. Set ENABLE_SALES_RETURNS=true to enable.', 403);
        }

        const {
            page = 1,
            limit = 50,
            sale_id,
            from_date,
            to_date,
            search,
        } = params;

        const offset = (page - 1) * limit;

        const applyFilters = (builder) => {
            builder.where('sr.tenant_id', this.tenantId);

            if (sale_id) builder.where('sr.sale_id', sale_id);
            if (from_date) builder.where('sr.return_date', '>=', from_date);
            if (to_date) builder.where('sr.return_date', '<=', to_date);
            if (search) {
                builder.where((q) => {
                    q.where('sr.return_number', 'ilike', `%${search}%`)
                        .orWhere('s.invoice_number', 'ilike', `%${search}%`)
                        .orWhere('c.name', 'ilike', `%${search}%`);
                });
            }
        };

        const query = this.db('sale_returns as sr')
            .leftJoin('sales as s', 'sr.sale_id', 's.id')
            .leftJoin('customers as c', 'sr.customer_id', 'c.id')
            .leftJoin('users as u', 'sr.created_by', 'u.id')
            .select(
                'sr.*',
                's.invoice_number',
                'c.name as customer_name',
                'u.full_name as created_by_name'
            );

        applyFilters(query);

        const countQuery = this.db('sale_returns as sr')
            .leftJoin('sales as s', 'sr.sale_id', 's.id')
            .leftJoin('customers as c', 'sr.customer_id', 'c.id');
        applyFilters(countQuery);

        const [{ count }] = await countQuery.count('sr.id as count');

        const data = await query
            .orderBy('sr.return_date', 'desc')
            .limit(limit)
            .offset(offset);

        return {
            data,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total: parseInt(count, 10),
                pages: Math.ceil(parseInt(count, 10) / parseInt(limit, 10)),
            },
        };
    }

    async getSaleReturnById(returnId) {
        if (!this.isSalesReturnsEnabled()) {
            throw new AppError('Sales returns are disabled. Set ENABLE_SALES_RETURNS=true to enable.', 403);
        }

        const saleReturn = await this.db('sale_returns as sr')
            .leftJoin('sales as s', 'sr.sale_id', 's.id')
            .leftJoin('customers as c', 'sr.customer_id', 'c.id')
            .select('sr.*', 's.invoice_number', 'c.name as customer_name')
            .where('sr.id', returnId)
            .where('sr.tenant_id', this.tenantId)
            .first();

        if (!saleReturn) {
            throw new AppError('Sale return not found', 404);
        }

        const items = await this.db('sale_return_items as sri')
            .join('products as p', 'sri.product_id', 'p.id')
            .select('sri.*', 'p.name as product_name', 'p.code as product_code')
            .where('sri.sale_return_id', saleReturn.id)
            .where('sri.tenant_id', this.tenantId)
            .orderBy('sri.created_at', 'asc');

        return {
            ...saleReturn,
            items,
        };
    }

    /**
     * List sales with pagination
     */
    async list(params) {
        const { page = 1, limit = 50, from_date, to_date, customer_id, status, search, min_amount, max_amount } = params;
        const offset = (page - 1) * limit;

        const buildCoreReturnsAggregateQuery = () => this.db('sales as rs')
            .select('rs.original_sale_id as sale_id')
            .sum({ returned_amount: 'rs.total_amount' })
            .count('* as return_count')
            .where('rs.tenant_id', this.tenantId)
            .where('rs.is_return', true)
            .groupBy('rs.original_sale_id')
            .as('core_ret_agg');

        const buildLegacyReturnsAggregateQuery = () => this.db('sale_returns as sr')
            .select('sr.sale_id')
            .sum({ returned_amount: 'sr.total_amount' })
            .count('* as return_count')
            .where('sr.tenant_id', this.tenantId)
            .where('sr.status', 'processed')
            .groupBy('sr.sale_id')
            .as('legacy_ret_agg');

        // Base query builder
        const buildQuery = (builder) => {
            if (status) builder.where('s.status', status);
            if (customer_id) builder.where('s.customer_id', customer_id);
            if (from_date) builder.where('s.sale_date', '>=', from_date);
            if (to_date) builder.where('s.sale_date', '<=', to_date);
            if (min_amount) builder.where('s.total_amount', '>=', min_amount);
            if (max_amount) builder.where('s.total_amount', '<=', max_amount);

            if (search) {
                builder.where(function () {
                    this.where('s.invoice_number', 'ilike', `%${search}%`)
                        .orWhere('c.name', 'ilike', `%${search}%`);
                });
            }
            return builder;
        };

        // Data Query
        let query = this.db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .leftJoin('users as u', 's.created_by', 'u.id')
            .leftJoin(buildCoreReturnsAggregateQuery(), 'core_ret_agg.sale_id', 's.id')
            .leftJoin(buildLegacyReturnsAggregateQuery(), 'legacy_ret_agg.sale_id', 's.id')
            .select(
                's.*',
                'c.name as customer_name',
                'c.phone_number as customer_phone',
                'u.full_name as created_by_name',
                this.db.raw('COALESCE(core_ret_agg.returned_amount, 0) + COALESCE(legacy_ret_agg.returned_amount, 0) as returned_amount'),
                this.db.raw('COALESCE(core_ret_agg.return_count, 0) + COALESCE(legacy_ret_agg.return_count, 0) as return_count')
            )
            .where('s.is_deleted', false)
            .where('s.is_return', false)
            .where('s.tenant_id', this.tenantId);

        query = buildQuery(query);

        // Count Query
        let countQuery = this.db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .where('s.is_deleted', false)
            .where('s.is_return', false)
            .where('s.tenant_id', this.tenantId);

        countQuery = buildQuery(countQuery);

        const [{ count }] = await countQuery.count('s.id as count');

        // Aggregates Query (Reusing filters)
        let aggregatesQuery = this.db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .where('s.is_deleted', false)
            .where('s.is_return', false)
            .where('s.tenant_id', this.tenantId);

        aggregatesQuery = buildQuery(aggregatesQuery);

        const [aggregates] = await aggregatesQuery.sum({
            total_sales: 's.total_amount',
            total_paid: 's.amount_paid',
            total_due: 's.amount_due'
        });

        const sales = await query.orderBy('s.sale_date', 'desc').limit(limit).offset(offset);

        return {
            data: sales,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count), pages: Math.ceil(count / limit) },
            aggregates: {
                total_sales: Number(aggregates?.total_sales || 0),
                total_paid: Number(aggregates?.total_paid || 0),
                total_due: Number(aggregates?.total_due || 0),
                count: parseInt(count)
            }
        };
    }

    /**
     * Record payment on a credit/partial sale
     */
    async recordPayment(saleId, data, userId) {
        const { amount, payment_method, payment_date, reference_number, notes } = data;
        
        const numericAmount = Number(amount || 0);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new AppError('Payment amount must be a positive number', 400);
        }

        const sale = await this.db('sales')
            .where({ id: saleId, tenant_id: this.tenantId, is_deleted: false })
            .first();

        if (!sale) {
            throw new AppError('Sale not found', 404);
        }

        if (sale.status === 'completed' || sale.amount_due <= 0) {
            throw new AppError('Sale is already fully paid', 400);
        }

        const paymentDate = payment_date || new Date();
        
        return this.db.transaction(async (trx) => {
            const accounts = await this.getRequiredAccounts(trx);
            
            const newAmountPaid = roundCurrency(sale.amount_paid + numericAmount);
            const newAmountDue = roundCurrency(sale.amount_due - numericAmount);
            const newStatus = newAmountDue <= 0.01 ? 'completed' : 'confirmed';
            const returnToCustomer = newAmountDue < 0 ? Math.abs(newAmountDue) : 0;
            
            // Update sale
            await trx('sales')
                .where({ id: saleId })
                .update({
                    amount_paid: newAmountPaid,
                    amount_due: Math.max(0, newAmountDue),
                    status: newStatus,
                    return_to_customer: returnToCustomer,
                    updated_at: new Date()
                });

            // Get payment account
            const paymentAccount = payment_method === 'cash' ? accounts.cash : accounts.bank;

            // Journal entry
            const netPayment = numericAmount - returnToCustomer;
            const journalEntries = [];
            
            if (netPayment > 0) {
                journalEntries.push({
                    account_id: paymentAccount,
                    entry_type: 'debit',
                    amount: netPayment,
                    narration: `Payment for Sale ${sale.invoice_number}`
                });
            }

            // If customer receivable exists, reduce it
            if (sale.customer_id && sale.amount_due > 0) {
                const customer = await trx('customers')
                    .where({ id: sale.customer_id, tenant_id: this.tenantId })
                    .first();
                
                if (customer && customer.account_id) {
                    const reduceAmount = numericAmount > sale.amount_due ? sale.amount_due : numericAmount;
                    
                    journalEntries.push({
                        account_id: customer.account_id,
                        entry_type: 'credit',
                        amount: reduceAmount,
                        narration: `Payment received from ${customer.name}`
                    });

                    // Update customer account balance
                    await trx('accounts')
                        .where({ id: customer.account_id, tenant_id: this.tenantId })
                        .decrement('current_balance', reduceAmount);

                    // Decrement customer credit used
                    await trx('customers')
                        .where({ id: sale.customer_id })
                        .decrement('current_credit_used', reduceAmount);
                }
            }

            // Create journal entry
            if (journalEntries.length > 0) {
                await this.ledgerService.createJournalEntry({
                    journal_date: paymentDate,
                    transaction_type: 'sale_payment',
                    reference_type: 'sale',
                    reference_id: saleId,
                    narration: `Sale Payment - ${sale.invoice_number}`,
                    entries: journalEntries,
                    created_by: userId
                }, trx);

                // Update payment account balance
                await trx('accounts')
                    .where({ id: paymentAccount, tenant_id: this.tenantId })
                    .increment('current_balance', netPayment);
            }

            return {
                success: true,
                sale_id: saleId,
                amount_paid: newAmountPaid,
                amount_due: Math.max(0, newAmountDue),
                status: newStatus,
                return_to_customer: returnToCustomer
            };
        });
    }
}

module.exports = SaleService;

