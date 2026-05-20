const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const LedgerService = require('../services/ledger.service');

const ALLOWED_PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque'];

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function nextSequenceNumber(trx, tenantId, sequenceName) {
    const sequence = await trx('sequences')
        .where({ tenant_id: tenantId, name: sequenceName })
        .forUpdate()
        .first();

    if (!sequence) {
        throw new AppError(`Sequence '${sequenceName}' is not configured for this tenant.`, 500);
    }

    const nextValue = Number(sequence.current_value || 0) + 1;
    const paymentNumber = `${sequence.prefix}${String(nextValue).padStart(sequence.pad_length, '0')}`;

    await trx('sequences')
        .where({ tenant_id: tenantId, name: sequenceName })
        .update({ current_value: nextValue });

    return paymentNumber;
}

async function resolveLiabilityGroup(trx, tenantId) {
    let group = await trx('account_groups')
        .where({ tenant_id: tenantId, code: '2000' })
        .first();

    if (!group) {
        group = await trx('account_groups')
            .where({ tenant_id: tenantId, account_type: 'liability' })
            .whereILike('name', '%payable%')
            .first();
    }

    if (!group) {
        group = await trx('account_groups')
            .where({ tenant_id: tenantId, account_type: 'liability' })
            .first();
    }

    if (!group) {
        throw new AppError('Liability account group not found', 500);
    }

    return group;
}

async function resolveAssetGroup(trx, tenantId) {
    let group = await trx('account_groups')
        .where({ tenant_id: tenantId, code: '1200' })
        .first();

    if (!group) {
        group = await trx('account_groups')
            .where({ tenant_id: tenantId, account_type: 'asset' })
            .whereILike('name', '%receivable%')
            .first();
    }

    if (!group) {
        group = await trx('account_groups')
            .where({ tenant_id: tenantId, account_type: 'asset' })
            .first();
    }

    if (!group) {
        throw new AppError('Asset account group not found', 500);
    }

    return group;
}

async function resolveCustomerAdvanceAccountId(trx, tenantId, userId) {
    try {
        const accountIds = await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_ADVANCES]);
        return accountIds[SYSTEM_ACCOUNTS.CUSTOMER_ADVANCES];
    } catch (_) {
        // Continue with fallback discovery/creation for legacy tenants.
    }

    const existingByName = await trx('accounts')
        .where({ tenant_id: tenantId, is_active: true })
        .whereILike('name', 'Customer Advances')
        .first('id');

    if (existingByName) {
        return existingByName.id;
    }

    const liabilityGroup = await resolveLiabilityGroup(trx, tenantId);
    const preferredCode = SYSTEM_ACCOUNTS.CUSTOMER_ADVANCES || '2003';
    const fallbackCode = Number.parseInt(preferredCode, 10);

    for (let attempt = 0; attempt < 5; attempt++) {
        const preferredExists = await trx('accounts')
            .where({ tenant_id: tenantId, code: preferredCode })
            .first('id');

        let nextCode = preferredCode;
        if (preferredExists) {
            const lastLiability = await trx('accounts')
                .where({ tenant_id: tenantId, group_id: liabilityGroup.id })
                .whereRaw("code ~ '^[0-9]+$'")
                .orderByRaw('CAST(code AS INTEGER) DESC')
                .forUpdate()
                .first('code');

            nextCode = String(
                lastLiability?.code
                    ? Number.parseInt(lastLiability.code, 10) + 1
                    : (Number.isFinite(fallbackCode) ? fallbackCode : 2003)
            );
        }

        try {
            const [created] = await trx('accounts').insert({
                code: nextCode,
                name: 'Customer Advances',
                account_type: 'liability',
                group_id: liabilityGroup.id,
                opening_balance: 0,
                current_balance: 0,
                is_system: true,
                is_active: true,
                created_by: userId,
                tenant_id: tenantId,
            }).returning('id');

            return created.id;
        } catch (error) {
            if (error.code !== '23505') {
                throw error;
            }
        }
    }

    throw new AppError('Could not resolve customer advances account', 500);
}

async function resolveSupplierAdvanceAccountId(trx, tenantId, userId) {
    try {
        const accountIds = await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES]);
        return accountIds[SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES];
    } catch (_) {
        // Continue with fallback discovery/creation for legacy tenants.
    }

    const existingByName = await trx('accounts')
        .where({ tenant_id: tenantId, is_active: true })
        .whereILike('name', 'Supplier Advances')
        .first('id');

    if (existingByName) {
        return existingByName.id;
    }

    const assetGroup = await resolveAssetGroup(trx, tenantId);
    const preferredCode = SYSTEM_ACCOUNTS.SUPPLIER_ADVANCES || '1202';
    const fallbackCode = Number.parseInt(preferredCode, 10);

    for (let attempt = 0; attempt < 5; attempt++) {
        const preferredExists = await trx('accounts')
            .where({ tenant_id: tenantId, code: preferredCode })
            .first('id');

        let nextCode = preferredCode;
        if (preferredExists) {
            const lastAsset = await trx('accounts')
                .where({ tenant_id: tenantId, group_id: assetGroup.id })
                .whereRaw("code ~ '^[0-9]+$'")
                .orderByRaw('CAST(code AS INTEGER) DESC')
                .forUpdate()
                .first('code');

            nextCode = String(
                lastAsset?.code
                    ? Number.parseInt(lastAsset.code, 10) + 1
                    : (Number.isFinite(fallbackCode) ? fallbackCode : 1202)
            );
        }

        try {
            const [created] = await trx('accounts').insert({
                code: nextCode,
                name: 'Supplier Advances',
                account_type: 'asset',
                group_id: assetGroup.id,
                opening_balance: 0,
                current_balance: 0,
                is_system: true,
                is_active: true,
                created_by: userId,
                tenant_id: tenantId,
            }).returning('id');

            return created.id;
        } catch (error) {
            if (error.code !== '23505') {
                throw error;
            }
        }
    }

    throw new AppError('Could not resolve supplier advances account', 500);
}

async function getCustomerAllocationTargets(trx, tenantId, customerId, preferredSaleId = null) {
    const targets = [];

    if (preferredSaleId) {
        const preferred = await trx('sales')
            .where({ id: preferredSaleId, tenant_id: tenantId, customer_id: customerId, is_deleted: false })
            .forUpdate()
            .first();

        if (!preferred) {
            throw new AppError('Provided sale_id does not belong to this customer.', 404);
        }

        if (!['cancelled', 'returned'].includes(preferred.status) && Number(preferred.amount_due || 0) > 0) {
            targets.push(preferred);
        }
    }

    const openSales = await trx('sales')
        .where({ tenant_id: tenantId, customer_id: customerId, is_deleted: false })
        .whereNotIn('status', ['cancelled', 'returned'])
        .where('amount_due', '>', 0)
        .modify((q) => {
            if (preferredSaleId) q.whereNot('id', preferredSaleId);
        })
        .orderBy('sale_date', 'asc')
        .orderBy('created_at', 'asc')
        .forUpdate()
        .select('id', 'invoice_number', 'amount_paid', 'amount_due', 'total_amount', 'status');

    targets.push(...openSales);
    return targets;
}

async function getSupplierAllocationTargets(trx, tenantId, supplierId, preferredPurchaseId = null) {
    const targets = [];

    if (preferredPurchaseId) {
        const preferred = await trx('purchases')
            .where({ id: preferredPurchaseId, tenant_id: tenantId, supplier_id: supplierId, is_deleted: false })
            .forUpdate()
            .first();

        if (!preferred) {
            throw new AppError('Provided purchase_id does not belong to this supplier.', 404);
        }

        if (!['cancelled'].includes(preferred.status) && Number(preferred.amount_due || 0) > 0) {
            targets.push(preferred);
        }
    }

    const openPurchases = await trx('purchases')
        .where({ tenant_id: tenantId, supplier_id: supplierId, is_deleted: false })
        .whereNotIn('status', ['cancelled'])
        .where('amount_due', '>', 0)
        .modify((q) => {
            if (preferredPurchaseId) q.whereNot('id', preferredPurchaseId);
        })
        .orderBy('purchase_date', 'asc')
        .orderBy('created_at', 'asc')
        .forUpdate()
        .select('id', 'bill_number', 'amount_paid', 'amount_due', 'total_amount', 'status');

    targets.push(...openPurchases);
    return targets;
}

async function allocateCustomerPayment({ trx, tenantId, paymentId, customerId, amount, saleId, userId }) {
    const targets = await getCustomerAllocationTargets(trx, tenantId, customerId, saleId || null);

    let remaining = round2(amount);
    const allocations = [];

    for (const sale of targets) {
        if (remaining <= 0) break;

        const currentDue = round2(sale.amount_due || 0);
        if (currentDue <= 0) continue;

        const applied = round2(Math.min(remaining, currentDue));
        if (applied <= 0) continue;

        const newDue = round2(currentDue - applied);
        const newPaid = round2(Number(sale.amount_paid || 0) + applied);
        const nextStatus = ['cancelled', 'returned'].includes(sale.status)
            ? sale.status
            : (newDue <= 0.0001 ? 'completed' : 'confirmed');

        await trx('sales')
            .where({ id: sale.id, tenant_id: tenantId })
            .update({
                amount_paid: newPaid,
                amount_due: newDue,
                status: nextStatus,
                updated_at: trx.fn.now(),
            });

        await trx('payment_applications').insert({
            tenant_id: tenantId,
            payment_id: paymentId,
            sale_id: sale.id,
            applied_amount: applied,
            created_by: userId,
            created_at: trx.fn.now(),
        });

        allocations.push({
            sale_id: sale.id,
            invoice_number: sale.invoice_number,
            applied_amount: applied,
            remaining_due: newDue,
        });

        remaining = round2(remaining - applied);
    }

    return {
        applied_amount: round2(amount - remaining),
        unapplied_amount: remaining,
        allocations,
    };
}

async function allocateSupplierPayment({ trx, tenantId, paymentId, supplierId, amount, purchaseId, userId }) {
    const targets = await getSupplierAllocationTargets(trx, tenantId, supplierId, purchaseId || null);

    let remaining = round2(amount);
    const allocations = [];

    for (const purchase of targets) {
        if (remaining <= 0) break;

        const currentDue = round2(purchase.amount_due || 0);
        if (currentDue <= 0) continue;

        const applied = round2(Math.min(remaining, currentDue));
        if (applied <= 0) continue;

        const newDue = round2(currentDue - applied);
        const newPaid = round2(Number(purchase.amount_paid || 0) + applied);
        const nextStatus = purchase.status === 'cancelled'
            ? purchase.status
            : (newDue <= 0.0001 ? 'paid' : 'billed');

        await trx('purchases')
            .where({ id: purchase.id, tenant_id: tenantId })
            .update({
                amount_paid: newPaid,
                amount_due: newDue,
                status: nextStatus,
                updated_at: trx.fn.now(),
            });

        await trx('payment_applications').insert({
            tenant_id: tenantId,
            payment_id: paymentId,
            purchase_id: purchase.id,
            applied_amount: applied,
            created_by: userId,
            created_at: trx.fn.now(),
        });

        allocations.push({
            purchase_id: purchase.id,
            bill_number: purchase.bill_number,
            applied_amount: applied,
            remaining_due: newDue,
        });

        remaining = round2(remaining - applied);
    }

    return {
        applied_amount: round2(amount - remaining),
        unapplied_amount: remaining,
        allocations,
    };
}

// POST /api/payments/customer
// Record a payment received from a customer
router.post('/customer', authorize('admin', 'manager'), async (req, res, next) => {
    const { customer_id, amount, payment_method, payment_account_code, notes, payment_date, sale_id } = req.body;
    const numericAmount = round2(amount);

    if (!customer_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'customer_id and a positive amount are required.' });
    }
    if (payment_method && !ALLOWED_PAYMENT_METHODS.includes(payment_method)) {
        return res.status(400).json({ error: 'Invalid payment_method.' });
    }

    try {
        let responseData = null;

        await db.transaction(async (trx) => {
            const tenantId = req.tenantId;
            const ledgerService = new LedgerService(db, tenantId);

            const customer = await trx('customers')
                .where({ id: customer_id, tenant_id: tenantId, is_deleted: false })
                .forUpdate()
                .first();
            if (!customer) throw new AppError('Customer not found.', 404);
            // Note: We now use account 1201 for all customer receivables
            // Individual customer tracking is done via customers.current_balance

            const pm = payment_method || 'cash';
            const paymentAccountCode = payment_account_code || (pm === 'cash' ? SYSTEM_ACCOUNTS.CASH_IN_HAND : SYSTEM_ACCOUNTS.BANK_ACCOUNT);

            const accountIds = await resolveSystemAccounts(trx, tenantId, [paymentAccountCode]);
            const paymentAccountId = accountIds[paymentAccountCode];

            const paymentNumber = await nextSequenceNumber(trx, tenantId, 'payment');

            const [payment] = await trx('payments').insert({
                tenant_id: tenantId,
                payment_number: paymentNumber,
                payment_type: 'received',
                customer_id: customer_id,
                payment_amount: numericAmount,
                payment_method: pm,
                notes,
                payment_date: payment_date || new Date(),
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            const allocation = await allocateCustomerPayment({
                trx,
                tenantId,
                paymentId: payment.id,
                customerId: customer_id,
                amount: numericAmount,
                saleId: sale_id || null,
                userId: req.user.id,
            });

            const journalEntries = [];
            const controlAccountId = (await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES, SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY]))[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES];
            const summaryAccountId = (await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES, SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY]))[SYSTEM_ACCOUNTS.RECEIVABLES_SUMMARY];
            
            if (allocation.applied_amount > 0) {
                // Debit customer's individual account (or cash/bank if unapplied)
                journalEntries.push({ account_id: customer.account_id || paymentAccountId, entry_type: 'credit', amount: allocation.applied_amount });
                
                // Add entries to 1201 and 1200 for audit trail
                if (customer.account_id && customer.account_id !== controlAccountId) {
                    journalEntries.push({ account_id: controlAccountId, entry_type: 'credit', amount: allocation.applied_amount });
                    journalEntries.push({ account_id: summaryAccountId, entry_type: 'debit', amount: allocation.applied_amount });
                }
                
                // Update account balances - individual customer + 1201 control
                if (customer.account_id && customer.account_id !== controlAccountId) {
                    await trx('accounts')
                        .where({ id: customer.account_id })
                        .decrement('current_balance', allocation.applied_amount);
                }
                await trx('accounts')
                    .where({ id: controlAccountId })
                    .decrement('current_balance', allocation.applied_amount);
            }
            journalEntries.push({ account_id: paymentAccountId, entry_type: 'debit', amount: numericAmount });

            await ledgerService.createJournalEntry({
                journal_date: payment_date || new Date(),
                transaction_type: 'payment',
                reference_type: 'payment',
                reference_id: payment.id,
                narration: `Payment received from ${customer.name} - ${paymentNumber}`,
                entries: journalEntries,
                created_by: req.user.id,
            }, trx);

            const currentCustomerBalance = round2(Number(customer.current_balance || 0));
            if (allocation.applied_amount > currentCustomerBalance + 0.01) {
                throw new AppError(
                    'Customer payment would make customer balance negative. Reconcile customer balances before posting this payment.',
                    409
                );
            }

            await trx('customers')
                .where({ id: customer_id, tenant_id: tenantId })
                .update({
                    current_balance: round2(currentCustomerBalance - allocation.applied_amount),
                    updated_at: trx.fn.now(),
                });

            responseData = {
                payment,
                allocation_summary: {
                    target_sale_id: sale_id || null,
                    applied_amount: allocation.applied_amount,
                    unapplied_amount: allocation.unapplied_amount,
                    allocations: allocation.allocations,
                },
            };
        });

        return res.json({ success: true, message: 'Customer payment recorded successfully.', data: responseData });
    } catch (error) {
        next(error);
    }
});

// ===== Supplier Payment Route =====
router.post('/supplier', authorize('admin', 'manager'), async (req, res, next) => {
    const { supplier_id, amount, payment_method, payment_account_code, notes, payment_date, purchase_id } = req.body;
    const numericAmount = round2(amount);

    if (!supplier_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'supplier_id and a positive amount are required.' });
    }
    if (payment_method && !ALLOWED_PAYMENT_METHODS.includes(payment_method)) {
        return res.status(400).json({ error: 'Invalid payment_method.' });
    }

    try {
        let responseData = null;

        await db.transaction(async (trx) => {
            const tenantId = req.tenantId;
            const ledgerService = new LedgerService(db, tenantId);

            const supplier = await trx('suppliers')
                .where({ id: supplier_id, tenant_id: tenantId, is_deleted: false })
                .forUpdate()
                .first();
            if (!supplier) throw new AppError('Supplier not found.', 404);

            const pm = payment_method || 'cash';
            const paymentAccountCode = payment_account_code || (pm === 'cash' ? SYSTEM_ACCOUNTS.CASH_IN_HAND : SYSTEM_ACCOUNTS.BANK_ACCOUNT);

            const accountIds = await resolveSystemAccounts(trx, tenantId, [paymentAccountCode]);
            const paymentAccountId = accountIds[paymentAccountCode];
            const supplierAdvanceAccountId = await resolveSupplierAdvanceAccountId(trx, tenantId, req.user.id);

            const paymentNumber = await nextSequenceNumber(trx, tenantId, 'payment');

            const [payment] = await trx('payments').insert({
                tenant_id: tenantId,
                payment_number: paymentNumber,
                payment_type: 'made',
                supplier_id: supplier_id,
                payment_amount: numericAmount,
                payment_method: pm,
                notes,
                payment_date: payment_date || new Date(),
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            const allocation = await allocateSupplierPayment({
                trx,
                tenantId,
                paymentId: payment.id,
                supplierId: supplier_id,
                amount: numericAmount,
                purchaseId: purchase_id || null,
                userId: req.user.id,
            });

            const journalEntries = [];
            const controlAccountId = (await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES, SYSTEM_ACCOUNTS.PAYABLES_SUMMARY]))[SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES];
            const summaryAccountId = (await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES, SYSTEM_ACCOUNTS.PAYABLES_SUMMARY]))[SYSTEM_ACCOUNTS.PAYABLES_SUMMARY];
            
            if (allocation.applied_amount > 0) {
                journalEntries.push({ account_id: supplier.account_id || controlAccountId, entry_type: 'debit', amount: allocation.applied_amount });
                
                if (supplier.account_id && supplier.account_id !== controlAccountId) {
                    journalEntries.push({ account_id: controlAccountId, entry_type: 'debit', amount: allocation.applied_amount });
                    journalEntries.push({ account_id: summaryAccountId, entry_type: 'credit', amount: allocation.applied_amount });
                }
                
                if (supplier.account_id && supplier.account_id !== controlAccountId) {
                    await trx('accounts')
                        .where({ id: supplier.account_id })
                        .decrement('current_balance', allocation.applied_amount);
                }
                await trx('accounts')
                    .where({ id: controlAccountId })
                    .decrement('current_balance', allocation.applied_amount);
            }
            if (allocation.unapplied_amount > 0) {
                journalEntries.push({ account_id: supplierAdvanceAccountId, entry_type: 'debit', amount: allocation.unapplied_amount });
            }
            journalEntries.push({ account_id: paymentAccountId, entry_type: 'credit', amount: numericAmount });

            await ledgerService.createJournalEntry({
                journal_date: payment_date || new Date(),
                transaction_type: 'payment',
                reference_type: 'payment',
                reference_id: payment.id,
                narration: `Payment made to ${supplier.name} - ${paymentNumber}`,
                entries: journalEntries,
                created_by: req.user.id,
            }, trx);

            const currentSupplierBalance = round2(Number(supplier.current_balance || 0));
            if (allocation.applied_amount > currentSupplierBalance + 0.01) {
                throw new AppError('Supplier payment would make supplier balance negative.', 409);
            }

            await trx('suppliers')
                .where({ id: supplier_id, tenant_id: tenantId })
                .update({
                    current_balance: round2(currentSupplierBalance - allocation.applied_amount),
                    updated_at: trx.fn.now(),
                });

            responseData = {
                payment,
                allocation_summary: {
                    target_purchase_id: purchase_id || null,
                    applied_amount: allocation.applied_amount,
                    unapplied_amount: allocation.unapplied_amount,
                    allocations: allocation.allocations,
                },
            };
        });

        return res.json({ success: true, message: 'Supplier payment recorded successfully.', data: responseData });
    } catch (error) {
        next(error);
    }
});

module.exports = router;