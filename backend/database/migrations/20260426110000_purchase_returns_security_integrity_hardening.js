/**
 * Purchase return security and integrity hardening.
 *
 * - Adds/ensures tenant-isolation RLS policies for journals, ledger_entries and stock_movements.
 * - Adds journal balance check constraint.
 * - Adds performance indexes for return and accounting queries.
 * - Ensures purchase_items.original_purchase_item_id uses ON DELETE RESTRICT.
 */

exports.up = async function up(knex) {
    // Row-level security and tenant policies
    await knex.raw('ALTER TABLE journals ENABLE ROW LEVEL SECURITY;');
    await knex.raw('ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;');
    await knex.raw('ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;');

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename = 'journals'
                  AND policyname = 'tenant_isolation_journals'
            ) THEN
                CREATE POLICY tenant_isolation_journals ON journals
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename = 'ledger_entries'
                  AND policyname = 'tenant_isolation_ledger'
            ) THEN
                CREATE POLICY tenant_isolation_ledger ON ledger_entries
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename = 'stock_movements'
                  AND policyname = 'tenant_isolation_stock'
            ) THEN
                CREATE POLICY tenant_isolation_stock ON stock_movements
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);
            END IF;
        END $$;
    `);

    // Journal balancing constraint
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conrelid = 'journals'::regclass
                  AND conname = 'journals_balance_check'
            ) THEN
                ALTER TABLE journals
                    ADD CONSTRAINT journals_balance_check
                    CHECK (ABS(total_debit - total_credit) < 0.01);
            END IF;
        END $$;
    `);

    // Performance indexes
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_purchases_tenant_is_return_original
        ON purchases(tenant_id, is_return, original_purchase_id);
    `);

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product_ref
        ON stock_movements(tenant_id, product_id, reference_type);
    `);

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_account_journal
        ON ledger_entries(tenant_id, account_id, journal_id);
    `);

    // FK integrity for purchase return line references
    await knex.raw(`
        ALTER TABLE purchase_items
        DROP CONSTRAINT IF EXISTS purchase_items_original_purchase_item_id_fkey;

        ALTER TABLE purchase_items
        ADD CONSTRAINT purchase_items_original_purchase_item_id_fkey
        FOREIGN KEY (original_purchase_item_id)
        REFERENCES purchase_items(id)
        ON DELETE RESTRICT;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_ledger_entries_tenant_account_journal;');
    await knex.raw('DROP INDEX IF EXISTS idx_stock_movements_tenant_product_ref;');
    await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_is_return_original;');

    await knex.raw('ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_balance_check;');

    await knex.raw('DROP POLICY IF EXISTS tenant_isolation_stock ON stock_movements;');
    await knex.raw('DROP POLICY IF EXISTS tenant_isolation_ledger ON ledger_entries;');
    await knex.raw('DROP POLICY IF EXISTS tenant_isolation_journals ON journals;');

    // Keep RLS enabled because older migrations may rely on enabled state.

    await knex.raw(`
        ALTER TABLE purchase_items
        DROP CONSTRAINT IF EXISTS purchase_items_original_purchase_item_id_fkey;

        ALTER TABLE purchase_items
        ADD CONSTRAINT purchase_items_original_purchase_item_id_fkey
        FOREIGN KEY (original_purchase_item_id)
        REFERENCES purchase_items(id);
    `);
};
