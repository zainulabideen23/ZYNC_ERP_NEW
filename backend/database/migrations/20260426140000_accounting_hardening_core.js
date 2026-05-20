exports.up = async function up(knex) {
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'sale_return';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'purchase_return';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'expense';
            END IF;
        END $$;
    `);

    const hasJournals = await knex.schema.hasTable('journals');
    const hasLedgerEntries = await knex.schema.hasTable('ledger_entries');
    const hasAccounts = await knex.schema.hasTable('accounts');
    if (!hasJournals || !hasLedgerEntries || !hasAccounts) return;

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename = 'journals'
                  AND policyname = 'tenant_isolation_journals'
            ) THEN
                ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
                CREATE POLICY tenant_isolation_journals ON journals
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename = 'ledger_entries'
                  AND policyname = 'tenant_isolation_ledger'
            ) THEN
                ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
                CREATE POLICY tenant_isolation_ledger ON ledger_entries
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename = 'stock_movements'
                  AND policyname = 'tenant_isolation_stock'
            ) THEN
                ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
                CREATE POLICY tenant_isolation_stock ON stock_movements
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'journals'::regclass
                  AND conname = 'journals_balance_check'
            ) THEN
                ALTER TABLE journals
                    ADD CONSTRAINT journals_balance_check
                    CHECK (ABS(total_debit - total_credit) < 0.01);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'accounts'::regclass
                  AND conname = 'accounts_tenant_code_unique'
            ) THEN
                ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_code_key;
                ALTER TABLE accounts
                    ADD CONSTRAINT accounts_tenant_code_unique
                    UNIQUE (tenant_id, code);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'ledger_entries'::regclass
                  AND conname = 'ledger_entries_amount_check'
            ) THEN
                ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_amount_check;
                ALTER TABLE ledger_entries
                    ADD CONSTRAINT ledger_entries_amount_check
                    CHECK (amount >= 0.001);
            END IF;
        END $$;
    `);

    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_ledger_tenant_account_journal ON ledger_entries (tenant_id, account_id, journal_id)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_journals_tenant_date ON journals (tenant_id, journal_date)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_stock_tenant_product_date ON stock_movements (tenant_id, product_id, created_at)`);
};

exports.down = async function down() {
    // Keep the hardening in place; removing these constraints/indexes is not safe in production.
};