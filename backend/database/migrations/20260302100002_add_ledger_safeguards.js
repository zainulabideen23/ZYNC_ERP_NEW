/**
 * Migration: Add Ledger Safeguards (Fixes 8-9)
 *
 * FIX 8 — Prevent modification of posted ledger entries
 *         Once a ledger entry is created, it MUST be immutable.
 *         Corrections are made via reversal journal entries only.
 *         This is a fundamental accounting principle (no erasing history).
 *
 * FIX 9 — Add balance reconciliation function
 *         A callable function that compares every account's stored
 *         current_balance against the computed sum of all its ledger
 *         entries + opening_balance. Returns only accounts with
 *         discrepancies > 0.01 (rounding tolerance).
 *
 * NOTE: The existing trigger_update_account (AFTER INSERT) is NOT
 *       affected. The new trigger fires on UPDATE/DELETE only.
 */

exports.up = async function (knex) {
    // FIX 8: Immutability trigger on ledger_entries
    // Prevents UPDATE or DELETE — corrections must use reversal entries.
    await knex.raw(`
        CREATE OR REPLACE FUNCTION prevent_ledger_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Ledger entries are immutable. Create a reversal entry to correct mistakes.';
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        CREATE TRIGGER no_ledger_updates
            BEFORE UPDATE OR DELETE ON ledger_entries
            FOR EACH ROW
            EXECUTE FUNCTION prevent_ledger_modification();
    `);

    // FIX 9: Balance reconciliation function
    // Returns accounts where current_balance != computed balance from ledger.
    // Usage: SELECT * FROM check_account_balance_integrity();
    await knex.raw(`
        CREATE OR REPLACE FUNCTION check_account_balance_integrity()
        RETURNS TABLE(
            account_id UUID,
            account_name VARCHAR,
            stored_balance DECIMAL,
            computed_balance DECIMAL,
            difference DECIMAL
        ) AS $$
            SELECT
                a.id,
                a.name,
                a.current_balance AS stored_balance,
                COALESCE(
                    SUM(CASE
                        WHEN le.entry_type = 'debit' THEN le.amount
                        WHEN le.entry_type = 'credit' THEN -le.amount
                    END), 0
                ) + a.opening_balance AS computed_balance,
                a.current_balance - (
                    COALESCE(SUM(CASE
                        WHEN le.entry_type = 'debit' THEN le.amount
                        WHEN le.entry_type = 'credit' THEN -le.amount
                    END), 0) + a.opening_balance
                ) AS difference
            FROM accounts a
            LEFT JOIN ledger_entries le ON le.account_id = a.id
            GROUP BY a.id, a.name, a.current_balance, a.opening_balance
            HAVING ABS(
                a.current_balance - (
                    COALESCE(SUM(CASE
                        WHEN le.entry_type = 'debit' THEN le.amount
                        WHEN le.entry_type = 'credit' THEN -le.amount
                    END), 0) + a.opening_balance
                )
            ) > 0.01;
        $$ LANGUAGE sql;
    `);
};

exports.down = async function (knex) {
    // Reverse FIX 9: Drop reconciliation function
    await knex.raw('DROP FUNCTION IF EXISTS check_account_balance_integrity();');

    // Reverse FIX 8: Drop immutability trigger and function
    await knex.raw('DROP TRIGGER IF EXISTS no_ledger_updates ON ledger_entries;');
    await knex.raw('DROP FUNCTION IF EXISTS prevent_ledger_modification();');
};
