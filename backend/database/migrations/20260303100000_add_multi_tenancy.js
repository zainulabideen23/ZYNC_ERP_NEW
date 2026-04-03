/**
 * Multi-Tenancy Migration
 * 
 * Creates the tenants table and adds tenant_id to ALL 24 application tables.
 * Safe for existing data — creates a default tenant and backfills all rows.
 * 
 * Tables modified (24):
 *   users, audit_logs, sequences, units, categories,
 *   company_info, account_groups, accounts, journals, ledger_entries,
 *   customers, suppliers, products, stock_movements, stock_adjustments,
 *   sales, sale_items, quotations, quotation_items, purchases,
 *   purchase_items, payments, expenses, expense_categories
 * 
 * Special cases handled:
 *   - company_info: remove single-row trigger, add UNIQUE(tenant_id)
 *   - sequences: change PK from (name) to (name, tenant_id)
 *   - RLS enabled on 5 sensitive tables
 */

exports.up = async function (knex) {
    // =====================================================
    // 1. CREATE TENANTS TABLE
    // =====================================================
    await knex.raw(`
        CREATE TABLE tenants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(150) NOT NULL,
            slug VARCHAR(50) UNIQUE NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            plan VARCHAR(50) NOT NULL DEFAULT 'basic',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            max_users SMALLINT NOT NULL DEFAULT 5,
            CHECK (LENGTH(name) > 0),
            CHECK (LENGTH(slug) > 0),
            CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR LENGTH(slug) = 1)
        );
        CREATE INDEX idx_tenants_slug ON tenants(slug);
    `);

    // =====================================================
    // 2. INSERT DEFAULT TENANT
    // =====================================================
    const [defaultTenant] = await knex('tenants').insert({
        name: 'Default Tenant',
        slug: 'default',
        is_active: true,
        plan: 'enterprise',
        max_users: 100
    }).returning('id');
    const defaultTenantId = defaultTenant.id || defaultTenant;

    // =====================================================
    // 3. ADD tenant_id TO ALL 25 TABLES
    // =====================================================

    // --- 3a. HANDLE SEQUENCES SPECIALLY ---
    // Current PK is (name). Need to change to (name, tenant_id).
    // 1) Add tenant_id column (nullable first)
    // 2) Backfill with default tenant
    // 3) Drop old PK
    // 4) Set NOT NULL
    // 5) Create composite PK

    await knex.raw(`
        ALTER TABLE sequences ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE sequences SET tenant_id = '${defaultTenantId}';
        ALTER TABLE sequences ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE sequences DROP CONSTRAINT sequences_pkey;
        ALTER TABLE sequences ADD PRIMARY KEY (name, tenant_id);
        CREATE INDEX idx_sequences_tenant ON sequences(tenant_id);
    `);

    // --- 3b. HANDLE COMPANY_INFO SPECIALLY ---
    // Remove single-row trigger, add tenant_id with UNIQUE constraint
    await knex.raw(`
        DROP TRIGGER IF EXISTS ensure_single_company_info ON company_info;
        DROP FUNCTION IF EXISTS check_single_row();
        ALTER TABLE company_info ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE company_info SET tenant_id = '${defaultTenantId}';
        ALTER TABLE company_info ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE company_info ADD CONSTRAINT uq_company_info_tenant UNIQUE (tenant_id);
        CREATE INDEX idx_company_info_tenant ON company_info(tenant_id);
    `);

    // --- 3c. ALL OTHER TABLES ---
    // Temporarily disable the ledger immutability trigger so we can backfill tenant_id
    await knex.raw(`ALTER TABLE ledger_entries DISABLE TRIGGER no_ledger_updates`);

    // Order matters due to foreign keys. Add nullable → backfill → NOT NULL → index
    const tables = [
        'users',
        'units',
        'categories',
        'account_groups',
        'accounts',
        'customers',
        'suppliers',
        'products',
        'stock_movements',
        'stock_adjustments',
        'sales',
        'sale_items',
        'quotations',
        'quotation_items',
        'purchases',
        'purchase_items',
        'payments',
        'journals',
        'ledger_entries',
        'expenses',
        'expense_categories',
        'audit_logs'
    ];

    for (const table of tables) {
        await knex.raw(`
            ALTER TABLE "${table}" ADD COLUMN tenant_id UUID REFERENCES tenants(id);
            UPDATE "${table}" SET tenant_id = '${defaultTenantId}';
            ALTER TABLE "${table}" ALTER COLUMN tenant_id SET NOT NULL;
            CREATE INDEX idx_${table}_tenant ON "${table}"(tenant_id);
        `);
    }

    // Re-enable the ledger immutability trigger
    await knex.raw(`ALTER TABLE ledger_entries ENABLE TRIGGER no_ledger_updates`);

    // =====================================================
    // 4. ROW LEVEL SECURITY (safety net on 5 sensitive tables)
    // =====================================================
    const rlsTables = ['sales', 'purchases', 'customers', 'suppliers', 'accounts'];

    for (const table of rlsTables) {
        await knex.raw(`
            ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
            CREATE POLICY tenant_isolation_${table} ON "${table}"
                USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
        `);
    }

    // Allow the table owner (postgres role running queries) to bypass RLS
    // so application queries via Knex work correctly while still
    // having RLS as a safety net for direct DB access.
    await knex.raw(`
        ALTER TABLE sales FORCE ROW LEVEL SECURITY;
        ALTER TABLE purchases FORCE ROW LEVEL SECURITY;
        ALTER TABLE customers FORCE ROW LEVEL SECURITY;
        ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
        ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
    `);

    // Create a bypass policy for the application role 
    // (the PostgreSQL user running Knex queries — typically 'postgres')
    // This allows the application to query without RLS blocking,
    // while RLS still protects against ad-hoc/direct SQL access
    // that forgets to SET app.tenant_id.
    const currentUser = await knex.raw('SELECT current_user AS u');
    const appUser = currentUser.rows[0].u;

    for (const table of rlsTables) {
        await knex.raw(`
            CREATE POLICY app_bypass_${table} ON "${table}"
                TO "${appUser}"
                USING (true)
                WITH CHECK (true);
        `);
    }
};

exports.down = async function (knex) {
    // =====================================================
    // REVERSE: Remove RLS
    // =====================================================
    const rlsTables = ['sales', 'purchases', 'customers', 'suppliers', 'accounts'];

    const currentUser = await knex.raw('SELECT current_user AS u');
    const appUser = currentUser.rows[0].u;

    for (const table of rlsTables) {
        await knex.raw(`
            DROP POLICY IF EXISTS app_bypass_${table} ON "${table}";
            DROP POLICY IF EXISTS tenant_isolation_${table} ON "${table}";
            ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;
        `);
    }

    // =====================================================
    // REVERSE: Remove tenant_id from all regular tables
    // =====================================================
    const tables = [
        'audit_logs',
        'expense_categories',
        'expenses',
        'ledger_entries',
        'journals',
        'payments',
        'purchase_items',
        'purchases',
        'quotation_items',
        'quotations',
        'sale_items',
        'sales',
        'stock_adjustments',
        'stock_movements',
        'products',
        'suppliers',
        'customers',
        'accounts',
        'account_groups',
        'categories',
        'units',
        'users'
    ];

    for (const table of tables) {
        await knex.raw(`
            DROP INDEX IF EXISTS idx_${table}_tenant;
            ALTER TABLE "${table}" DROP COLUMN IF EXISTS tenant_id;
        `);
    }

    // =====================================================
    // REVERSE: company_info — restore single-row trigger
    // =====================================================
    await knex.raw(`
        DROP INDEX IF EXISTS idx_company_info_tenant;
        ALTER TABLE company_info DROP CONSTRAINT IF EXISTS uq_company_info_tenant;
        ALTER TABLE company_info DROP COLUMN IF EXISTS tenant_id;

        CREATE OR REPLACE FUNCTION check_single_row() RETURNS TRIGGER AS $$
        BEGIN
            IF (SELECT COUNT(*) FROM company_info) > 0 THEN
                RAISE EXCEPTION 'Only one company record allowed';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER ensure_single_company_info
        BEFORE INSERT ON company_info
        FOR EACH ROW
        EXECUTE FUNCTION check_single_row();
    `);

    // =====================================================
    // REVERSE: sequences — restore original PK
    // =====================================================
    await knex.raw(`
        DROP INDEX IF EXISTS idx_sequences_tenant;
        ALTER TABLE sequences DROP CONSTRAINT sequences_pkey;
        ALTER TABLE sequences DROP COLUMN tenant_id;
        ALTER TABLE sequences ADD PRIMARY KEY (name);
    `);

    // =====================================================
    // REVERSE: Drop tenants table
    // =====================================================
    await knex.raw('DROP TABLE IF EXISTS tenants CASCADE');
};
