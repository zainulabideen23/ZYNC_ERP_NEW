const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');

// POST /api/transfers/bank
// Transfer funds between cash and bank accounts
router.post('/bank', authorize('admin', 'manager'), async (req, res, next) => {
    const { from_account_code, to_account_code, amount, notes, transfer_date } = req.body;

    if (!from_account_code || !to_account_code || !amount || amount <= 0) {
        return res.status(400).json({ error: 'from_account_code, to_account_code, and a positive amount are required.' });
    }

    // Valid transfers: 1001 → 1002 (cash to bank) or 1002 → 1001 (bank to cash)
    const validPairs = [
        { from: '1001', to: '1002' },  // Cash → Bank (deposit)
        { from: '1002', to: '1001' },  // Bank → Cash (withdrawal)
    ];

    const isValid = validPairs.some(p => p.from === from_account_code && p.to === to_account_code);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid transfer pair. Only cash ↔ bank transfers are supported.' });
    }

    try {
        const tenantId = req.tenantId;

        await db.transaction(async (trx) => {
            const accountIds = await resolveSystemAccounts(trx, tenantId, [from_account_code, to_account_code]);

            // Validate sufficient balance in source account
            const fromAccount = await trx('accounts')
                .where({ tenant_id: tenantId, code: from_account_code })
                .first();

            if (parseFloat(fromAccount.current_balance) < amount) {
                throw new AppError(`Insufficient balance in source account. Available: Rs. ${fromAccount.current_balance}`, 400);
            }

            // Journal:
            // DEBIT destination account (it gains money)
            // CREDIT source account (it loses money)
            const journalEntries = [
                { account_id: accountIds[to_account_code], entry_type: 'debit', amount },
                { account_id: accountIds[from_account_code], entry_type: 'credit', amount },
            ];

            const description = from_account_code === '1001'
                ? `Cash deposit to bank — Rs. ${amount}`
                : `Cash withdrawal from bank — Rs. ${amount}`;

            // Generate sequence
            const seq = await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .forUpdate()
                .first();
            const nextNum = seq.current_value + 1;
            const journalNumber = `${seq.prefix}${String(nextNum).padStart(seq.pad_length, '0')}`;
            await trx('sequences')
                .where({ tenant_id: tenantId, name: 'journal' })
                .update({ current_value: nextNum });

            const [journal] = await trx('journals').insert({
                tenant_id: tenantId,
                journal_number: journalNumber,
                reference_type: 'bank_transfer',
                reference_id: null,
                journal_date: transfer_date || new Date(),
                description,
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
                    description,
                    created_at: trx.fn.now(),
                });
            }
        });

        return res.json({ success: true, message: 'Transfer recorded successfully.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
