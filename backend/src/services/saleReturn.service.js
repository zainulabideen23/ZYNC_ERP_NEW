const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');

const CURRENCY_TOLERANCE = 0.01;

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const toNonNegativeNumber = (value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return roundCurrency(numeric);
};

class SaleReturnService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.stockService = new StockService(db, tenantId);
        this.ledgerService = new LedgerService(db, tenantId);
    }

    isEnabled() {
        const rawFlag = process.env.ENABLE_SALES_RETURNS;
        if (rawFlag === undefined || rawFlag === null || String(rawFlag).trim() === '') {
            return true;
        }
        return String(rawFlag).toLowerCase() === 'true';
    }

    async generateReturnNumber(trx) {
        const updated = await trx('sequences')
            .where({ name: 'sale_return', tenant_id: this.tenantId })
            .increment('current_value', 1)
            .returning(['current_value', 'prefix', 'pad_length']);

        const sequence = updated[0];
        if (!sequence) {
            throw new AppError('Sale return sequence not found', 500);
        }

        const nextVal = Number(sequence.current_value || 0);
        const prefix = sequence.prefix || 'SRN-';
        const padLength = sequence.pad_length || 6;

        return `${prefix}${String(nextVal).padStart(padLength, '0')}`;
    }

    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
            SYSTEM_ACCOUNTS.INVENTORY,
            SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES,
            SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY,
            SYSTEM_ACCOUNTS.SALES_RETURNS,
            SYSTEM_ACCOUNTS.COGS,
            SYSTEM_ACCOUNTS.TAX_PAYABLE,
        ]);

        return {
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
            inventory: accountIds[SYSTEM_ACCOUNTS.INVENTORY],
            receivables: accountIds[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES],
            receivables_summary: accountIds[SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY],
            sales_returns: accountIds[SYSTEM_ACCOUNTS.SALES_RETURNS],
            cogs: accountIds[SYSTEM_ACCOUNTS.COGS],
            tax_payable: accountIds[SYSTEM_ACCOUNTS.TAX_PAYABLE],
        };
    }

    async getLegacyReturnedByItem(trx, saleId) {
        const hasLegacyTable = await trx.schema.hasTable('sale_return_items');
        if (!hasLegacyTable) {
            return new Map();
        }

        const rows = await trx('sale_return_items as sri')
            .join('sale_returns as sr', 'sri.sale_return_id', 'sr.id')
            .where('sr.tenant_id', this.tenantId)
            .where('sr.sale_id', saleId)
            .where('sr.status', 'processed')
            .select('sri.sale_item_id')
            .sum({ returned_qty: 'sri.quantity' })
            .groupBy('sri.sale_item_id');

        return new Map(rows.map((row) => [row.sale_item_id, Number(row.returned_qty || 0)]));
    }

    async getCustomerPreviousLedgerBalance(trx, customerId) {
        if (!customerId) return 0;

        const customer = await trx('customers as c')
            .leftJoin('accounts as a', function joinAccount() {
                this.on('a.id', '=', 'c.account_id').andOn('a.tenant_id', '=', 'c.tenant_id');
            })
            .where('c.id', customerId)
            .where('c.tenant_id', this.tenantId)
            .where('c.is_deleted', false)
            .select(trx.raw('COALESCE(a.current_balance, 0) as ledger_balance'))
            .first();

        return toNonNegativeNumber(customer?.ledger_balance || 0);
    }

    async buildReturnDraft(trx, saleId, items, options = {}) {
        const { lockSale = false } = options;

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError('At least one return item is required', 400);
        }

        let saleQuery = trx('sales')
            .where({
                id: saleId,
                tenant_id: this.tenantId,
                is_deleted: false,
            })
            .where((builder) => {
                builder.whereNull('is_return').orWhere('is_return', false);
            });

        if (lockSale) {
            saleQuery = saleQuery.forUpdate();
        }

        const sale = await saleQuery.first();

        if (!sale) {
            throw new AppError('Sale not found', 404);
        }

        const saleItems = await trx('sale_items')
            .where({ sale_id: sale.id, tenant_id: this.tenantId })
            .select('id', 'product_id', 'quantity', 'unit_price', 'cost_price');

        if (saleItems.length === 0) {
            throw new AppError('Sale has no items to return', 400);
        }

        const saleItemById = new Map();
        const saleItemsByProduct = new Map();

        for (const item of saleItems) {
            saleItemById.set(item.id, item);
            const bucket = saleItemsByProduct.get(item.product_id) || [];
            bucket.push(item);
            saleItemsByProduct.set(item.product_id, bucket);
        }

        const coreReturnedRows = await trx('sale_items as rsi')
            .join('sales as rs', 'rsi.sale_id', 'rs.id')
            .where('rs.tenant_id', this.tenantId)
            .where('rs.is_return', true)
            .where('rs.original_sale_id', sale.id)
            .whereNotNull('rsi.original_sale_item_id')
            .select('rsi.original_sale_item_id')
            .sum({ returned_qty: 'rsi.quantity' })
            .groupBy('rsi.original_sale_item_id');

        const returnedBySaleItem = new Map(
            coreReturnedRows.map((row) => [row.original_sale_item_id, Number(row.returned_qty || 0)])
        );

        const legacyReturnedByItem = await this.getLegacyReturnedByItem(trx, sale.id);
        for (const [saleItemId, qty] of legacyReturnedByItem.entries()) {
            returnedBySaleItem.set(saleItemId, Number(returnedBySaleItem.get(saleItemId) || 0) + Number(qty || 0));
        }

        const requestByItem = new Map();
        const normalizedItems = [];
        let subtotal = 0;
        let totalReturnCost = 0;

        for (const line of items) {
            let saleItem = null;

            if (line.sale_item_id) {
                saleItem = saleItemById.get(line.sale_item_id);
            } else if (line.product_id) {
                const candidates = saleItemsByProduct.get(line.product_id) || [];
                if (candidates.length > 1) {
                    throw new AppError(
                        `Multiple invoice lines exist for product ${line.product_id}. Provide sale_item_id for each return line.`,
                        400
                    );
                }
                saleItem = candidates[0] || null;
            }

            if (!saleItem) {
                throw new AppError('One or more return lines do not match the original sale', 400);
            }

            const requestedQty = Number(line.quantity);
            if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
                throw new AppError('Return quantity must be a positive number', 400);
            }

            const soldQty = Number(saleItem.quantity || 0);
            const alreadyReturned = Number(returnedBySaleItem.get(saleItem.id) || 0);
            const pendingForThisRequest = Number(requestByItem.get(saleItem.id) || 0);
            const availableQty = soldQty - alreadyReturned;

            if (requestedQty + pendingForThisRequest > availableQty + 0.0001) {
                throw new AppError(
                    `Return quantity exceeds available quantity for sale item ${saleItem.id}. Available: ${availableQty}`,
                    400
                );
            }

            const unitPrice = Number(saleItem.unit_price || 0);
            const costPrice = Number(saleItem.cost_price || 0);
            const lineTotal = roundCurrency(requestedQty * unitPrice);
            const lineCost = roundCurrency(requestedQty * costPrice);

            subtotal = roundCurrency(subtotal + lineTotal);
            totalReturnCost = roundCurrency(totalReturnCost + lineCost);

            requestByItem.set(saleItem.id, pendingForThisRequest + requestedQty);

            normalizedItems.push({
                original_sale_item_id: saleItem.id,
                product_id: saleItem.product_id,
                quantity: requestedQty,
                unit_price: unitPrice,
                cost_price: costPrice,
                line_total: lineTotal,
            });
        }

        const returnAmount = toNonNegativeNumber(subtotal);
        const previousLedgerBalance = sale.customer_id
            ? await this.getCustomerPreviousLedgerBalance(trx, sale.customer_id)
            : 0;
        const applyToPreviousAmount = roundCurrency(Math.min(returnAmount, previousLedgerBalance));
        const cashRefundIfApplied = toNonNegativeNumber(returnAmount - applyToPreviousAmount);
        const needsChoice = true;

        return {
            sale,
            normalizedItems,
            returnAmount,
            totalReturnCost,
            previousLedgerBalance,
            applyToPreviousAmount,
            cashRefundIfApplied,
            needsChoice,
        };
    }

    async getReturnPreview(saleId, data = {}) {
        if (!this.isEnabled()) {
            throw new AppError('Sales returns are disabled. Set ENABLE_SALES_RETURNS=true to enable.', 403);
        }

        const { items = [] } = data;
        const draft = await this.buildReturnDraft(this.db, saleId, items, { lockSale: false });

        return {
            returnAmount: draft.returnAmount,
            previousLedgerBalance: draft.previousLedgerBalance,
            applyToPreviousAmount: draft.applyToPreviousAmount,
            cashRefundIfApplied: draft.cashRefundIfApplied,
            cashRefundIfNotApplied: draft.returnAmount,
            needsChoice: draft.needsChoice,
        };
    }

    async createReturn(saleId, data, userId) {
        if (!this.isEnabled()) {
            throw new AppError('Sales returns are disabled. Set ENABLE_SALES_RETURNS=true to enable.', 403);
        }

        const {
            items = [],
            return_date,
            refund_method,
            notes,
            applyToPrevious = false,
        } = data;

        const applyToPreviousFlag = applyToPrevious === true;

        return this.db.transaction(async (trx) => {
            const draft = await this.buildReturnDraft(trx, saleId, items, { lockSale: true });
            const {
                sale,
                normalizedItems,
                returnAmount,
                totalReturnCost,
                previousLedgerBalance,
            } = draft;

            const previousLedgerApplied = (
                applyToPreviousFlag && sale.customer_id
                    ? roundCurrency(Math.min(returnAmount, previousLedgerBalance))
                    : 0
            );

            const cashRefund = toNonNegativeNumber(returnAmount - previousLedgerApplied);
            const receivableReduction = previousLedgerApplied;

            const returnNumber = await this.generateReturnNumber(trx);
            const returnDate = return_date || new Date();
            const returnNotes = notes || `Return for ${sale.invoice_number}`;

            const [returnSale] = await trx('sales')
                .insert({
                    invoice_number: returnNumber,
                    customer_id: sale.customer_id || null,
                    sale_date: returnDate,
                    subtotal: returnAmount,
                    discount_amount: 0,
                    discount_percentage: 0,
                    tax_amount: 0,
                    total_amount: returnAmount,
                    payment_method: refund_method || sale.payment_method || 'cash',
                    amount_paid: 0,
                    amount_due: 0,
                    return_to_customer: cashRefund,
                    status: 'returned',
                    notes: returnNotes,
                    is_return: true,
                    original_sale_id: sale.id,
                    created_by: userId,
                    tenant_id: this.tenantId,
                })
                .returning('*');

            for (const item of normalizedItems) {
                await trx('sale_items').insert({
                    sale_id: returnSale.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    line_discount: 0,
                    tax_rate: 0,
                    line_total: item.line_total,
                    cost_price: item.cost_price,
                    original_sale_item_id: item.original_sale_item_id,
                    created_by: userId,
                    tenant_id: this.tenantId,
                });

                await this.stockService.createMovement({
                    product_id: item.product_id,
                    movement_type: 'RETURN',
                    reference_type: 'return',
                    reference_id: returnSale.id,
                    quantity: item.quantity,
                    unit_cost: item.cost_price,
                    notes: `Sale Return ${returnNumber}`,
                    created_by: userId,
                }, trx);
            }

            const accounts = await this.getRequiredAccounts(trx);
            const customer = sale.customer_id
                ? await trx('customers')
                    .where({ id: sale.customer_id, tenant_id: this.tenantId, is_deleted: false })
                    .select('account_id', 'current_balance', 'current_credit_used')
                    .first()
                : null;

            // ===== RESTORED: Use individual customer GL accounts =====
            const receivableAccount = customer?.account_id || accounts.receivables;
            const selectedRefundMethod = refund_method || sale.payment_method || 'cash';
            const refundAccount = selectedRefundMethod === 'cash' ? accounts.cash : accounts.bank;

            const journalEntries = [
                {
                    account_id: accounts.sales_returns,
                    entry_type: 'debit',
                    amount: returnAmount,
                    narration: `Sales Return ${returnNumber}`,
                },
            ];

            if (totalReturnCost > 0) {
                journalEntries.push(
                    {
                        account_id: accounts.inventory,
                        entry_type: 'debit',
                        amount: totalReturnCost,
                        narration: `Inventory Return ${returnNumber}`,
                    },
                    {
                        account_id: accounts.cogs,
                        entry_type: 'credit',
                        amount: totalReturnCost,
                        narration: `COGS Reversal ${returnNumber}`,
                    }
                );
            }

            if (receivableReduction > CURRENCY_TOLERANCE) {
                journalEntries.push({
                    account_id: receivableAccount,
                    entry_type: 'credit',
                    amount: receivableReduction,
                    narration: `Receivable Offset ${returnNumber}`,
                });
                
                // Add entry to 1201 control account for audit trail + matching offset to 1200
                if (customer?.account_id) {
                    journalEntries.push({
                        account_id: accounts.receivables,
                        entry_type: 'credit',
                        amount: receivableReduction,
                        narration: `Receivable Offset ${returnNumber} [1201]`,
                    });
                    journalEntries.push({
                        account_id: accounts.receivables_summary,
                        entry_type: 'debit',
                        amount: receivableReduction,
                        narration: `Summary Offset ${returnNumber}`,
                    });
                }
                
                // Update account balances - both individual and control
                if (customer?.account_id) {
                    await trx('accounts')
                        .where({ id: customer.account_id })
                        .decrement('current_balance', receivableReduction);
                }
                await trx('accounts')
                    .where({ id: accounts.receivables })
                    .decrement('current_balance', receivableReduction);
            }

            if (cashRefund > CURRENCY_TOLERANCE) {
                journalEntries.push({
                    account_id: refundAccount,
                    entry_type: 'credit',
                    amount: cashRefund,
                    narration: `Refund ${returnNumber}`,
                });
            }

            // Handle Tax Reversal (reverse GST Payable)
            const originalTaxAmount = sale.tax_amount || 0;
            const originalSubtotal = sale.subtotal || 0;
            let returnTaxAmount = 0;
            if (originalTaxAmount > 0 && originalSubtotal > 0 && returnAmount > 0) {
                returnTaxAmount = roundCurrency((returnAmount / originalSubtotal) * originalTaxAmount);
            }
            if (returnTaxAmount > CURRENCY_TOLERANCE) {
                journalEntries.push({
                    account_id: accounts.tax_payable,
                    entry_type: 'debit',
                    amount: returnTaxAmount,
                    narration: `Tax Reversal ${returnNumber}`,
                });
                // Update GST Payable current_balance (debit decreases liability)
                await trx('accounts')
                    .where({ id: accounts.tax_payable })
                    .decrement('current_balance', returnTaxAmount);
                
                // Adjust cash refund to include tax - customer gets back item cost + tax
                if (cashRefund > CURRENCY_TOLERANCE) {
                    // Find and update the cash refund entry
                    const cashEntry = journalEntries.find(e => e.narration === `Refund ${returnNumber}`);
                    if (cashEntry) {
                        cashEntry.amount = roundCurrency(cashRefund + returnTaxAmount);
                        cashEntry.narration = `Refund (incl. tax) ${returnNumber}`;
                    }
                }
            }

            const accountTypeRules = [
                { accountId: accounts.sales_returns, allowedTypes: ['income', 'expense'], label: 'Sales return account' },
            ];

            if (totalReturnCost > 0) {
                accountTypeRules.push(
                    { accountId: accounts.inventory, allowedTypes: ['asset'], label: 'Inventory account' },
                    { accountId: accounts.cogs, allowedTypes: ['expense'], label: 'COGS account' }
                );
            }

            if (receivableReduction > CURRENCY_TOLERANCE) {
                accountTypeRules.push({ accountId: receivableAccount, allowedTypes: ['asset'], label: 'Customer receivable account' });
            }

            if (cashRefund > CURRENCY_TOLERANCE) {
                accountTypeRules.push({ accountId: refundAccount, allowedTypes: ['asset'], label: 'Refund account' });
            }

            await validateAccountTypes(trx, this.tenantId, accountTypeRules);

            await this.ledgerService.createJournalEntry({
                journal_date: returnDate,
                transaction_type: 'sale_return',
                reference_type: 'sale_return',
                reference_id: returnSale.id,
                narration: `Sale Return ${returnNumber} for ${sale.invoice_number}`,
                entries: journalEntries,
                created_by: userId,
            }, trx);

            if (sale.customer_id && receivableReduction > CURRENCY_TOLERANCE) {
                const currentBalance = Number(customer?.current_balance || 0);
                const currentCreditUsed = Number(customer?.current_credit_used || 0);

                if (
                    currentBalance + CURRENCY_TOLERANCE < receivableReduction
                    || currentCreditUsed + CURRENCY_TOLERANCE < receivableReduction
                ) {
                    throw new AppError(
                        `Customer balance cannot go negative during return ${returnNumber}. Reconcile customer balances first.`,
                        409
                    );
                }

                await trx('customers')
                    .where({ id: sale.customer_id, tenant_id: this.tenantId })
                    .update({
                        current_balance: roundCurrency(currentBalance - receivableReduction),
                        current_credit_used: roundCurrency(currentCreditUsed - receivableReduction),
                        updated_at: trx.fn.now(),
                    });
            }

            const [{ core_total_returned = 0 }] = await trx('sales')
                .where({ tenant_id: this.tenantId, original_sale_id: sale.id, is_return: true })
                .sum({ core_total_returned: 'total_amount' });

            let legacyTotalReturned = 0;
            const hasLegacyTable = await trx.schema.hasTable('sale_returns');
            if (hasLegacyTable) {
                const [{ legacy_total_returned = 0 }] = await trx('sale_returns')
                    .where({ tenant_id: this.tenantId, sale_id: sale.id, status: 'processed' })
                    .sum({ legacy_total_returned: 'total_amount' });
                legacyTotalReturned = Number(legacy_total_returned || 0);
            }

            const totalReturned = Number(core_total_returned || 0) + legacyTotalReturned;
            if (totalReturned >= Number(sale.total_amount || 0) - 0.01) {
                await trx('sales')
                    .where({ id: sale.id, tenant_id: this.tenantId })
                    .update({ status: 'returned', updated_at: trx.fn.now() });
            }

            const excessHandling = previousLedgerApplied > CURRENCY_TOLERANCE
                ? (cashRefund > CURRENCY_TOLERANCE ? 'apply_previous_and_refund_cash' : 'apply_previous')
                : (cashRefund > CURRENCY_TOLERANCE ? 'refund_cash' : 'standard');

            return {
                ...returnSale,
                return_breakdown: {
                    return_amount: returnAmount,
                    previous_ledger_balance: previousLedgerBalance,
                    apply_to_previous_requested: applyToPreviousFlag,
                    applied_to_previous: previousLedgerApplied,
                    cash_refund: cashRefund,
                    handling: excessHandling,
                },
            };
        });
    }

    async listReturns(params = {}) {
        if (!this.isEnabled()) {
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

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Number(limit) : 50;
        const offset = (pageNumber - 1) * pageLimit;

        const applyFilters = (builder) => {
            builder.where('r.tenant_id', this.tenantId);
            builder.where('r.is_return', true);

            if (sale_id) builder.where('r.original_sale_id', sale_id);
            if (from_date) builder.where('r.sale_date', '>=', from_date);
            if (to_date) builder.where('r.sale_date', '<=', to_date);
            if (search) {
                builder.where((q) => {
                    q.where('r.invoice_number', 'ilike', `%${search}%`)
                        .orWhere('orig.invoice_number', 'ilike', `%${search}%`)
                        .orWhere('c.name', 'ilike', `%${search}%`);
                });
            }
        };

        const query = this.db('sales as r')
            .leftJoin('sales as orig', 'r.original_sale_id', 'orig.id')
            .leftJoin('customers as c', 'r.customer_id', 'c.id')
            .leftJoin('users as u', 'r.created_by', 'u.id')
            .select(
                'r.id',
                'r.invoice_number as return_number',
                'r.original_sale_id as sale_id',
                'r.customer_id',
                'r.sale_date as return_date',
                'r.subtotal',
                'r.total_amount',
                'r.notes',
                'r.created_at',
                this.db.raw("'processed'::text as status"),
                'orig.invoice_number',
                'c.name as customer_name',
                'u.full_name as created_by_name'
            );

        applyFilters(query);

        const countQuery = this.db('sales as r')
            .leftJoin('sales as orig', 'r.original_sale_id', 'orig.id')
            .leftJoin('customers as c', 'r.customer_id', 'c.id');
        applyFilters(countQuery);

        const [{ count }] = await countQuery.count('r.id as count');

        const data = await query
            .orderBy('r.sale_date', 'desc')
            .limit(pageLimit)
            .offset(offset);

        return {
            data,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total: Number(count || 0),
                pages: Math.ceil(Number(count || 0) / pageLimit) || 1,
            },
        };
    }

    async getReturnById(returnId) {
        if (!this.isEnabled()) {
            throw new AppError('Sales returns are disabled. Set ENABLE_SALES_RETURNS=true to enable.', 403);
        }

        const coreReturn = await this.db('sales as r')
            .leftJoin('sales as orig', 'r.original_sale_id', 'orig.id')
            .leftJoin('customers as c', 'r.customer_id', 'c.id')
            .select(
                'r.id',
                'r.invoice_number as return_number',
                'r.original_sale_id as sale_id',
                'r.customer_id',
                'r.sale_date as return_date',
                'r.subtotal',
                'r.total_amount',
                'r.notes',
                'r.created_at',
                this.db.raw("'processed'::text as status"),
                'orig.invoice_number',
                'c.name as customer_name'
            )
            .where('r.id', returnId)
            .where('r.tenant_id', this.tenantId)
            .where('r.is_return', true)
            .first();

        if (coreReturn) {
            const items = await this.db('sale_items as rsi')
                .join('products as p', 'rsi.product_id', 'p.id')
                .select(
                    'rsi.id',
                    this.db.raw('? as sale_return_id', [coreReturn.id]),
                    'rsi.original_sale_item_id as sale_item_id',
                    'rsi.product_id',
                    'rsi.quantity',
                    'rsi.unit_price',
                    'rsi.cost_price',
                    'rsi.line_total',
                    'rsi.created_at',
                    'rsi.tenant_id',
                    'p.name as product_name',
                    'p.code as product_code'
                )
                .where('rsi.sale_id', coreReturn.id)
                .where('rsi.tenant_id', this.tenantId)
                .orderBy('rsi.created_at', 'asc');

            const normalizedItems = items.map((item) => ({
                ...item,
                sale_return_id: coreReturn.id,
                sale_id: coreReturn.sale_id,
            }));

            return {
                ...coreReturn,
                items: normalizedItems,
            };
        }

        const hasLegacyReturns = await this.db.schema.hasTable('sale_returns');
        if (!hasLegacyReturns) {
            throw new AppError('Sale return not found', 404);
        }

        const legacyReturn = await this.db('sale_returns as sr')
            .leftJoin('sales as s', 'sr.sale_id', 's.id')
            .leftJoin('customers as c', 'sr.customer_id', 'c.id')
            .select('sr.*', 's.invoice_number', 'c.name as customer_name')
            .where('sr.id', returnId)
            .where('sr.tenant_id', this.tenantId)
            .first();

        if (!legacyReturn) {
            throw new AppError('Sale return not found', 404);
        }

        const items = await this.db('sale_return_items as sri')
            .join('products as p', 'sri.product_id', 'p.id')
            .select('sri.*', 'p.name as product_name', 'p.code as product_code')
            .where('sri.sale_return_id', legacyReturn.id)
            .where('sri.tenant_id', this.tenantId)
            .orderBy('sri.created_at', 'asc');

        return {
            ...legacyReturn,
            items,
        };
    }
}

module.exports = SaleReturnService;
