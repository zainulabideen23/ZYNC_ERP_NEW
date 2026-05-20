/**
 * Purchase engine foundational upgrades:
 * - Supplier credit controls (credit_limit + current_credit_used)
 * - RLS safety net for stock_movements
 * - Reporting indexes for purchase/cost history and aging
 */

exports.up = async function up(knex) {
    const hasSuppliers = await knex.schema.hasTable('suppliers');

    if (hasSuppliers) {
        const hasCreditLimit = await knex.schema.hasColumn('suppliers', 'credit_limit');
        const hasCurrentCreditUsed = await knex.schema.hasColumn('suppliers', 'current_credit_used');

        if (!hasCreditLimit) {
            await knex.schema.alterTable('suppliers', (table) => {
                table.decimal('credit_limit', 15, 2).nullable();
            });
        }

        if (!hasCurrentCreditUsed) {
            await knex.schema.alterTable('suppliers', (table) => {
                table.decimal('current_credit_used', 15, 2).notNullable().defaultTo(0);
            });
        }

        await knex.raw(`
            UPDATE suppliers
            SET current_credit_used = GREATEST(COALESCE(current_balance, 0), 0)
            WHERE current_credit_used IS NULL
               OR ABS(COALESCE(current_credit_used, 0) - GREATEST(COALESCE(current_balance, 0), 0)) > 0.01;
        `);

        // Keep migration non-breaking for legacy tenants where an explicit credit_limit
        // exists but is lower than already posted supplier exposure.
        await knex.raw(`
            UPDATE suppliers
            SET credit_limit = current_credit_used
            WHERE credit_limit IS NOT NULL
              AND current_credit_used > credit_limit;
        `);

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'suppliers'::regclass
                      AND conname = 'suppliers_credit_limit_non_negative_chk'
                ) THEN
                    ALTER TABLE suppliers
                        ADD CONSTRAINT suppliers_credit_limit_non_negative_chk
                        CHECK (credit_limit IS NULL OR credit_limit >= 0);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'suppliers'::regclass
                      AND conname = 'suppliers_current_credit_used_non_negative_chk'
                ) THEN
                    ALTER TABLE suppliers
                        ADD CONSTRAINT suppliers_current_credit_used_non_negative_chk
                        CHECK (current_credit_used >= 0);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'suppliers'::regclass
                      AND conname = 'suppliers_credit_limit_usage_chk'
                ) THEN
                    ALTER TABLE suppliers
                        ADD CONSTRAINT suppliers_credit_limit_usage_chk
                        CHECK (credit_limit IS NULL OR current_credit_used <= credit_limit);
                END IF;
            END $$;
        `);

        await knex.raw('CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_credit_limit ON suppliers(tenant_id, credit_limit);');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_credit_used ON suppliers(tenant_id, current_credit_used);');
    }

    const hasStockMovements = await knex.schema.hasTable('stock_movements');
    const stockHasTenant = hasStockMovements && await knex.schema.hasColumn('stock_movements', 'tenant_id');

    if (stockHasTenant) {
        await knex.raw('ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;');
        await knex.raw('ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;');
        await knex.raw('DROP POLICY IF EXISTS tenant_isolation_stock_movements ON stock_movements;');
        await knex.raw(`
            CREATE POLICY tenant_isolation_stock_movements ON stock_movements
                USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
        `);

        const currentUser = await knex.raw('SELECT current_user AS u');
        const appUser = String(currentUser.rows?.[0]?.u || 'postgres').replace(/"/g, '""');
        await knex.raw('DROP POLICY IF EXISTS app_bypass_stock_movements ON stock_movements;');
        await knex.raw(`
            CREATE POLICY app_bypass_stock_movements ON stock_movements
                TO "${appUser}"
                USING (true)
                WITH CHECK (true);
        `);
    }

    const hasPurchases = await knex.schema.hasTable('purchases');
    if (hasPurchases) {
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchases_tenant_purchase_date ON purchases(tenant_id, purchase_date DESC, id DESC);');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchases_tenant_supplier_date ON purchases(tenant_id, supplier_id, purchase_date DESC, id DESC);');
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_purchases_tenant_supplier_due_aging
            ON purchases(tenant_id, supplier_id, purchase_date)
            WHERE is_deleted = false
              AND amount_due > 0
                            AND status <> 'cancelled';
        `);
    }

    const hasPurchaseItems = await knex.schema.hasTable('purchase_items');
    const purchaseItemsHasTenant = hasPurchaseItems && await knex.schema.hasColumn('purchase_items', 'tenant_id');
    if (purchaseItemsHasTenant) {
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchase_items_tenant_product_date ON purchase_items(tenant_id, product_id, created_at DESC);');
    }

    if (stockHasTenant) {
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product_date ON stock_movements(tenant_id, product_id, created_at DESC);');
    }
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_suppliers_tenant_credit_limit;');
    await knex.raw('DROP INDEX IF EXISTS idx_suppliers_tenant_credit_used;');
    await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_purchase_date;');
    await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_supplier_date;');
    await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_supplier_due_aging;');
    await knex.raw('DROP INDEX IF EXISTS idx_purchase_items_tenant_product_date;');
    await knex.raw('DROP INDEX IF EXISTS idx_stock_movements_tenant_product_date;');

    const hasStockMovements = await knex.schema.hasTable('stock_movements');
    if (hasStockMovements) {
        await knex.raw('DROP POLICY IF EXISTS app_bypass_stock_movements ON stock_movements;');
        await knex.raw('DROP POLICY IF EXISTS tenant_isolation_stock_movements ON stock_movements;');
        await knex.raw('ALTER TABLE stock_movements NO FORCE ROW LEVEL SECURITY;');
        await knex.raw('ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;');
    }

    const hasSuppliers = await knex.schema.hasTable('suppliers');
    if (hasSuppliers) {
        await knex.raw('ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_credit_limit_usage_chk;');
        await knex.raw('ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_current_credit_used_non_negative_chk;');
        await knex.raw('ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_credit_limit_non_negative_chk;');
    }
};
