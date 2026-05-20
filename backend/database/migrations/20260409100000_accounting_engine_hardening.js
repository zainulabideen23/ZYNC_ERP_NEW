/**
 * Accounting Engine Hardening
 *
 * - Replace strict equality checks with tolerance-based checks for sales/purchases/journals.
 * - Make journal number uniqueness tenant-scoped.
 * - Enable RLS and tenant-isolation policies on journals and ledger_entries.
 * - Add composite indexes for report/query performance.
 */

exports.up = async function up(knex) {
    const hasTenantOnJournals = await knex.schema.hasColumn('journals', 'tenant_id');
    const hasTenantOnLedgerEntries = await knex.schema.hasColumn('ledger_entries', 'tenant_id');

    // Drop strict total_amount equality checks and replace with tolerance checks.
    await knex.raw(`
        DO $$
        DECLARE constraint_rec RECORD;
        BEGIN
            FOR constraint_rec IN
                SELECT c.conname
                FROM pg_constraint c
                WHERE c.conrelid = 'sales'::regclass
                  AND c.contype = 'c'
                  AND regexp_replace(pg_get_constraintdef(c.oid), '\\s+', ' ', 'g') ~* 'total_amount\\s*=\\s*\\(subtotal\\s*-\\s*discount_amount\\)\\s*\\+\\s*tax_amount'
            LOOP
                EXECUTE format('ALTER TABLE sales DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
            END LOOP;
        END $$;
    `);

    await knex.raw(`
        DO $$
        DECLARE constraint_rec RECORD;
        BEGIN
            FOR constraint_rec IN
                SELECT c.conname
                FROM pg_constraint c
                WHERE c.conrelid = 'purchases'::regclass
                  AND c.contype = 'c'
                  AND regexp_replace(pg_get_constraintdef(c.oid), '\\s+', ' ', 'g') ~* 'total_amount\\s*=\\s*\\(subtotal\\s*-\\s*discount_amount\\)\\s*\\+\\s*tax_amount'
            LOOP
                EXECUTE format('ALTER TABLE purchases DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
            END LOOP;
        END $$;
    `);

    await knex.raw(`
        DO $$
        DECLARE constraint_rec RECORD;
        BEGIN
            FOR constraint_rec IN
                SELECT c.conname
                FROM pg_constraint c
                WHERE c.conrelid = 'journals'::regclass
                  AND c.contype = 'c'
                  AND regexp_replace(pg_get_constraintdef(c.oid), '\\s+', ' ', 'g') ~* 'total_debit\\s*=\\s*total_credit'
            LOOP
                EXECUTE format('ALTER TABLE journals DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
            END LOOP;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'sales'::regclass
                  AND conname = 'sales_total_amount_tolerance_chk'
            ) THEN
                ALTER TABLE sales
                    ADD CONSTRAINT sales_total_amount_tolerance_chk
                    CHECK (ABS(total_amount - ((subtotal - discount_amount) + tax_amount)) < 0.01);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'purchases'::regclass
                  AND conname = 'purchases_total_amount_tolerance_chk'
            ) THEN
                ALTER TABLE purchases
                    ADD CONSTRAINT purchases_total_amount_tolerance_chk
                    CHECK (ABS(total_amount - ((subtotal - discount_amount) + tax_amount)) < 0.01);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'journals'::regclass
                  AND conname = 'journals_balanced_tolerance_chk'
            ) THEN
                ALTER TABLE journals
                    ADD CONSTRAINT journals_balanced_tolerance_chk
                    CHECK (ABS(total_debit - total_credit) < 0.01);
            END IF;
        END $$;
    `);

    // Replace global journal number uniqueness with tenant-scoped uniqueness.
    if (hasTenantOnJournals) {
        await knex.raw(`
            DO $$
            DECLARE constraint_rec RECORD;
            BEGIN
                FOR constraint_rec IN
                    SELECT c.conname
                    FROM pg_constraint c
                    JOIN pg_attribute a
                      ON a.attrelid = c.conrelid
                     AND a.attnum = ANY (c.conkey)
                    WHERE c.conrelid = 'journals'::regclass
                      AND c.contype = 'u'
                    GROUP BY c.conname, c.conkey
                    HAVING array_length(c.conkey, 1) = 1
                       AND bool_or(a.attname = 'journal_number')
                LOOP
                    EXECUTE format('ALTER TABLE journals DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
                END LOOP;
            END $$;
        `);

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'journals'::regclass
                      AND conname = 'journals_tenant_journal_number_key'
                ) THEN
                    ALTER TABLE journals
                        ADD CONSTRAINT journals_tenant_journal_number_key
                        UNIQUE (tenant_id, journal_number);
                END IF;
            END $$;
        `);
    }

    // Performance indexes.
    if (hasTenantOnJournals) {
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_journals_tenant_date ON journals(tenant_id, journal_date);');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_journals_tenant_reference ON journals(tenant_id, reference_type, reference_id);');
    }

    if (hasTenantOnLedgerEntries) {
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_journal ON ledger_entries(tenant_id, journal_id);');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_account ON ledger_entries(tenant_id, account_id);');
    }

    // Enable RLS safety-net for journals and ledger entries (consistent with other tenant tables).
    if (hasTenantOnJournals || hasTenantOnLedgerEntries) {
        const currentUser = await knex.raw('SELECT current_user AS u');
        const appUser = currentUser.rows[0].u;

        if (hasTenantOnJournals) {
            await knex.raw(`
                ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
                ALTER TABLE journals FORCE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_journals ON journals;
                CREATE POLICY tenant_isolation_journals ON journals
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);
                DROP POLICY IF EXISTS app_bypass_journals ON journals;
                CREATE POLICY app_bypass_journals ON journals
                    TO "${appUser}"
                    USING (true)
                    WITH CHECK (true);
            `);
        }

        if (hasTenantOnLedgerEntries) {
            await knex.raw(`
                ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
                ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_ledger_entries ON ledger_entries;
                CREATE POLICY tenant_isolation_ledger_entries ON ledger_entries
                    USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);
                DROP POLICY IF EXISTS app_bypass_ledger_entries ON ledger_entries;
                CREATE POLICY app_bypass_ledger_entries ON ledger_entries
                    TO "${appUser}"
                    USING (true)
                    WITH CHECK (true);
            `);
        }
    }
};

exports.down = async function down(knex) {
    const hasTenantOnJournals = await knex.schema.hasColumn('journals', 'tenant_id');
    const hasTenantOnLedgerEntries = await knex.schema.hasColumn('ledger_entries', 'tenant_id');

    await knex.raw('DROP INDEX IF EXISTS idx_ledger_entries_tenant_account;');
    await knex.raw('DROP INDEX IF EXISTS idx_ledger_entries_tenant_journal;');
    await knex.raw('DROP INDEX IF EXISTS idx_journals_tenant_reference;');
    await knex.raw('DROP INDEX IF EXISTS idx_journals_tenant_date;');

    await knex.raw('ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_balanced_tolerance_chk;');
    await knex.raw('ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_total_amount_tolerance_chk;');
    await knex.raw('ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_total_amount_tolerance_chk;');

    if (hasTenantOnJournals) {
        await knex.raw('ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_tenant_journal_number_key;');

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'journals'::regclass
                      AND conname = 'journals_journal_number_key'
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM journals
                    GROUP BY journal_number
                    HAVING COUNT(*) > 1
                ) THEN
                    ALTER TABLE journals ADD CONSTRAINT journals_journal_number_key UNIQUE (journal_number);
                END IF;
            END $$;
        `);
    }

    if (hasTenantOnJournals) {
        await knex.raw(`
            DROP POLICY IF EXISTS app_bypass_journals ON journals;
            DROP POLICY IF EXISTS tenant_isolation_journals ON journals;
            ALTER TABLE journals NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE journals DISABLE ROW LEVEL SECURITY;
        `);
    }

    if (hasTenantOnLedgerEntries) {
        await knex.raw(`
            DROP POLICY IF EXISTS app_bypass_ledger_entries ON ledger_entries;
            DROP POLICY IF EXISTS tenant_isolation_ledger_entries ON ledger_entries;
            ALTER TABLE ledger_entries NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;
        `);
    }
};
