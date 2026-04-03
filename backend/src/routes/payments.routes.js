const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');

// POST /api/payments/customer
// Record a payment received from a customer
router.post('/customer', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    const { customer_id, amount, payment_method, payment_account_code, notes, payment_date } = req.body;

    if (!customer_id || !amount || amount <= 0) {
        return res.status(400).json({ error: 'customer_id and a positive amount are required.' });
    }
    if (payment_method && !['cash', 'bank_transfer', 'cheque'].includes(payment_method)) {
        return res.status(400).json({ error: 'Invalid payment_method.' });
    }

    try {
        await db.transaction(async (trx) => {
            const tenantId = req.tenantId;

            // 1. Fetch customer and their GL account
            const customer = await trx('customers')
                .where({ id: customer_id, tenant_id: tenantId, is_deleted: false })
                .first();
            if (!customer) throw new AppError('Customer not found.', 404);
            if (parseFloat(customer.current_balance) < amount) {
                throw new AppError(`Payment amount (${amount}) exceeds customer balance (${customer.current_balance}).`);
            }

            // 2. Resolve payment account (cash or bank based on payment_method)
            const pm = payment_method || 'cash';
            const paymentAccountCode = payment_account_code || (pm === 'cash' ? '1001' : '1002');

            const accountIds = await resolveSystemAccounts(trx, tenantId, [paymentAccountCode]);
            const paymentAccountId = accountIds[paymentAccountCode];

            // 3. Get next payment sequence
            const seq = await trx('sequences')
                .where({ tenant_id: tenantId, name: 'payment' })
                .forUpdate()
                .first();
            const nextNum = seq.current_value + 1;
            const paymentNumber = `${seq.prefix}${String(nextNum).padStart(seq.pad_length, '0')}`;
            await trx('sequences')
                .where({ tenant_id: tenantId, name: 'payment' })
                .update({ current_value: nextNum });

            // 4. Insert payment record
            const [payment] = await trx('payments').insert({
                tenant_id: tenantId,
                payment_number: paymentNumber,
                payment_type: 'received',
                party_type: 'customer',
                party_id: customer_id,
                amount,
                payment_method: pm,
                payment_account_id: paymentAccountId,
                notes,
                payment_date: payment_date || new Date(),
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            // 5. Get next journal sequence
            const jSeq = await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .forUpdate()
                .first();
            const nextJNum = jSeq.current_value + 1;
            const journalNumber = `${jSeq.prefix}${String(nextJNum).padStart(jSeq.pad_length, '0')}`;
            await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .update({ current_value: nextJNum });

            // 6. Post journal entry
            // DEBIT Cash/Bank (money came in)
            // CREDIT Customer GL Account (their debt decreases)
            const journalEntries = [
                { account_id: paymentAccountId, entry_type: 'debit', amount },
                { account_id: customer.account_id, entry_type: 'credit', amount },
            ];

            const [journal] = await trx('journals').insert({
                tenant_id: tenantId,
                journal_number: journalNumber,
                reference_type: 'payment',
                reference_id: payment.id,
                journal_date: payment_date || new Date(),
                description: `Payment received from ${customer.name} — ${paymentNumber}`,
                total_debit: amount,
                total_credit: amount,
                is_balanced: true,
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            for (const entry of journalEntries) {
                await trx('ledger_entries').insert({
                    tenant_id: tenantId,
                    journal_id: journal.id,
                    account_id: entry.account_id,
                    entry_type: entry.entry_type,
                    amount: entry.amount,
                    description: `Customer payment — ${paymentNumber}`,
                    created_at: trx.fn.now(),
                });
            }

            // 7. Update customer balance atomically
            await trx('customers')
                .where({ id: customer_id, tenant_id: tenantId })
                .decrement('current_balance', amount)
                .decrement('current_credit_used', amount);
        });

        return res.json({ success: true, message: 'Payment recorded successfully.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/payments/supplier
// Record a payment made to a supplier
router.post('/supplier', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    const { supplier_id, amount, payment_method, payment_account_code, notes, payment_date } = req.body;

    if (!supplier_id || !amount || amount <= 0) {
        return res.status(400).json({ error: 'supplier_id and a positive amount are required.' });
    }

    try {
        await db.transaction(async (trx) => {
            const tenantId = req.tenantId;

            const supplier = await trx('suppliers')
                .where({ id: supplier_id, tenant_id: tenantId, is_deleted: false })
                .first();
            if (!supplier) throw new AppError('Supplier not found.', 404);
            if (parseFloat(supplier.current_balance) < amount) {
                throw new AppError(`Payment amount exceeds outstanding supplier balance.`);
            }

            // Resolve payment account
            const pm = payment_method || 'cash';
            const paymentAccountCode = payment_account_code || (pm === 'cash' ? '1001' : '1002');

            const accountIds = await resolveSystemAccounts(trx, tenantId, [paymentAccountCode]);
            const paymentAccountId = accountIds[paymentAccountCode];

            // Get next payment sequence
            const seq = await trx('sequences')
                .where({ tenant_id: tenantId, name: 'payment' })
                .forUpdate()
                .first();
            const nextNum = seq.current_value + 1;
            const paymentNumber = `${seq.prefix}${String(nextNum).padStart(seq.pad_length, '0')}`;
            await trx('sequences')
                .where({ tenant_id: tenantId, name: 'payment' })
                .update({ current_value: nextNum });

            const [payment] = await trx('payments').insert({
                tenant_id: tenantId,
                payment_number: paymentNumber,
                payment_type: 'made',
                party_type: 'supplier',
                party_id: supplier_id,
                amount,
                payment_method: pm,
                payment_account_id: paymentAccountId,
                notes,
                payment_date: payment_date || new Date(),
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            // Get next journal sequence
            const jSeq = await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .forUpdate()
                .first();
            const nextJNum = jSeq.current_value + 1;
            const journalNumber = `${jSeq.prefix}${String(nextJNum).padStart(jSeq.pad_length, '0')}`;
            await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .update({ current_value: nextJNum });

            // Journal:
            // DEBIT Supplier GL Account (their debt decreases — you owe them less)
            // CREDIT Cash/Bank (money left your hands)
            const journalEntries = [
                { account_id: supplier.account_id, entry_type: 'debit', amount },
                { account_id: paymentAccountId, entry_type: 'credit', amount },
            ];

            const [journal] = await trx('journals').insert({
                tenant_id: tenantId,
                journal_number: journalNumber,
                reference_type: 'payment',
                reference_id: payment.id,
                journal_date: payment_date || new Date(),
                description: `Payment made to ${supplier.name} — ${paymentNumber}`,
                total_debit: amount,
                total_credit: amount,
                is_balanced: true,
                created_by: req.user.id,
                created_at: trx.fn.now(),
            }).returning('*');

            for (const entry of journalEntries) {
                await trx('ledger_entries').insert({
                    tenant_id: tenantId,
                    journal_id: journal.id,
                    account_id: entry.account_id,
                    entry_type: entry.entry_type,
                    amount: entry.amount,
                    description: `Supplier payment — ${paymentNumber}`,
                    created_at: trx.fn.now(),
                });
            }

            // Update supplier balance
            await trx('suppliers')
                .where({ id: supplier_id, tenant_id: tenantId })
                .decrement('current_balance', amount);
        });

        return res.json({ success: true, message: 'Supplier payment recorded successfully.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
