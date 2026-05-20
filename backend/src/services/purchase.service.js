const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');
const LedgerService = require('./ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const { validateAccountTypes } = require('../utils/accountTypeValidation');

const CURRENCY_TOLERANCE = 0.01;
const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'y'].includes(normalized);
};

function assertBalancedJournal(entries) {
    const debitTotal = roundCurrency(entries
        .filter((entry) => entry.entry_type === 'debit')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));

    const creditTotal = roundCurrency(entries
        .filter((entry) => entry.entry_type === 'credit')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));

    if (Math.abs(debitTotal - creditTotal) > CURRENCY_TOLERANCE) {
        throw new AppError(
            `Purchase journal is not balanced. Debits: ${debitTotal.toFixed(2)}, Credits: ${creditTotal.toFixed(2)}`,
            400
        );
    }
}

class PurchaseService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.stockService = new StockService(db, tenantId);
        this.ledgerService = new LedgerService(db, tenantId);
    }

    normalizeFingerprintItems(items = []) {
        if (!Array.isArray(items)) return [];

        return items
            .map((item) => ({
                product_id: item.product_id,
                quantity: roundCurrency(Number(item.quantity || 0)),
                unit_cost: roundCurrency(Number(item.unit_cost ?? item.unit_price ?? 0)),
                line_discount: roundCurrency(Number(item.line_discount || 0)),
            }))
            .filter((item) => item.product_id && item.quantity > 0)
            .sort((a, b) => String(a.product_id).localeCompare(String(b.product_id)));
    }

    buildDuplicateFingerprint({ supplierId = null, referenceNumber = '', totalAmount = 0, items = [] }) {
        const normalizedItems = this.normalizeFingerprintItems(items)
            .map((item) => `${item.product_id}:${item.quantity.toFixed(2)}:${item.unit_cost.toFixed(2)}:${item.line_discount.toFixed(2)}`)
            .join('|');

        const fingerprintSeed = [
            supplierId || 'none',
            String(referenceNumber || '').trim().toLowerCase(),
            roundCurrency(totalAmount).toFixed(2),
            normalizedItems,
        ].join('#');

        return crypto.createHash('sha256').update(fingerprintSeed).digest('hex');
    }

    toTemplateItems(items = []) {
        if (!Array.isArray(items)) return [];

        return items.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            unit_cost: Number(item.unit_cost ?? item.unit_price),
            line_discount: Number(item.line_discount || 0),
            tax_rate: Number(item.tax_rate || 0),
        }));
    }

    parseTemplateItems(rawItems) {
        if (Array.isArray(rawItems)) return rawItems;
        if (typeof rawItems === 'string') {
            try {
                const parsed = JSON.parse(rawItems);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }

        return [];
    }

    async ensureSupplierExists(trx, supplierId) {
        if (!supplierId) return null;

        const supplier = await trx('suppliers')
            .where({ id: supplierId, tenant_id: this.tenantId, is_deleted: false })
            .first();

        if (!supplier) {
            throw new AppError('Supplier not found', 404);
        }

        return supplier;
    }

    async normalizeDraftItems(trx, items, userId) {
        const processedItems = [];
        let subtotal = 0;

        for (const item of items) {
            const quantity = Number(item.quantity);
            const unitCost = Number(item.unit_cost ?? item.unit_price);
            const lineDiscount = Number(item.line_discount || 0);
            const taxRate = Number(item.tax_rate || 0);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new AppError('Item quantity must be a positive number', 400);
            }
            if (!Number.isFinite(unitCost) || unitCost < 0) {
                throw new AppError('Item unit_cost must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(lineDiscount) || lineDiscount < 0) {
                throw new AppError('Item line_discount must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(taxRate) || taxRate < 0) {
                throw new AppError('Item tax_rate must be a valid non-negative number', 400);
            }
            if (lineDiscount > (quantity * unitCost) + CURRENCY_TOLERANCE) {
                throw new AppError('Item line_discount cannot exceed line gross amount', 400);
            }

            const product = await trx('products')
                .where({ id: item.product_id, tenant_id: this.tenantId, is_deleted: false })
                .first('id');

            if (!product) {
                throw new AppError(`Product not found: ${item.product_id}`, 404);
            }

            const lineTotal = roundCurrency((quantity * unitCost) - lineDiscount);
            subtotal += (quantity * unitCost);

            processedItems.push({
                product_id: item.product_id,
                quantity,
                unit_cost: unitCost,
                line_discount: lineDiscount,
                tax_rate: taxRate,
                line_total: lineTotal,
                created_by: userId,
            });
        }

        return {
            subtotal: roundCurrency(subtotal),
            processedItems,
        };
    }

    async generateDraftNumber(trx) {
        let sequence = await trx('sequences')
            .where({ name: 'purchase_draft', tenant_id: this.tenantId })
            .forUpdate()
            .first();

        if (!sequence) {
            await trx('sequences').insert({
                name: 'purchase_draft',
                prefix: 'PDR-',
                current_value: 0,
                pad_length: 6,
                is_active: true,
                description: 'Purchase Draft Numbering',
                tenant_id: this.tenantId,
            });

            sequence = await trx('sequences')
                .where({ name: 'purchase_draft', tenant_id: this.tenantId })
                .forUpdate()
                .first();
        }

        if (!sequence) {
            throw new AppError('Purchase draft sequence not found', 500);
        }

        const nextVal = Number(sequence.current_value || 0) + 1;
        const prefix = sequence.prefix || 'PDR-';
        const padLength = sequence.pad_length || 6;

        await trx('sequences')
            .where({ name: 'purchase_draft', tenant_id: this.tenantId })
            .update({ current_value: nextVal });

        return `${prefix}${String(nextVal).padStart(padLength, '0')}`;
    }

    async createDraft(data, userId) {
        const {
            supplier_id,
            purchase_date,
            reference_number,
            items,
            discount_amount = 0,
            tax_amount = 0,
            amount_paid = 0,
            payment_method = 'bank_transfer',
            notes,
        } = data;

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError('At least one purchase item is required', 400);
        }

        const numericDiscountAmount = Number(discount_amount || 0);
        const numericTaxAmount = Number(tax_amount || 0);
        const numericAmountPaid = Number(amount_paid || 0);

        if (!Number.isFinite(numericDiscountAmount) || numericDiscountAmount < 0) {
            throw new AppError('discount_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericTaxAmount) || numericTaxAmount < 0) {
            throw new AppError('tax_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericAmountPaid) || numericAmountPaid < 0) {
            throw new AppError('amount_paid must be a valid non-negative number', 400);
        }

        return this.db.transaction(async (trx) => {
            if (supplier_id) {
                await this.ensureSupplierExists(trx, supplier_id);
            }

            const { subtotal, processedItems } = await this.normalizeDraftItems(trx, items, userId);

            if (numericDiscountAmount > subtotal + CURRENCY_TOLERANCE) {
                throw new AppError('discount_amount cannot exceed purchase subtotal', 400);
            }

            const totalAmount = roundCurrency((subtotal - numericDiscountAmount) + numericTaxAmount);
            const duplicateFingerprint = this.buildDuplicateFingerprint({
                supplierId: supplier_id || null,
                referenceNumber: reference_number,
                totalAmount,
                items: processedItems,
            });

            if (numericAmountPaid > totalAmount + CURRENCY_TOLERANCE) {
                throw new AppError('amount_paid cannot exceed total_amount for draft purchases', 400);
            }

            const amountDue = roundCurrency(Math.max(0, totalAmount - numericAmountPaid));
            const draftNumber = await this.generateDraftNumber(trx);

            const [draft] = await trx('purchases').insert({
                bill_number: draftNumber,
                supplier_id: supplier_id || null,
                purchase_date: purchase_date || new Date(),
                reference_number,
                subtotal,
                discount_amount: numericDiscountAmount,
                tax_amount: numericTaxAmount,
                total_amount: totalAmount,
                amount_paid: numericAmountPaid,
                amount_due: amountDue,
                payment_method,
                status: 'draft',
                duplicate_fingerprint: duplicateFingerprint,
                notes,
                created_by: userId,
                updated_by: userId,
                tenant_id: this.tenantId,
            }).returning('*');

            for (const item of processedItems) {
                await trx('purchase_items').insert({
                    purchase_id: draft.id,
                    ...item,
                    tenant_id: this.tenantId,
                });
            }

            return draft;
        });
    }

    async updateDraft(id, data, userId) {
        return this.db.transaction(async (trx) => {
            const draft = await trx('purchases')
                .where({ id, tenant_id: this.tenantId, is_deleted: false })
                .where((builder) => {
                    builder.whereNull('is_return').orWhere('is_return', false);
                })
                .forUpdate()
                .first();

            if (!draft) {
                throw new AppError('Purchase not found', 404);
            }

            if (draft.status !== 'draft') {
                throw new AppError('Only draft purchases can be edited', 409);
            }

            const supplierId = Object.prototype.hasOwnProperty.call(data, 'supplier_id')
                ? data.supplier_id
                : draft.supplier_id;

            if (supplierId) {
                await this.ensureSupplierExists(trx, supplierId);
            }

            const hasItemsUpdate = Array.isArray(data.items);
            if (hasItemsUpdate && data.items.length === 0) {
                throw new AppError('At least one purchase item is required', 400);
            }

            const itemsSource = hasItemsUpdate
                ? data.items
                : await trx('purchase_items')
                    .where({ purchase_id: id, tenant_id: this.tenantId })
                    .select('product_id', 'quantity', 'unit_cost', 'line_discount', 'tax_rate');

            if (!Array.isArray(itemsSource) || itemsSource.length === 0) {
                throw new AppError('At least one purchase item is required', 400);
            }

            const { subtotal, processedItems } = await this.normalizeDraftItems(trx, itemsSource, userId);

            const numericDiscountAmount = Object.prototype.hasOwnProperty.call(data, 'discount_amount')
                ? Number(data.discount_amount || 0)
                : Number(draft.discount_amount || 0);
            const numericTaxAmount = Object.prototype.hasOwnProperty.call(data, 'tax_amount')
                ? Number(data.tax_amount || 0)
                : Number(draft.tax_amount || 0);
            const numericAmountPaid = Object.prototype.hasOwnProperty.call(data, 'amount_paid')
                ? Number(data.amount_paid || 0)
                : Number(draft.amount_paid || 0);

            if (!Number.isFinite(numericDiscountAmount) || numericDiscountAmount < 0) {
                throw new AppError('discount_amount must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(numericTaxAmount) || numericTaxAmount < 0) {
                throw new AppError('tax_amount must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(numericAmountPaid) || numericAmountPaid < 0) {
                throw new AppError('amount_paid must be a valid non-negative number', 400);
            }

            if (numericDiscountAmount > subtotal + CURRENCY_TOLERANCE) {
                throw new AppError('discount_amount cannot exceed purchase subtotal', 400);
            }

            const totalAmount = roundCurrency((subtotal - numericDiscountAmount) + numericTaxAmount);
            const duplicateFingerprint = this.buildDuplicateFingerprint({
                supplierId: supplierId || null,
                referenceNumber: Object.prototype.hasOwnProperty.call(data, 'reference_number')
                    ? data.reference_number
                    : draft.reference_number,
                totalAmount,
                items: processedItems,
            });

            if (numericAmountPaid > totalAmount + CURRENCY_TOLERANCE) {
                throw new AppError('amount_paid cannot exceed total_amount for draft purchases', 400);
            }

            const amountDue = roundCurrency(Math.max(0, totalAmount - numericAmountPaid));

            if (hasItemsUpdate) {
                await trx('purchase_items')
                    .where({ purchase_id: id, tenant_id: this.tenantId })
                    .del();

                for (const item of processedItems) {
                    await trx('purchase_items').insert({
                        purchase_id: id,
                        ...item,
                        tenant_id: this.tenantId,
                    });
                }
            }

            const [updated] = await trx('purchases')
                .where({ id, tenant_id: this.tenantId })
                .update({
                    supplier_id: supplierId || null,
                    purchase_date: data.purchase_date || draft.purchase_date,
                    reference_number: Object.prototype.hasOwnProperty.call(data, 'reference_number')
                        ? data.reference_number
                        : draft.reference_number,
                    subtotal,
                    discount_amount: numericDiscountAmount,
                    tax_amount: numericTaxAmount,
                    total_amount: totalAmount,
                    amount_paid: numericAmountPaid,
                    amount_due: amountDue,
                    payment_method: data.payment_method || draft.payment_method,
                    duplicate_fingerprint: duplicateFingerprint,
                    notes: Object.prototype.hasOwnProperty.call(data, 'notes') ? data.notes : draft.notes,
                    updated_by: userId,
                    updated_at: trx.fn.now(),
                })
                .returning('*');

            return updated;
        });
    }

    async cancelPurchase(id, data = {}, userId) {
        return this.db.transaction(async (trx) => {
            const purchase = await trx('purchases')
                .where({ id, tenant_id: this.tenantId, is_deleted: false })
                .where((builder) => {
                    builder.whereNull('is_return').orWhere('is_return', false);
                })
                .forUpdate()
                .first();

            if (!purchase) {
                throw new AppError('Purchase not found', 404);
            }

            if (purchase.status === 'cancelled') {
                throw new AppError('Purchase is already cancelled', 409);
            }

            if (purchase.status === 'returned') {
                throw new AppError('Returned purchases cannot be cancelled', 409);
            }

            if (purchase.status !== 'draft') {
                throw new AppError('Only draft purchases can be cancelled safely', 409);
            }

            const cancellationReason = String(data.reason || data.notes || '').trim();
            const existingNotes = String(purchase.notes || '').trim();
            const cancellationNote = cancellationReason
                ? `[Cancelled] ${cancellationReason}`
                : '[Cancelled]';

            const mergedNotes = existingNotes
                ? `${existingNotes}\n${cancellationNote}`
                : cancellationNote;

            const [cancelled] = await trx('purchases')
                .where({ id, tenant_id: this.tenantId })
                .update({
                    status: 'cancelled',
                    cancelled_at: trx.fn.now(),
                    cancelled_by: userId,
                    notes: mergedNotes,
                    updated_by: userId,
                    updated_at: trx.fn.now(),
                })
                .returning('*');

            return cancelled;
        });
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

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError('At least one purchase item is required', 400);
        }

        const numericDiscountAmount = Number(discount_amount || 0);
        const numericTaxAmount = Number(tax_amount || 0);
        const numericAmountPaid = Number(amount_paid || 0);

        if (!Number.isFinite(numericDiscountAmount) || numericDiscountAmount < 0) {
            throw new AppError('discount_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericTaxAmount) || numericTaxAmount < 0) {
            throw new AppError('tax_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericAmountPaid) || numericAmountPaid < 0) {
            throw new AppError('amount_paid must be a valid non-negative number', 400);
        }

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
                        const quantity = Number(item.quantity);
                        const unitCost = Number(item.unit_cost);
                        const lineDiscount = Number(item.line_discount || 0);

                        if (!Number.isFinite(quantity) || quantity <= 0) {
                            throw new AppError('Item quantity must be a positive number', 400);
                        }
                        if (!Number.isFinite(unitCost) || unitCost < 0) {
                            throw new AppError('Item unit_cost must be a valid non-negative number', 400);
                        }
                        if (!Number.isFinite(lineDiscount) || lineDiscount < 0) {
                            throw new AppError('Item line_discount must be a valid non-negative number', 400);
                        }
                        if (lineDiscount > (quantity * unitCost) + 0.01) {
                            throw new AppError('Item line_discount cannot exceed line gross amount', 400);
                        }

                        const product = await trx('products')
                            .where({ id: item.product_id, tenant_id: this.tenantId, is_deleted: false })
                            .first();
                        if (!product) throw new AppError(`Product not found: ${item.product_id}`, 404);

                        const lineTotal = (quantity * unitCost) - lineDiscount;
                        subtotal += (quantity * unitCost);

                        processedItems.push({
                            product_id: item.product_id,
                            quantity,
                            unit_cost: unitCost,
                            line_discount: lineDiscount,
                            tax_rate: item.tax_rate || 0,
                            line_total: lineTotal,
                            created_by: userId
                        });

                        // Create Stock Movement (IN)
                        await this.stockService.createMovement({
                            product_id: item.product_id,
                            movement_type: 'IN',
                            reference_type: 'purchase',
                            quantity,
                            unit_cost: unitCost,
                            notes: `Purchase ${billNumber}`,
                            created_by: userId
                        }, trx);
                    }

                    if (numericDiscountAmount > subtotal + CURRENCY_TOLERANCE) {
                        throw new AppError('discount_amount cannot exceed purchase subtotal', 400);
                    }

                    const totalAmount = roundCurrency((subtotal - numericDiscountAmount) + numericTaxAmount);
                    const duplicateFingerprint = this.buildDuplicateFingerprint({
                        supplierId: supplier_id || null,
                        referenceNumber: reference_number,
                        totalAmount,
                        items: processedItems,
                    });
                    const overpayment = roundCurrency(Math.max(0, numericAmountPaid - totalAmount));
                    
                    // Handle overpayment: clamp amount_due to 0 (constraint requires >= 0)
                    let amountDue = roundCurrency(totalAmount - numericAmountPaid);
                    if (amountDue < 0) {
                        amountDue = 0; // Overpaid - no amount due
                    }
                    const status = amountDue <= 0 ? 'paid' : 'billed';

                    let supplier = null;
                    if (supplier_id) {
                        supplier = await trx('suppliers')
                            .where({ id: supplier_id, tenant_id: this.tenantId, is_deleted: false })
                            .forUpdate()
                            .select('id', 'name', 'account_id', 'current_balance', 'credit_limit', 'current_credit_used')
                            .first();

                        if (!supplier) {
                            throw new AppError('Supplier not found', 404);
                        }
                    }

                    if ((amountDue > 0 || overpayment > 0) && !supplier_id) {
                        throw new AppError('Supplier is required for unpaid or overpaid purchases', 400);
                    }

                    // 3. Enforce supplier credit limit and update supplier balances
                    if (supplier_id && amountDue > 0) {
                        const currentPayable = Math.max(0, roundCurrency(Number(supplier.current_balance || 0)));
                        const currentCreditUsed = Math.max(0, roundCurrency(Number(supplier.current_credit_used || 0)));
                        const supplierCreditLimit = supplier.credit_limit === null || supplier.credit_limit === undefined
                            ? null
                            : roundCurrency(Number(supplier.credit_limit));

                        if (supplierCreditLimit !== null && (!Number.isFinite(supplierCreditLimit) || supplierCreditLimit < 0)) {
                            throw new AppError('Invalid supplier credit configuration', 400);
                        }

                        const projectedExposure = roundCurrency(currentCreditUsed + amountDue);
                        if (supplierCreditLimit !== null && projectedExposure > supplierCreditLimit + CURRENCY_TOLERANCE) {
                            const availableCredit = Math.max(0, roundCurrency(supplierCreditLimit - currentCreditUsed));
                            throw new AppError(
                                `Supplier credit limit exceeded for ${supplier.name}. Available: ${availableCredit.toFixed(2)}`,
                                409
                            );
                        }

                        await trx('suppliers')
                            .where({ id: supplier_id, tenant_id: this.tenantId })
                            .update({
                                current_balance: trx.raw('COALESCE(current_balance, 0) + ?', [roundCurrency(amountDue)]),
                                current_credit_used: trx.raw('COALESCE(current_credit_used, 0) + ?', [roundCurrency(amountDue)]),
                                updated_at: trx.fn.now(),
                            });
                    }

                    // 4. Create Purchase Record
                    const [purchase] = await trx('purchases').insert({
                        bill_number: billNumber,
                        supplier_id,
                        purchase_date: purchase_date || new Date(),
                        reference_number,
                        subtotal,
                        discount_amount: numericDiscountAmount,
                        tax_amount: numericTaxAmount,
                        total_amount: totalAmount,
                        amount_paid: numericAmountPaid,
                        amount_due: amountDue,
                        status,
                        duplicate_fingerprint: duplicateFingerprint,
                        notes,
                        created_by: userId,
                        tenant_id: this.tenantId
                    }).returning('*');

                    // 5. Create Purchase Items
                    for (const item of processedItems) {
                        await trx('purchase_items').insert({
                            purchase_id: purchase.id,
                            ...item,
                            tenant_id: this.tenantId
                        });
                    }

                    // 6. ACCOUNTING: Journal & Ledger Entries
                    const accounts = await this.getRequiredAccounts(trx);
                    const supplierAccountId = supplier?.account_id || accounts.payables;

                    if (!supplierAccountId) {
                        throw new AppError('Supplier payable account not found', 500);
                    }

                    // Record inventory at gross line subtotal, and post discount to a dedicated contra-purchase account.
                    const inventoryValue = roundCurrency(subtotal);

                    const journalEntries = [
                        // Debit Inventory (Asset)
                        { account_id: accounts.inventory, entry_type: 'debit', amount: inventoryValue, narration: `Inventory In ${billNumber}` }
                    ];

                    if (numericDiscountAmount > 0) {
                        journalEntries.push({
                            account_id: accounts.purchase_discount,
                            entry_type: 'credit',
                            amount: roundCurrency(numericDiscountAmount),
                            narration: `Purchase Discount ${billNumber}`,
                        });
                    }

                    if (numericTaxAmount > 0) {
                        journalEntries.push({ account_id: accounts.input_tax, entry_type: 'debit', amount: roundCurrency(numericTaxAmount), narration: `Input Tax ${billNumber}` });
                    }

                    // Handle Payment - credit the full amount paid from cash/bank
                    const paymentAccount = payment_method === 'cash' ? accounts.cash : accounts.bank;

                    if (numericAmountPaid > 0) {
                        journalEntries.push({ account_id: paymentAccount, entry_type: 'credit', amount: roundCurrency(numericAmountPaid), narration: `Payment for ${billNumber}` });
                    }

                    // Overpayment creates a supplier advance (debit to supplier control account)
                    if (overpayment > 0) {
                        journalEntries.push({ account_id: accounts.supplier_advance, entry_type: 'debit', amount: roundCurrency(overpayment), narration: `Supplier Advance ${billNumber}` });
                    }

                    if (amountDue > 0) {
                        journalEntries.push({ account_id: supplierAccountId, entry_type: 'credit', amount: roundCurrency(amountDue), narration: `Payable ${billNumber}`, reference_id: purchase.id });
                        
                        // Update account balances and add entries to both individual and control (2001)
                        if (supplier?.account_id && supplier.account_id !== accounts.payables) {
                            await trx('accounts')
                                .where({ id: supplier.account_id })
                                .increment('current_balance', amountDue);
                            
                            // Add entry to 2001 for audit trail + matching offset to 2200
                            journalEntries.push({
                                account_id: accounts.payables,
                                entry_type: 'credit',
                                amount: roundCurrency(amountDue),
                                narration: `Payable ${billNumber} [2001]`,
                                reference_id: purchase.id
                            });
                            journalEntries.push({
                                account_id: accounts.payables_summary,
                                entry_type: 'debit',
                                amount: roundCurrency(amountDue),
                                narration: `Summary Offset ${billNumber}`,
                                reference_id: purchase.id
                            });
                        }
                        await trx('accounts')
                            .where({ id: accounts.payables })
                            .increment('current_balance', amountDue);
                    }

                    assertBalancedJournal(journalEntries);

                    const accountTypeRules = [
                        { accountId: accounts.inventory, allowedTypes: ['asset'], label: 'Inventory account' },
                    ];

                    if (numericAmountPaid > 0) {
                        accountTypeRules.push({ accountId: paymentAccount, allowedTypes: ['asset'], label: 'Payment account' });
                    }

                    if (numericTaxAmount > 0) {
                        accountTypeRules.push({ accountId: accounts.input_tax, allowedTypes: ['asset'], label: 'Input tax account' });
                    }

                    if (numericDiscountAmount > 0) {
                        accountTypeRules.push({ accountId: accounts.purchase_discount, allowedTypes: ['expense', 'income'], label: 'Purchase discount account' });
                    }

                    if (overpayment > 0) {
                        accountTypeRules.push({ accountId: accounts.supplier_advance, allowedTypes: ['asset'], label: 'Supplier advance account' });
                    }

                    if (amountDue > 0) {
                        accountTypeRules.push({ accountId: supplierAccountId, allowedTypes: ['liability'], label: 'Supplier payable account' });
                    }

                    await validateAccountTypes(trx, this.tenantId, accountTypeRules);

                    await this.ledgerService.createJournalEntry({
                        journal_date: purchase.purchase_date,
                        transaction_type: 'purchase',
                        reference_type: 'purchase',
                        reference_id: purchase.id,
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
                        await this.db('sequences').where({ name: 'purchase', tenant_id: this.tenantId }).update({ current_value: maxNum });
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

    async getJournalPreview(data) {
        const {
            supplier_id,
            reference_number,
            items,
            discount_amount = 0,
            tax_amount = 0,
            amount_paid = 0,
            payment_method = 'bank_transfer',
        } = data;

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError('At least one purchase item is required', 400);
        }

        const numericDiscountAmount = Number(discount_amount || 0);
        const numericTaxAmount = Number(tax_amount || 0);
        const numericAmountPaid = Number(amount_paid || 0);

        if (!Number.isFinite(numericDiscountAmount) || numericDiscountAmount < 0) {
            throw new AppError('discount_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericTaxAmount) || numericTaxAmount < 0) {
            throw new AppError('tax_amount must be a valid non-negative number', 400);
        }
        if (!Number.isFinite(numericAmountPaid) || numericAmountPaid < 0) {
            throw new AppError('amount_paid must be a valid non-negative number', 400);
        }

        return this.db.transaction(async (trx) => {
            const supplier = supplier_id
                ? await trx('suppliers')
                    .where({ id: supplier_id, tenant_id: this.tenantId, is_deleted: false })
                    .first('id', 'name', 'account_id')
                : null;

            if (supplier_id && !supplier) {
                throw new AppError('Supplier not found', 404);
            }

            const { subtotal, processedItems } = await this.normalizeDraftItems(trx, items, null);

            if (numericDiscountAmount > subtotal + CURRENCY_TOLERANCE) {
                throw new AppError('discount_amount cannot exceed purchase subtotal', 400);
            }

            const totalAmount = roundCurrency((subtotal - numericDiscountAmount) + numericTaxAmount);
            const overpayment = roundCurrency(Math.max(0, numericAmountPaid - totalAmount));
            const amountDue = roundCurrency(Math.max(0, totalAmount - numericAmountPaid));

            if ((amountDue > 0 || overpayment > 0) && !supplier_id) {
                throw new AppError('Supplier is required for unpaid or overpaid purchases', 400);
            }

            const accounts = await this.getRequiredAccounts(trx);
            const supplierAccountId = supplier?.account_id || accounts.payables;
            const paymentAccount = payment_method === 'cash' ? accounts.cash : accounts.bank;

            const journalEntries = [
                { account_id: accounts.inventory, entry_type: 'debit', amount: roundCurrency(subtotal), narration: 'Inventory In (Preview)' },
            ];

            if (numericDiscountAmount > 0) {
                journalEntries.push({
                    account_id: accounts.purchase_discount,
                    entry_type: 'credit',
                    amount: roundCurrency(numericDiscountAmount),
                    narration: 'Purchase Discount (Preview)',
                });
            }

            if (numericTaxAmount > 0) {
                journalEntries.push({
                    account_id: accounts.input_tax,
                    entry_type: 'debit',
                    amount: roundCurrency(numericTaxAmount),
                    narration: 'Input Tax (Preview)',
                });
            }

            if (numericAmountPaid > 0) {
                journalEntries.push({
                    account_id: paymentAccount,
                    entry_type: 'credit',
                    amount: roundCurrency(numericAmountPaid),
                    narration: 'Payment (Preview)',
                });
            }

            if (overpayment > 0) {
                journalEntries.push({
                    account_id: accounts.supplier_advance,
                    entry_type: 'debit',
                    amount: roundCurrency(overpayment),
                    narration: 'Supplier Advance (Preview)',
                });
            }

            if (amountDue > 0) {
                journalEntries.push({
                    account_id: supplierAccountId,
                    entry_type: 'credit',
                    amount: roundCurrency(amountDue),
                    narration: 'Supplier Payable (Preview)',
                });
            }

            assertBalancedJournal(journalEntries);

            const accountTypeRules = [
                { accountId: accounts.inventory, allowedTypes: ['asset'], label: 'Inventory account' },
            ];

            if (numericAmountPaid > 0) {
                accountTypeRules.push({ accountId: paymentAccount, allowedTypes: ['asset'], label: 'Payment account' });
            }
            if (numericTaxAmount > 0) {
                accountTypeRules.push({ accountId: accounts.input_tax, allowedTypes: ['asset'], label: 'Input tax account' });
            }
            if (numericDiscountAmount > 0) {
                accountTypeRules.push({ accountId: accounts.purchase_discount, allowedTypes: ['expense', 'income'], label: 'Purchase discount account' });
            }
            if (overpayment > 0) {
                accountTypeRules.push({ accountId: accounts.supplier_advance, allowedTypes: ['asset'], label: 'Supplier advance account' });
            }
            if (amountDue > 0) {
                accountTypeRules.push({ accountId: supplierAccountId, allowedTypes: ['liability'], label: 'Supplier payable account' });
            }

            await validateAccountTypes(trx, this.tenantId, accountTypeRules);

            return {
                status: amountDue <= 0 ? 'paid' : 'billed',
                supplier_id: supplier_id || null,
                reference_number: reference_number || null,
                subtotal,
                discount_amount: roundCurrency(numericDiscountAmount),
                tax_amount: roundCurrency(numericTaxAmount),
                total_amount: totalAmount,
                amount_paid: roundCurrency(numericAmountPaid),
                amount_due: amountDue,
                overpayment,
                payment_method,
                duplicate_fingerprint: this.buildDuplicateFingerprint({
                    supplierId: supplier_id || null,
                    referenceNumber: reference_number,
                    totalAmount,
                    items: processedItems,
                }),
                journal_entries: journalEntries,
                is_balanced: true,
            };
        });
    }

    async checkDuplicateRisk(data = {}) {
        const supplierId = data.supplier_id || null;
        const referenceNumber = String(data.reference_number || '').trim();

        const purchaseDate = data.purchase_date ? new Date(data.purchase_date) : new Date();
        if (Number.isNaN(purchaseDate.getTime())) {
            throw new AppError('purchase_date must be a valid date', 400);
        }

        const normalizedItems = this.normalizeFingerprintItems(data.items || []);
        let totalAmount = Number(data.total_amount);

        if (!Number.isFinite(totalAmount)) {
            if (normalizedItems.length === 0) {
                throw new AppError('total_amount or valid items are required for duplicate check', 400);
            }

            totalAmount = roundCurrency(normalizedItems.reduce(
                (sum, item) => sum + (item.quantity * item.unit_cost) - item.line_discount,
                0
            ));
        }

        const configuredWindow = Number(data.window_days);
        const windowDays = Number.isFinite(configuredWindow) && configuredWindow > 0
            ? Math.min(Math.floor(configuredWindow), 120)
            : 30;

        const windowStart = new Date(purchaseDate);
        windowStart.setDate(windowStart.getDate() - windowDays);
        const windowEnd = new Date(purchaseDate);
        windowEnd.setDate(windowEnd.getDate() + windowDays);

        let query = this.db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .where('p.tenant_id', this.tenantId)
            .where('p.is_deleted', false)
            .where((q) => {
                q.whereNull('p.is_return').orWhere('p.is_return', false);
            })
            .whereNot('p.status', 'cancelled')
            .whereBetween('p.purchase_date', [windowStart, windowEnd])
            .select(
                'p.id',
                'p.bill_number',
                'p.supplier_id',
                'p.reference_number',
                'p.purchase_date',
                'p.total_amount',
                'p.status',
                'p.duplicate_fingerprint',
                's.name as supplier_name'
            );

        if (supplierId) {
            query = query.where('p.supplier_id', supplierId);
        }

        if (referenceNumber) {
            query = query.where((q) => {
                q.whereILike('p.reference_number', referenceNumber)
                    .orWhereILike('p.reference_number', `%${referenceNumber}%`);
            });
        } else {
            const minTotal = Math.max(0, roundCurrency(totalAmount - 100));
            const maxTotal = roundCurrency(totalAmount + 100);
            query = query.whereBetween('p.total_amount', [minTotal, maxTotal]);
        }

        const candidates = await query.orderBy('p.purchase_date', 'desc').limit(50);
        const targetFingerprint = normalizedItems.length > 0
            ? this.buildDuplicateFingerprint({
                supplierId,
                referenceNumber,
                totalAmount,
                items: normalizedItems,
            })
            : null;

        const matches = candidates
            .map((candidate) => {
                let score = 0;
                const reasons = [];

                const candidateReference = String(candidate.reference_number || '').trim().toLowerCase();
                const targetReference = referenceNumber.toLowerCase();
                if (targetReference && candidateReference && candidateReference === targetReference) {
                    score += 65;
                    reasons.push('exact_reference_match');
                }

                if (targetFingerprint && candidate.duplicate_fingerprint && candidate.duplicate_fingerprint === targetFingerprint) {
                    score += 85;
                    reasons.push('matching_item_fingerprint');
                }

                const amountDelta = roundCurrency(Math.abs(Number(candidate.total_amount || 0) - roundCurrency(totalAmount)));
                if (amountDelta <= CURRENCY_TOLERANCE) {
                    score += 25;
                    reasons.push('same_total_amount');
                } else if (amountDelta <= 5) {
                    score += 15;
                    reasons.push('close_total_amount');
                }

                if (supplierId && String(candidate.supplier_id) === String(supplierId)) {
                    score += 10;
                    reasons.push('same_supplier');
                }

                const dayDelta = Math.abs(
                    Math.floor((new Date(candidate.purchase_date).getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
                );
                if (dayDelta <= 3) {
                    score += 10;
                    reasons.push('nearby_purchase_date');
                } else if (dayDelta <= 7) {
                    score += 5;
                    reasons.push('same_week');
                }

                return {
                    id: candidate.id,
                    bill_number: candidate.bill_number,
                    supplier_id: candidate.supplier_id,
                    supplier_name: candidate.supplier_name,
                    purchase_date: candidate.purchase_date,
                    total_amount: Number(candidate.total_amount || 0),
                    amount_delta: amountDelta,
                    day_delta: Number.isFinite(dayDelta) ? dayDelta : null,
                    risk_score: Math.min(100, score),
                    reasons,
                };
            })
            .filter((row) => row.risk_score >= 40)
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 10);

        return {
            is_duplicate_risk: matches.some((row) => row.risk_score >= 70),
            duplicate_fingerprint: targetFingerprint,
            evaluated_candidates: candidates.length,
            matches,
        };
    }

    async listTemplates(params = {}) {
        const {
            page = 1,
            limit = 50,
            search,
            active_only = true,
        } = params;

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 50;
        const offset = (pageNumber - 1) * pageLimit;
        const activeOnly = parseBoolean(active_only, true);

        const applyFilters = (builder) => {
            builder.where('pt.tenant_id', this.tenantId).where('pt.is_deleted', false);

            if (activeOnly) {
                builder.where('pt.is_active', true);
            }

            if (search) {
                builder.where((q) => {
                    q.whereILike('pt.name', `%${search}%`)
                        .orWhereILike('pt.description', `%${search}%`)
                        .orWhereILike('s.name', `%${search}%`);
                });
            }
        };

        const dataQuery = this.db('purchase_templates as pt')
            .leftJoin('suppliers as s', 'pt.supplier_id', 's.id')
            .select('pt.*', 's.name as supplier_name');
        applyFilters(dataQuery);

        const countQuery = this.db('purchase_templates as pt')
            .leftJoin('suppliers as s', 'pt.supplier_id', 's.id');
        applyFilters(countQuery);

        const [{ count }] = await countQuery.count('* as count');
        const templates = await dataQuery
            .orderBy('pt.updated_at', 'desc')
            .limit(pageLimit)
            .offset(offset);

        const total = Number(count || 0);

        return {
            data: templates,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total,
                pages: Math.max(1, Math.ceil(total / pageLimit)),
            },
        };
    }

    async getTemplate(templateId) {
        const template = await this.db('purchase_templates as pt')
            .leftJoin('suppliers as s', 'pt.supplier_id', 's.id')
            .where('pt.id', templateId)
            .where('pt.tenant_id', this.tenantId)
            .where('pt.is_deleted', false)
            .select('pt.*', 's.name as supplier_name')
            .first();

        if (!template) {
            throw new AppError('Purchase template not found', 404);
        }

        return template;
    }

    async createTemplate(data, userId) {
        const name = String(data.name || '').trim();
        if (!name) {
            throw new AppError('Template name is required', 400);
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new AppError('At least one item is required in a template', 400);
        }

        return this.db.transaction(async (trx) => {
            if (data.supplier_id) {
                await this.ensureSupplierExists(trx, data.supplier_id);
            }

            const duplicateName = await trx('purchase_templates')
                .where('tenant_id', this.tenantId)
                .where('is_deleted', false)
                .whereRaw('LOWER(name) = LOWER(?)', [name])
                .first('id');

            if (duplicateName) {
                throw new AppError('Template name already exists', 409);
            }

            const { subtotal, processedItems } = await this.normalizeDraftItems(trx, data.items, userId);

            const discountAmount = Number(data.discount_amount || 0);
            const taxAmount = Number(data.tax_amount || 0);

            if (!Number.isFinite(discountAmount) || discountAmount < 0) {
                throw new AppError('discount_amount must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(taxAmount) || taxAmount < 0) {
                throw new AppError('tax_amount must be a valid non-negative number', 400);
            }
            if (discountAmount > subtotal + CURRENCY_TOLERANCE) {
                throw new AppError('discount_amount cannot exceed template subtotal', 400);
            }

            const totalAmount = roundCurrency((subtotal - discountAmount) + taxAmount);

            const [template] = await trx('purchase_templates').insert({
                name,
                description: data.description || null,
                supplier_id: data.supplier_id || null,
                payment_method: data.payment_method || 'bank_transfer',
                subtotal,
                discount_amount: roundCurrency(discountAmount),
                tax_amount: roundCurrency(taxAmount),
                total_amount: totalAmount,
                item_count: processedItems.length,
                items: this.toTemplateItems(processedItems),
                notes: data.notes || null,
                is_active: Object.prototype.hasOwnProperty.call(data, 'is_active')
                    ? parseBoolean(data.is_active, true)
                    : true,
                tenant_id: this.tenantId,
                created_by: userId,
                updated_by: userId,
            }).returning('*');

            return template;
        });
    }

    async updateTemplate(templateId, data, userId) {
        return this.db.transaction(async (trx) => {
            const existing = await trx('purchase_templates')
                .where({ id: templateId, tenant_id: this.tenantId, is_deleted: false })
                .first();

            if (!existing) {
                throw new AppError('Purchase template not found', 404);
            }

            const name = Object.prototype.hasOwnProperty.call(data, 'name')
                ? String(data.name || '').trim()
                : existing.name;

            if (!name) {
                throw new AppError('Template name is required', 400);
            }

            const duplicateName = await trx('purchase_templates')
                .where('tenant_id', this.tenantId)
                .where('is_deleted', false)
                .whereRaw('LOWER(name) = LOWER(?)', [name])
                .whereNot('id', templateId)
                .first('id');

            if (duplicateName) {
                throw new AppError('Template name already exists', 409);
            }

            const supplierId = Object.prototype.hasOwnProperty.call(data, 'supplier_id')
                ? data.supplier_id
                : existing.supplier_id;

            if (supplierId) {
                await this.ensureSupplierExists(trx, supplierId);
            }

            const existingItems = this.parseTemplateItems(existing.items);

            const itemsSource = Array.isArray(data.items)
                ? data.items
                : existingItems;

            if (!Array.isArray(itemsSource) || itemsSource.length === 0) {
                throw new AppError('At least one item is required in a template', 400);
            }

            const { subtotal, processedItems } = await this.normalizeDraftItems(trx, itemsSource, userId);

            const discountAmount = Object.prototype.hasOwnProperty.call(data, 'discount_amount')
                ? Number(data.discount_amount || 0)
                : Number(existing.discount_amount || 0);
            const taxAmount = Object.prototype.hasOwnProperty.call(data, 'tax_amount')
                ? Number(data.tax_amount || 0)
                : Number(existing.tax_amount || 0);

            if (!Number.isFinite(discountAmount) || discountAmount < 0) {
                throw new AppError('discount_amount must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(taxAmount) || taxAmount < 0) {
                throw new AppError('tax_amount must be a valid non-negative number', 400);
            }
            if (discountAmount > subtotal + CURRENCY_TOLERANCE) {
                throw new AppError('discount_amount cannot exceed template subtotal', 400);
            }

            const totalAmount = roundCurrency((subtotal - discountAmount) + taxAmount);

            const [updated] = await trx('purchase_templates')
                .where({ id: templateId, tenant_id: this.tenantId, is_deleted: false })
                .update({
                    name,
                    description: Object.prototype.hasOwnProperty.call(data, 'description')
                        ? data.description
                        : existing.description,
                    supplier_id: supplierId || null,
                    payment_method: data.payment_method || existing.payment_method,
                    subtotal,
                    discount_amount: roundCurrency(discountAmount),
                    tax_amount: roundCurrency(taxAmount),
                    total_amount: totalAmount,
                    item_count: processedItems.length,
                    items: this.toTemplateItems(processedItems),
                    notes: Object.prototype.hasOwnProperty.call(data, 'notes') ? data.notes : existing.notes,
                    is_active: Object.prototype.hasOwnProperty.call(data, 'is_active')
                        ? parseBoolean(data.is_active, true)
                        : existing.is_active,
                    updated_by: userId,
                    updated_at: trx.fn.now(),
                })
                .returning('*');

            return updated;
        });
    }

    async archiveTemplate(templateId, userId) {
        const [archived] = await this.db('purchase_templates')
            .where({ id: templateId, tenant_id: this.tenantId, is_deleted: false })
            .update({
                is_active: false,
                is_deleted: true,
                updated_by: userId,
                updated_at: this.db.fn.now(),
            })
            .returning('*');

        if (!archived) {
            throw new AppError('Purchase template not found', 404);
        }

        return archived;
    }

    async applyTemplate(templateId, overrides = {}) {
        return this.db.transaction(async (trx) => {
            const template = await trx('purchase_templates')
                .where({ id: templateId, tenant_id: this.tenantId, is_deleted: false })
                .first();

            if (!template) {
                throw new AppError('Purchase template not found', 404);
            }

            const templateItems = this.parseTemplateItems(template.items);

            const itemsSource = Array.isArray(overrides.items) ? overrides.items : templateItems;
            if (!Array.isArray(itemsSource) || itemsSource.length === 0) {
                throw new AppError('Template has no items to apply', 400);
            }

            const supplierId = Object.prototype.hasOwnProperty.call(overrides, 'supplier_id')
                ? overrides.supplier_id
                : template.supplier_id;

            if (supplierId) {
                await this.ensureSupplierExists(trx, supplierId);
            }

            const { subtotal, processedItems } = await this.normalizeDraftItems(trx, itemsSource, null);

            const discountAmount = Object.prototype.hasOwnProperty.call(overrides, 'discount_amount')
                ? Number(overrides.discount_amount || 0)
                : Number(template.discount_amount || 0);
            const taxAmount = Object.prototype.hasOwnProperty.call(overrides, 'tax_amount')
                ? Number(overrides.tax_amount || 0)
                : Number(template.tax_amount || 0);

            if (!Number.isFinite(discountAmount) || discountAmount < 0) {
                throw new AppError('discount_amount must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(taxAmount) || taxAmount < 0) {
                throw new AppError('tax_amount must be a valid non-negative number', 400);
            }
            if (discountAmount > subtotal + CURRENCY_TOLERANCE) {
                throw new AppError('discount_amount cannot exceed template subtotal', 400);
            }

            const totalAmount = roundCurrency((subtotal - discountAmount) + taxAmount);

            return {
                template_id: template.id,
                template_name: template.name,
                data: {
                    supplier_id: supplierId || null,
                    payment_method: overrides.payment_method || template.payment_method || 'bank_transfer',
                    purchase_date: overrides.purchase_date || null,
                    reference_number: overrides.reference_number || null,
                    subtotal,
                    discount_amount: roundCurrency(discountAmount),
                    tax_amount: roundCurrency(taxAmount),
                    total_amount: totalAmount,
                    notes: Object.prototype.hasOwnProperty.call(overrides, 'notes')
                        ? overrides.notes
                        : (template.notes || ''),
                    items: this.toTemplateItems(processedItems),
                },
            };
        });
    }

    /**
     * Generate next bill number
     * Auto-syncs with actual max value in purchases table to ensure sequential numbering
     */
    async generateBillNumber(trx) {
        const sequence = await trx('sequences').where({ name: 'purchase', tenant_id: this.tenantId }).forUpdate().first();
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
        
        await trx('sequences').where({ name: 'purchase', tenant_id: this.tenantId }).update({ current_value: nextVal });

        return `${prefix}${nextVal.toString().padStart(sequence.pad_length || 6, '0')}`;
    }

    /**
     * Get system accounts needed for purchases
     */
    async getRequiredAccounts(trx) {
        const accountIds = await resolveSystemAccounts(trx, this.tenantId, [
            SYSTEM_ACCOUNTS.CASH_IN_HAND,
            SYSTEM_ACCOUNTS.BANK_ACCOUNT,
            SYSTEM_ACCOUNTS.INVENTORY,
            SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES,
            SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES,
            SYSTEM_ACCOUNTS.INPUT_TAX_RECEIVABLE,
            SYSTEM_ACCOUNTS.PURCHASE_DISCOUNT,
            SYSTEM_ACCOUNTS.PAYABLES_SUMMARY,
        ]);

        return {
            cash: accountIds[SYSTEM_ACCOUNTS.CASH_IN_HAND],
            bank: accountIds[SYSTEM_ACCOUNTS.BANK_ACCOUNT],
            inventory: accountIds[SYSTEM_ACCOUNTS.INVENTORY],
            payables: accountIds[SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES],
            payables_summary: accountIds[SYSTEM_ACCOUNTS.PAYABLES_SUMMARY],
            supplier_advance: accountIds[SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES],
            input_tax: accountIds[SYSTEM_ACCOUNTS.INPUT_TAX_RECEIVABLE],
            purchase_discount: accountIds[SYSTEM_ACCOUNTS.PURCHASE_DISCOUNT],
        };
    }

    /**
     * List purchases with pagination
     */
    async list(params) {
        const {
            page = 1,
            limit = 50,
            from_date,
            to_date,
            supplier_id,
            status,
            search,
            sort_by = 'purchase_date',
            sort_order = 'desc',
            include_cancelled = true,
        } = params;

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 50;
        const offset = (pageNumber - 1) * pageLimit;

        const statusList = String(status || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        const includeCancelled = parseBoolean(include_cancelled, true);
        const sortableColumns = {
            purchase_date: 'p.purchase_date',
            bill_number: 'p.bill_number',
            supplier_name: 's.name',
            total_amount: 'p.total_amount',
            amount_paid: 'p.amount_paid',
            amount_due: 'p.amount_due',
            status: 'p.status',
            created_at: 'p.created_at',
        };

        const sortColumn = sortableColumns[sort_by] || sortableColumns.purchase_date;
        const sortDirection = String(sort_order).toLowerCase() === 'asc' ? 'asc' : 'desc';

        const applyFilters = (builder) => {
            builder
                .where('p.tenant_id', this.tenantId)
                .where('p.is_deleted', false)
                .where((q) => {
                    q.whereNull('p.is_return').orWhere('p.is_return', false);
                });

            if (supplier_id) builder.where('p.supplier_id', supplier_id);

            if (statusList.length > 0) {
                builder.whereIn('p.status', statusList);
            } else if (!includeCancelled) {
                builder.whereNot('p.status', 'cancelled');
            }

            if (from_date) builder.where('p.purchase_date', '>=', from_date);
            if (to_date) builder.where('p.purchase_date', '<=', to_date);

            if (search) {
                builder.where((q) => {
                    q.whereILike('p.bill_number', `%${search}%`)
                        .orWhereILike('p.reference_number', `%${search}%`)
                        .orWhereILike('p.notes', `%${search}%`)
                        .orWhereILike('s.name', `%${search}%`);
                });
            }
        };

        const rowsQuery = this.db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select('p.*', 's.name as supplier_name');
        applyFilters(rowsQuery);

        const countQuery = this.db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id');
        applyFilters(countQuery);

        const summaryQuery = this.db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .first(
                this.db.raw('COUNT(DISTINCT p.id)::int as total_bills'),
                this.db.raw('COALESCE(SUM(p.total_amount), 0) as total_amount'),
                this.db.raw('COALESCE(SUM(p.amount_paid), 0) as total_paid'),
                this.db.raw('COALESCE(SUM(GREATEST(p.total_amount - p.amount_paid, 0)), 0) as total_outstanding')
            );
        applyFilters(summaryQuery);

        const [{ count }, summary] = await Promise.all([
            countQuery.countDistinct('p.id as count'),
            summaryQuery,
        ]);

        const purchases = await rowsQuery
            .orderBy(sortColumn, sortDirection)
            .orderBy('p.created_at', 'desc')
            .limit(pageLimit)
            .offset(offset);

        const total = Number(count || 0);
        return {
            data: purchases,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total,
                pages: Math.max(1, Math.ceil(total / pageLimit)),
            },
            summary: {
                total_bills: Number(summary?.total_bills || 0),
                total_amount: roundCurrency(Number(summary?.total_amount || 0)),
                total_paid: roundCurrency(Number(summary?.total_paid || 0)),
                total_outstanding: roundCurrency(Number(summary?.total_outstanding || 0)),
            },
        };
    }
}

module.exports = PurchaseService;

