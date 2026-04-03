/**
 * Migration: Fix Accounts (Fixes 5-7)
 *
 * FIX 5 — Deactivate "Sales Discount" account (code 4002)
 *         Discounts are already tracked at the transaction level (sales.discount_amount),
 *         so a separate income account for them is unnecessary and misleading.
 *
 * FIX 6 — Opening Balance Journal Entries (Option B — flag only)
 *         Three accounts have opening balances stored directly (Cash: 100,000,
 *         Bank: 500,000, Owner Capital: 600,000) but NO corresponding journal
 *         entries exist. Since real transactions already exist (Sales Income: 13,100),
 *         inserting opening journals now would cause the trigger_update_account
 *         trigger to DOUBLE the balances. This is flagged here as a known data
 *         integrity note. Opening balance entries should be created in a controlled
 *         migration at year-start when the system is idle.
 *
 * FIX 7 — Add "Retained Earnings" account under Equity group
 *         Required for year-end profit transfers. Without this account,
 *         there is nowhere to close out income/expense balances.
 *
 * All changes are safe for live data — no tables dropped or truncated.
 */

exports.up = async function (knex) {
    // FIX 5: Deactivate "Sales Discount" account
    // Discounts are already handled at transaction level via sales.discount_amount.
    // Keeping this account active causes double-counting risk.
    await knex('accounts')
        .where('code', '4002')
        .update({
            is_active: false,
            is_system: false
        });

    // FIX 6: Opening Balance Journal Entries — SKIPPED (Option B)
    // ─────────────────────────────────────────────────────────────
    // KNOWN ISSUE: The following accounts have opening_balance values
    // but NO corresponding journal entries in the ledger:
    //
    //   Cash in Hand (1001):   PKR 100,000 debit
    //   Bank Account (1002):   PKR 500,000 debit
    //   Owner Capital (3001):  PKR 600,000 credit
    //
    // The correct journal entry would be:
    //   DR  Cash in Hand      100,000
    //   DR  Bank Account      500,000
    //   CR  Owner Capital     600,000
    //
    // However, the trigger_update_account trigger auto-adjusts
    // current_balance on INSERT to ledger_entries. Since these
    // opening amounts are ALREADY reflected in current_balance,
    // inserting the entries now would DOUBLE the balances.
    //
    // Resolution: Before creating opening journals, first reset
    // current_balance to 0 for these three accounts, then insert
    // the journal entries (the trigger will set them back correctly).
    // This should ONLY be done during a maintenance window when
    // no concurrent transactions are running.
    // ─────────────────────────────────────────────────────────────

    // FIX 7: Add "Retained Earnings" account under Equity group
    // Look up the Equity group (previously "Owner Capital", renamed in prior migration)
    const equityGroup = await knex('account_groups')
        .where('name', 'Equity')
        .first('id');

    if (!equityGroup) {
        throw new Error('Equity account group not found. Ensure migration 20260302100000 ran first.');
    }

    // Check if account already exists (idempotent)
    const existing = await knex('accounts').where('code', '3002').first();
    if (!existing) {
        await knex('accounts').insert({
            code: '3002',
            name: 'Retained Earnings',
            account_type: 'equity',
            group_id: equityGroup.id,
            opening_balance: 0,
            current_balance: 0,
            is_bank_account: false,
            is_system: true,
            is_active: true
        });
    }
};

exports.down = async function (knex) {
    // Reverse FIX 7: Remove "Retained Earnings" account
    // Only safe if no ledger_entries reference it
    const retainedEarnings = await knex('accounts').where('code', '3002').first('id');
    if (retainedEarnings) {
        const hasEntries = await knex('ledger_entries')
            .where('account_id', retainedEarnings.id)
            .first();
        if (hasEntries) {
            console.warn('Cannot delete Retained Earnings account — ledger entries exist. Deactivating instead.');
            await knex('accounts').where('code', '3002').update({ is_active: false });
        } else {
            await knex('accounts').where('code', '3002').del();
        }
    }

    // Reverse FIX 5: Reactivate "Sales Discount" account
    await knex('accounts')
        .where('code', '4002')
        .update({
            is_active: true,
            is_system: true
        });
};
