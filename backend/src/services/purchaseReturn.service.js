const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');

const CURRENCY_TOLERANCE = 0.01;
const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

class PurchaseReturnService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.stockService = new StockService(db, tenantId);
        this.ledgerService = new LedgerService(db, tenantId);
    }

    async generateReturnNumber(trx) {
        const updated = await trx('sequences')
            .where({ name: 'purchase_return', tenant_id: this.tenantId })
            .increment('current_value', 1)
            .returning(['current_value', 'prefix', 'pad_length']);

        const sequence = updated[0];
        if (!sequence) {
            throw new AppError('Purchase return sequence not found', 500);
        }

        const nextVal = Number(sequence.current_value || 0);
        const prefix = sequence.prefix || 'PRN-';
        const padLength = sequence.pad_length || 6;

        return `${prefix}${String(nextVal).padStart(padLength, '0')}`;
    }

    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
            SYSTEM_ACCOUNTS.INVENTORY,
            SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES,
            SYSTEM_ACCOUNTS.PAYABLES_SUMMARY,
            SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES,
            SYSTEM_ACCOUNTS.PURCHASE_RETURNS,
            SYSTEM_ACCOUNTS.INPUT_TAX_RECEIVABLE,
            SYSTEM_ACCOUNTS.TAX_PAYABLE,
        ]);

        return {
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
            inventory: accountIds[SYSTEM_ACCOUNTS.INVENTORY],
            payables: accountIds[SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES],
            payables_summary: accountIds[SYSTEM_ACCOUNTS.PAYABLES_SUMMARY],
            supplier_advance: accountIds[SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES],
            purchase_returns: accountIds[SYSTEM_ACCOUNTS.PURCHASE_RETURNS],
            input_tax: accountIds[SYSTEM_ACCOUNTS.INPUT_TAX_RECEIVABLE],
            tax_payable: accountIds[SYSTEM_ACCOUNTS.TAX_PAYABLE],
        };
    }

    async createReturn(purchaseId, data, userId) {
        const { items = [], return_date, refund_method = 'credit', notes } = data;
        const validRefundMethods = ['cash', 'bank_transfer', 'cheque', 'credit'];

        if (!validRefundMethods.includes(refund_method)) {
            throw new AppError('Invalid refund method', 400);
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError('At least one return item is required', 400);
        }

        return this.db.transaction(async (trx) => {
            const purchase = await trx('purchases')
                .where({
                    id: purchaseId,
                    tenant_id: this.tenantId,
                    is_deleted: false,
                })
                .where((builder) => {
                    builder.whereNull('is_return').orWhere('is_return', false);
                })
                .forUpdate()
                .first();

            if (!purchase) {
                throw new AppError('Purchase not found', 404);
            }

            if (purchase.status === 'returned') {
                throw new AppError('Purchase is already fully returned', 400);
            }

            const purchaseItems = await trx('purchase_items')
                .where({ purchase_id: purchase.id, tenant_id: this.tenantId })
                .select('id', 'product_id', 'quantity', 'unit_cost');

            if (purchaseItems.length === 0) {
                throw new AppError('Purchase has no items to return', 400);
            }

            const purchaseItemById = new Map();
            const purchaseItemsByProduct = new Map();

            for (const item of purchaseItems) {
                purchaseItemById.set(item.id, item);
                const bucket = purchaseItemsByProduct.get(item.product_id) || [];
                bucket.push(item);
                purchaseItemsByProduct.set(item.product_id, bucket);
            }

            const returnedRows = await trx('purchase_items as rpi')
                .join('purchases as rp', 'rpi.purchase_id', 'rp.id')
                .where('rp.tenant_id', this.tenantId)
                .where('rp.is_return', true)
                .where('rp.original_purchase_id', purchase.id)
                .whereNotNull('rpi.original_purchase_item_id')
                .select('rpi.original_purchase_item_id')
                .sum({ returned_qty: 'rpi.quantity' })
                .groupBy('rpi.original_purchase_item_id');

            const returnedByPurchaseItem = new Map(
                returnedRows.map((row) => [row.original_purchase_item_id, Number(row.returned_qty || 0)])
            );

            const requestedByItem = new Map();
            const normalizedItems = [];
            let subtotal = 0;
            let totalReturnCost = 0;

            for (const line of items) {
                let purchaseItem = null;

                if (line.purchase_item_id) {
                    purchaseItem = purchaseItemById.get(line.purchase_item_id);
                } else if (line.product_id) {
                    const candidates = purchaseItemsByProduct.get(line.product_id) || [];
                    if (candidates.length > 1) {
                        throw new AppError(
                            `Multiple purchase lines exist for product ${line.product_id}. Provide purchase_item_id for each return line.`,
                            400
                        );
                    }
                    purchaseItem = candidates[0] || null;
                }

                if (!purchaseItem) {
                    throw new AppError('One or more return lines do not match the original purchase', 400);
                }

                const requestedQty = Number(line.quantity);
                if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
                    throw new AppError('Return quantity must be a positive number', 400);
                }

                const purchasedQty = Number(purchaseItem.quantity || 0);
                const alreadyReturned = Number(returnedByPurchaseItem.get(purchaseItem.id) || 0);
                const pendingForRequest = Number(requestedByItem.get(purchaseItem.id) || 0);
                const availableQty = purchasedQty - alreadyReturned;

                if (requestedQty + pendingForRequest > availableQty + CURRENCY_TOLERANCE) {
                    throw new AppError(
                        `Return quantity exceeds available quantity for purchase item ${purchaseItem.id}. Requested: ${requestedQty + pendingForRequest}, available: ${availableQty}`,
                        400
                    );
                }

                const fifoConsumption = await this.stockService.consumeStockFifo(
                    purchaseItem.product_id,
                    requestedQty,
                    trx
                );

                if (fifoConsumption.shortage > 0) {
                    throw new AppError(
                        `Insufficient stock to process return for product ${purchaseItem.product_id}. Shortage: ${fifoConsumption.shortage}`,
                        400
                    );
                }

                const lineAmount = requestedQty * Number(purchaseItem.unit_cost || 0);
                const lineCost = Number(fifoConsumption.totalCost || 0);

                subtotal += lineAmount;
                totalReturnCost += lineCost;
                requestedByItem.set(purchaseItem.id, pendingForRequest + requestedQty);

                normalizedItems.push({
                    original_purchase_item_id: purchaseItem.id,
                    product_id: purchaseItem.product_id,
                    quantity: requestedQty,
                    unit_cost: Number(purchaseItem.unit_cost || 0),
                    inventory_unit_cost: Number(fifoConsumption.avgCost || 0),
                    line_total: lineAmount,
                    inventory_total_cost: lineCost,
                });
            }

            const returnNumber = await this.generateReturnNumber(trx);
            const returnDate = return_date || new Date();
            const returnNotes = notes || `Return for ${purchase.bill_number}`;

            const [returnPurchase] = await trx('purchases')
                .insert({
                    bill_number: returnNumber,
                    supplier_id: purchase.supplier_id,
                    purchase_date: returnDate,
                    reference_number: purchase.bill_number,
                    subtotal,
                    discount_amount: 0,
                    tax_amount: 0,
                    total_amount: subtotal,
                    amount_paid: 0,
                    amount_due: 0,
                    payment_method: purchase.payment_method || 'bank_transfer',
                    status: 'returned',
                    notes: returnNotes,
                    is_return: true,
                    original_purchase_id: purchase.id,
                    created_by: userId,
                    tenant_id: this.tenantId,
                })
                .returning('*');

            for (const item of normalizedItems) {
                await trx('purchase_items').insert({
                    purchase_id: returnPurchase.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    line_discount: 0,
                    tax_rate: 0,
                    line_total: item.line_total,
                    original_purchase_item_id: item.original_purchase_item_id,
                    created_by: userId,
                    tenant_id: this.tenantId,
                });

                await this.stockService.createMovement({
                    product_id: item.product_id,
                    movement_type: 'OUT',
                    reference_type: 'return',
                    reference_id: returnPurchase.id,
                    quantity: item.quantity,
                    unit_cost: item.inventory_unit_cost,
                    notes: `Purchase Return ${returnNumber}`,
                    created_by: userId,
                }, trx);
            }

            const accounts = await this.getRequiredAccounts(trx);
            const supplier = await trx('suppliers')
                .where({ id: purchase.supplier_id, tenant_id: this.tenantId, is_deleted: false })
                .forUpdate()
                .select('account_id', 'current_balance', 'current_credit_used')
                .first();

            if (!supplier) {
                throw new AppError('Supplier not found', 404);
            }

            const supplierAccount = supplier?.account_id || accounts.payables;
            const outstandingBefore = Number(purchase.amount_due || 0);
            const payableReduction = roundCurrency(Math.min(outstandingBefore, subtotal));
            const refundableAmount = roundCurrency(subtotal - payableReduction);

            const refundAccount = ['cash'].includes(refund_method)
                ? accounts.cash
                : (['bank_transfer', 'cheque'].includes(refund_method) ? accounts.bank : accounts.supplier_advance);

            const journalEntries = [];

            if (subtotal > CURRENCY_TOLERANCE) {
                journalEntries.push({
                    account_id: accounts.purchase_returns,
                    entry_type: 'credit',
                    amount: roundCurrency(subtotal),
                    narration: `Purchase Return ${returnNumber}`,
                });
            }

            if (payableReduction > 0) {
                journalEntries.push({
                    account_id: supplierAccount,
                    entry_type: 'debit',
                    amount: roundCurrency(payableReduction),
                    narration: `Payable Reversal ${returnNumber}`,
                });
                
                // Add entry to 2001 control account for audit trail + matching offset to 2200
                if (supplier?.account_id && supplier.account_id !== accounts.payables) {
                    journalEntries.push({
                        account_id: accounts.payables,
                        entry_type: 'debit',
                        amount: roundCurrency(payableReduction),
                        narration: `Payable Reversal ${returnNumber} [2001]`,
                    });
                    journalEntries.push({
                        account_id: accounts.payables_summary,
                        entry_type: 'credit',
                        amount: roundCurrency(payableReduction),
                        narration: `Summary Offset ${returnNumber}`,
                    });
                }
                
                // Update GL account balances - both individual and control
                if (supplier?.account_id && supplier.account_id !== accounts.payables) {
                    await trx('accounts')
                        .where({ id: supplier.account_id })
                        .decrement('current_balance', payableReduction);
                }
                await trx('accounts')
                    .where({ id: accounts.payables })
                    .decrement('current_balance', payableReduction);
            }

            if (refundableAmount > 0) {
                journalEntries.push({
                    account_id: refundAccount,
                    entry_type: 'debit',
                    amount: roundCurrency(refundableAmount),
                    narration: `Supplier Refund ${returnNumber}`,
                });
            }

            if (totalReturnCost > 0) {
                journalEntries.push({
                    account_id: accounts.purchase_returns,
                    entry_type: 'debit',
                    amount: roundCurrency(totalReturnCost),
                    narration: `Purchase Return Cost ${returnNumber}`,
                });

                journalEntries.push({
                    account_id: accounts.inventory,
                    entry_type: 'credit',
                    amount: roundCurrency(totalReturnCost),
                    narration: `Inventory Return ${returnNumber}`,
                });
            }

            // Handle Tax Reversal (reverse Input Tax and Tax Payable)
            const originalTaxAmount = purchase.tax_amount || 0;
            const originalSubtotal = purchase.subtotal || 0;
            let returnTaxAmount = 0;
            if (originalTaxAmount > 0 && originalSubtotal > 0 && subtotal > 0) {
                returnTaxAmount = roundCurrency((subtotal / originalSubtotal) * originalTaxAmount);
            }
            if (returnTaxAmount > CURRENCY_TOLERANCE) {
                // Reverse Input Tax (1203) - credit to decrease asset
                journalEntries.push({
                    account_id: accounts.input_tax,
                    entry_type: 'credit',
                    amount: returnTaxAmount,
                    narration: `Input Tax Reversal ${returnNumber}`,
                });
                // Reverse Tax Payable (2002) - debit to decrease liability
                journalEntries.push({
                    account_id: accounts.tax_payable,
                    entry_type: 'debit',
                    amount: returnTaxAmount,
                    narration: `Tax Payable Reversal ${returnNumber}`,
                });
                // Update current_balance for both tax accounts
                await trx('accounts')
                    .where({ id: accounts.input_tax })
                    .decrement('current_balance', returnTaxAmount);
                await trx('accounts')
                    .where({ id: accounts.tax_payable })
                    .decrement('current_balance', returnTaxAmount);
            }

            const accountTypeRules = [];
            if (payableReduction > 0) {
                accountTypeRules.push({ accountId: supplierAccount, allowedTypes: ['liability'], label: 'Supplier payable account' });
            }
            if (refundableAmount > 0) {
                accountTypeRules.push({ accountId: refundAccount, allowedTypes: ['asset'], label: 'Refund account' });
            }
            if (subtotal > CURRENCY_TOLERANCE || totalReturnCost > CURRENCY_TOLERANCE) {
                accountTypeRules.push({ accountId: accounts.purchase_returns, allowedTypes: ['expense', 'income'], label: 'Purchase returns account' });
            }
            if (totalReturnCost > 0) {
                accountTypeRules.push({ accountId: accounts.inventory, allowedTypes: ['asset'], label: 'Inventory account' });
            }

            if (accountTypeRules.length > 0) {
                await validateAccountTypes(trx, this.tenantId, accountTypeRules);
            }

            if (journalEntries.length >= 2) {
                await this.ledgerService.createJournalEntry({
                    journal_date: returnDate,
                    transaction_type: 'purchase_return',
                    reference_type: 'purchase_return',
                    reference_id: returnPurchase.id,
                    narration: `Purchase Return ${returnNumber} for ${purchase.bill_number}`,
                    entries: journalEntries,
                    created_by: userId,
                }, trx);
            }

            if (purchase.supplier_id && payableReduction > 0) {
                const currentBalance = Number(supplier?.current_balance || 0);
                const currentCreditUsed = Number(supplier?.current_credit_used || 0);
                if (currentBalance < payableReduction - CURRENCY_TOLERANCE) {
                    throw new AppError(
                        `Supplier balance cannot go negative during return ${returnNumber}. Current balance: ${roundCurrency(currentBalance)}, required reduction: ${roundCurrency(payableReduction)}.`,
                        409
                    );
                }

                if (currentCreditUsed < payableReduction - CURRENCY_TOLERANCE) {
                    throw new AppError(
                        `Supplier credit usage cannot go negative during return ${returnNumber}. Current credit used: ${roundCurrency(currentCreditUsed)}, required reduction: ${roundCurrency(payableReduction)}.`,
                        409
                    );
                }

                await trx('suppliers')
                    .where({ id: purchase.supplier_id, tenant_id: this.tenantId })
                    .update({
                        current_balance: roundCurrency(currentBalance - payableReduction),
                        current_credit_used: roundCurrency(currentCreditUsed - payableReduction),
                        updated_at: trx.fn.now(),
                    });
            }

            const [{ total_returned = 0 }] = await trx('purchases')
                .where({ tenant_id: this.tenantId, original_purchase_id: purchase.id, is_return: true })
                .sum({ total_returned: 'total_amount' });

            if (Number(total_returned || 0) >= Number(purchase.total_amount || 0) - 0.01) {
                await trx('purchases')
                    .where({ id: purchase.id, tenant_id: this.tenantId })
                    .update({ status: 'returned', updated_at: trx.fn.now() });
            }

            return returnPurchase;
        });
    }

    async listReturns(params = {}) {
        const {
            page = 1,
            limit = 50,
            purchase_id,
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

            if (purchase_id) builder.where('r.original_purchase_id', purchase_id);
            if (from_date) builder.where('r.purchase_date', '>=', from_date);
            if (to_date) builder.where('r.purchase_date', '<=', to_date);
            if (search) {
                builder.where((q) => {
                    q.where('r.bill_number', 'ilike', `%${search}%`)
                        .orWhere('orig.bill_number', 'ilike', `%${search}%`)
                        .orWhere('s.name', 'ilike', `%${search}%`);
                });
            }
        };

        const query = this.db('purchases as r')
            .leftJoin('purchases as orig', 'r.original_purchase_id', 'orig.id')
            .leftJoin('suppliers as s', 'r.supplier_id', 's.id')
            .leftJoin('users as u', 'r.created_by', 'u.id')
            .select(
                'r.id',
                'r.bill_number as return_number',
                'r.original_purchase_id as purchase_id',
                'r.supplier_id',
                'r.purchase_date as return_date',
                'r.subtotal',
                'r.total_amount',
                'r.notes',
                'r.created_at',
                this.db.raw("'processed'::text as status"),
                'orig.bill_number',
                's.name as supplier_name',
                'u.full_name as created_by_name'
            );

        applyFilters(query);

        const countQuery = this.db('purchases as r')
            .leftJoin('purchases as orig', 'r.original_purchase_id', 'orig.id')
            .leftJoin('suppliers as s', 'r.supplier_id', 's.id');
        applyFilters(countQuery);

        const [{ count }] = await countQuery.count('r.id as count');

        const data = await query
            .orderBy('r.purchase_date', 'desc')
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
        const purchaseReturn = await this.db('purchases as r')
            .leftJoin('purchases as orig', 'r.original_purchase_id', 'orig.id')
            .leftJoin('suppliers as s', 'r.supplier_id', 's.id')
            .select(
                'r.id',
                'r.bill_number as return_number',
                'r.original_purchase_id as purchase_id',
                'r.supplier_id',
                'r.purchase_date as return_date',
                'r.subtotal',
                'r.total_amount',
                'r.notes',
                'r.created_at',
                this.db.raw("'processed'::text as status"),
                'orig.bill_number',
                's.name as supplier_name'
            )
            .where('r.id', returnId)
            .where('r.tenant_id', this.tenantId)
            .where('r.is_return', true)
            .first();

        if (!purchaseReturn) {
            throw new AppError('Purchase return not found', 404);
        }

        const items = await this.db('purchase_items as rpi')
            .join('products as p', 'rpi.product_id', 'p.id')
            .select(
                'rpi.id',
                this.db.raw('? as purchase_return_id', [purchaseReturn.id]),
                'rpi.original_purchase_item_id as purchase_item_id',
                'rpi.product_id',
                'rpi.quantity',
                'rpi.unit_cost',
                'rpi.line_total',
                'rpi.created_at',
                'rpi.tenant_id',
                'p.name as product_name',
                'p.code as product_code'
            )
            .where('rpi.purchase_id', purchaseReturn.id)
            .where('rpi.tenant_id', this.tenantId)
            .orderBy('rpi.created_at', 'asc');

        return {
            ...purchaseReturn,
            items,
        };
    }

    async getReturnStats(params = {}) {
        const { from_date, to_date } = params;

        const applyDateFilter = (queryBuilder, alias = 'r') => {
            if (from_date) queryBuilder.where(`${alias}.purchase_date`, '>=', from_date);
            if (to_date) queryBuilder.where(`${alias}.purchase_date`, '<=', to_date);
        };

        const returnsQuery = this.db('purchases as r')
            .where('r.tenant_id', this.tenantId)
            .where('r.is_return', true)
            .where('r.is_deleted', false);
        applyDateFilter(returnsQuery, 'r');

        const [{ total_returns = 0, total_return_amount = 0, avg_return_value = 0 }] = await returnsQuery
            .clone()
            .count('* as total_returns')
            .sum({ total_return_amount: 'r.total_amount' })
            .avg({ avg_return_value: 'r.total_amount' });

        const purchasesQuery = this.db('purchases as p')
            .where('p.tenant_id', this.tenantId)
            .where('p.is_return', false)
            .where('p.is_deleted', false);
        applyDateFilter(purchasesQuery, 'p');

        const [{ total_purchases = 0 }] = await purchasesQuery.clone().count('* as total_purchases');

        const returnsByReason = await this.getReturnReasons(params);

        const returnCount = Number(total_returns || 0);
        const purchaseCount = Number(total_purchases || 0);
        const returnRate = purchaseCount > 0
            ? Number(((returnCount / purchaseCount) * 100).toFixed(2))
            : 0;

        return {
            total_returns: returnCount,
            total_return_amount: Number(total_return_amount || 0),
            average_return_value: Number(avg_return_value || 0),
            total_purchases: purchaseCount,
            return_rate: returnRate,
            returns_by_reason: returnsByReason,
        };
    }

    async getReturnReasons(params = {}) {
        const { from_date, to_date } = params;

        const query = this.db('purchases as r')
            .where('r.tenant_id', this.tenantId)
            .where('r.is_return', true)
            .where('r.is_deleted', false)
            .whereNotNull('r.notes');

        if (from_date) query.where('r.purchase_date', '>=', from_date);
        if (to_date) query.where('r.purchase_date', '<=', to_date);

        const rows = await query
            .select(this.db.raw(`
                COALESCE(
                    NULLIF(TRIM(SUBSTRING(r.notes FROM 'Reason:\\s*([^\\n\\r]+)')), ''),
                    'Unspecified'
                ) AS reason
            `))
            .count('* as count')
            .sum({ total_amount: 'r.total_amount' })
            .groupByRaw('1')
            .orderBy('count', 'desc');

        return rows.map((row) => ({
            reason: row.reason,
            count: Number(row.count || 0),
            total_amount: Number(row.total_amount || 0),
        }));
    }
}

module.exports = PurchaseReturnService;
