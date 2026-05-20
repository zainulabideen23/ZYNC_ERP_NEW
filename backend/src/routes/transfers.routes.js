const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { resolveSystemAccounts } = require('../utils/accountResolver');
const LedgerService = require('../services/ledger.service');

// POST /api/transfers/bank
// Transfer funds between cash and bank accounts
router.post('/bank', authorize('admin', 'manager'), async (req, res, next) => {
    const { from_account_code, to_account_code, amount, notes, transfer_date } = req.body;

    const numericAmount = Number(amount);
    if (!from_account_code || !to_account_code || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'from_account_code, to_account_code, and a positive amount are required.' });
    }

    // Valid transfers: 1001 -> 1002 (cash to bank) or 1002 -> 1001 (bank to cash)
    const validPairs = [
        { from: '1001', to: '1002' },
        { from: '1002', to: '1001' },
    ];

    const isValid = validPairs.some((p) => p.from === from_account_code && p.to === to_account_code);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid transfer pair. Only cash <-> bank transfers are supported.' });
    }

    try {
        const tenantId = req.tenantId;

        await db.transaction(async (trx) => {
            const accountIds = await resolveSystemAccounts(trx, tenantId, [from_account_code, to_account_code]);
            const ledgerService = new LedgerService(db, tenantId);

            // Validate sufficient balance in source account
            const fromAccount = await trx('accounts')
                .where({ tenant_id: tenantId, code: from_account_code })
                .first();

            if (!fromAccount) {
                throw new AppError('Source account not found.', 404);
            }

            if (parseFloat(fromAccount.current_balance) < numericAmount) {
                throw new AppError(`Insufficient balance in source account. Available: Rs. ${fromAccount.current_balance}`, 400);
            }

            const description = from_account_code === '1001'
                ? `Cash deposit to bank - Rs. ${numericAmount}${notes ? ` (${notes})` : ''}`
                : `Cash withdrawal from bank - Rs. ${numericAmount}${notes ? ` (${notes})` : ''}`;

            await ledgerService.createJournalEntry({
                journal_date: transfer_date || new Date(),
                transaction_type: 'bank_transfer',
                reference_type: 'bank_transfer',
                narration: description,
                entries: [
                    { account_id: accountIds[to_account_code], entry_type: 'debit', amount: numericAmount },
                    { account_id: accountIds[from_account_code], entry_type: 'credit', amount: numericAmount },
                ],
                created_by: req.user.id,
            }, trx);
        });

        return res.json({ success: true, message: 'Transfer recorded successfully.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;