const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const CustomerService = require('../services/customer.service');
const audit = require('../utils/audit');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const LedgerService = require('../services/ledger.service');
const {
    computeAccountOpeningBalanceForDate,
    getLedgerEntriesWithRunningBalance,
} = require('../utils/ledgerQuery');

const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'bank_transfer', 'cheque']);

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function nextPaymentSequenceNumber(trx, tenantId) {
    const sequence = await trx('sequences')
        .where({ tenant_id: tenantId, name: 'payment' })
        .forUpdate()
        .first();

    if (!sequence) {
        throw new AppError("Sequence 'payment' is not configured for this tenant.", 500);
    }

    const nextValue = Number(sequence.current_value || 0) + 1;
    const paymentNumber = `${sequence.prefix}${String(nextValue).padStart(sequence.pad_length, '0')}`;

    await trx('sequences')
        .where({ tenant_id: tenantId, name: 'payment' })
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
        .select('id', 'invoice_number', 'amount_paid', 'amount_due', 'status');

    targets.push(...openSales);
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

// Get all customers
router.get('/', async (req, res, next) => {
    try {
        const customerService = new CustomerService(db, req.tenantId);
        const result = await customerService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single customer
router.get('/:id', async (req, res, next) => {
    try {
        const customer = await db('customers')
            .where({ id: req.params.id, is_deleted: false, tenant_id: req.tenantId })
            .first();

        if (!customer) throw new AppError('Customer not found', 404);

        res.json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
});

// Create customer
router.post('/', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const customerService = new CustomerService(db, req.tenantId);
        const customer = await customerService.create(req.body, req.user.id);

        // Audit customer creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'customers',
            recordId: customer.id,
            newValues: { id: customer.id, code: customer.code, name: customer.name, phone_number: customer.phone_number, credit_limit: customer.credit_limit },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: customer });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Customer code already exists', 409));
        }
        next(error);
    }
});

// Update customer
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        // Only admin can change credit_limit
        const updateData = { ...req.body };
        if (req.user.role !== 'admin' && 'credit_limit' in updateData) {
            delete updateData.credit_limit;
        }

        // Fetch old values before update
        const oldCustomer = await db('customers')
            .where({ id: req.params.id, is_deleted: false, tenant_id: req.tenantId })
            .first();

        const customerService = new CustomerService(db, req.tenantId);
        const customer = await customerService.update(req.params.id, updateData, req.user.id);

        // Audit customer update
        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'customers',
            recordId: req.params.id,
            oldValues: { name: oldCustomer?.name, phone_number: oldCustomer?.phone_number, credit_limit: oldCustomer?.credit_limit, is_active: oldCustomer?.is_active },
            newValues: { name: customer.name, phone_number: customer.phone_number, credit_limit: customer.credit_limit, is_active: customer.is_active },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
});

// Delete customer (admin only)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
        // Fetch customer before deletion
        const oldCustomer = await db('customers')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        await db('customers')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({ is_deleted: true, updated_at: new Date() });

        // Audit customer deletion
        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'customers',
            recordId: req.params.id,
            oldValues: { id: oldCustomer?.id, code: oldCustomer?.code, name: oldCustomer?.name },
            newValues: { is_deleted: true, deleted_at: new Date().toISOString() },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Record payment against a customer
router.post('/:id/payment', authorize('admin', 'manager'), async (req, res, next) => {
    const { amount, payment_method, payment_account_code, notes, payment_date, sale_id } = req.body;
    const numericAmount = round2(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'A positive payment amount is required.' });
    }
    if (payment_method && !ALLOWED_PAYMENT_METHODS.has(payment_method)) {
        return res.status(400).json({ error: 'Invalid payment_method.' });
    }

    try {
        let responseData = null;

        await db.transaction(async (trx) => {
            const tenantId = req.tenantId;
            const ledgerService = new LedgerService(db, tenantId);

            const customer = await trx('customers')
                .where({ id: req.params.id, tenant_id: tenantId, is_deleted: false })
                .forUpdate()
                .first();

            if (!customer) throw new AppError('Customer not found.', 404);

            const pm = payment_method || 'cash';
            const paymentAccountCode = payment_account_code || (pm === 'cash' ? SYSTEM_ACCOUNTS.CASH_IN_HAND : SYSTEM_ACCOUNTS.BANK_ACCOUNT);
            const accountIds = await resolveSystemAccounts(trx, tenantId, [paymentAccountCode]);
            const paymentAccountId = accountIds[paymentAccountCode];
            const paymentNumber = await nextPaymentSequenceNumber(trx, tenantId);

            const [payment] = await trx('payments').insert({
                tenant_id: tenantId,
                payment_number: paymentNumber,
                payment_type: 'received',
                customer_id: customer.id,
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
                customerId: customer.id,
                amount: numericAmount,
                saleId: sale_id || null,
                userId: req.user.id,
            });

            let customerAdvanceAccountId = null;
            if (allocation.unapplied_amount > 0) {
                customerAdvanceAccountId = await resolveCustomerAdvanceAccountId(trx, tenantId, req.user.id);
            }

            // ===== RESTORED: Use individual customer GL accounts =====
            const journalEntries = [
                { account_id: paymentAccountId, entry_type: 'debit', amount: numericAmount },
            ];
            if (allocation.applied_amount > 0) {
                // Get 1201 control account
                const controlAccountId = (await resolveSystemAccounts(trx, tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES]))[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES];
                
                // Use customer's individual GL account if available
                const customerAccountId = customer.account_id || controlAccountId;
                
                // Credit customer's account
                journalEntries.push({ account_id: customerAccountId, entry_type: 'credit', amount: allocation.applied_amount });
                
                // Update account balances - both individual and control
                if (customer.account_id) {
                    await trx('accounts')
                        .where({ id: customer.account_id })
                        .decrement('current_balance', allocation.applied_amount);
                }
                await trx('accounts')
                    .where({ id: controlAccountId })
                    .decrement('current_balance', allocation.applied_amount);
            }
            if (allocation.unapplied_amount > 0 && customerAdvanceAccountId) {
                journalEntries.push({ account_id: customerAdvanceAccountId, entry_type: 'credit', amount: allocation.unapplied_amount });
            }

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
            const currentCreditUsed = round2(Number(customer.current_credit_used || 0));

            if (
                allocation.applied_amount > currentCustomerBalance + 0.01
                || allocation.applied_amount > currentCreditUsed + 0.01
            ) {
                throw new AppError(
                    'Payment would make customer balance negative. Reconcile customer balances before posting this payment.',
                    409
                );
            }

            await trx('customers')
                .where({ id: customer.id, tenant_id: tenantId })
                .update({
                    current_balance: round2(currentCustomerBalance - allocation.applied_amount),
                    current_credit_used: round2(currentCreditUsed - allocation.applied_amount),
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

        return res.json({ success: true, message: 'Payment recorded successfully.', data: responseData });
    } catch (error) {
        next(error);
    }
});

// Get customer ledger
router.get('/:id/ledger', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date, page, limit } = req.query;
        const customer = await db('customers')
            .where('id', req.params.id)
            .where('tenant_id', req.tenantId)
            .where('is_deleted', false)
            .first();

        if (!customer) throw new AppError('Customer not found', 404);
        if (!customer.account_id) throw new AppError('Customer account is not configured', 500);

        const account = await db('accounts')
            .where({ id: customer.account_id, tenant_id: req.tenantId })
            .first();

        if (!account) throw new AppError('Customer account not found', 404);

        const openingBalance = await computeAccountOpeningBalanceForDate({
            trx: db,
            tenantId: req.tenantId,
            accountId: account.id,
            accountType: account.account_type,
            openingBalance: account.opening_balance,
            fromDate: from_date,
        });

        const ledger = await getLedgerEntriesWithRunningBalance({
            db,
            tenantId: req.tenantId,
            accountId: account.id,
            accountType: account.account_type,
            fromDate: from_date || null,
            toDate: to_date || null,
            openingBalance,
            page,
            limit,
        });

        res.json({
            success: true,
            data: {
                customer,
                opening_balance: openingBalance,
                page_opening_balance: ledger.pageOpeningBalance,
                closing_balance: ledger.closingBalance,
                entries: ledger.entries,
                pagination: ledger.pagination,
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
