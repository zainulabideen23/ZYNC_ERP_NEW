/**
 * Add core-table return model support.
 *
 * - Adds return metadata to sales/purchases.
 * - Adds original line references to sale_items/purchase_items.
 * - Ensures purchase_status supports 'returned'.
 */

exports.up = async function up(knex) {
    await knex.raw("ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'returned'");
    await knex.raw("ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'returned'");

    const hasSalesIsReturn = await knex.schema.hasColumn('sales', 'is_return');
    const hasSalesOriginalId = await knex.schema.hasColumn('sales', 'original_sale_id');

    await knex.schema.alterTable('sales', (table) => {
        if (!hasSalesIsReturn) {
            table.boolean('is_return').notNullable().defaultTo(false);
        }

        if (!hasSalesOriginalId) {
            table.uuid('original_sale_id').references('id').inTable('sales').onDelete('RESTRICT');
        }
    });

    const hasPurchasesIsReturn = await knex.schema.hasColumn('purchases', 'is_return');
    const hasPurchasesOriginalId = await knex.schema.hasColumn('purchases', 'original_purchase_id');

    await knex.schema.alterTable('purchases', (table) => {
        if (!hasPurchasesIsReturn) {
            table.boolean('is_return').notNullable().defaultTo(false);
        }

        if (!hasPurchasesOriginalId) {
            table.uuid('original_purchase_id').references('id').inTable('purchases').onDelete('RESTRICT');
        }
    });

    const hasSaleItemsOriginalRef = await knex.schema.hasColumn('sale_items', 'original_sale_item_id');
    if (!hasSaleItemsOriginalRef) {
        await knex.schema.alterTable('sale_items', (table) => {
            table.uuid('original_sale_item_id').references('id').inTable('sale_items').onDelete('RESTRICT');
        });
    }

    const hasPurchaseItemsOriginalRef = await knex.schema.hasColumn('purchase_items', 'original_purchase_item_id');
    if (!hasPurchaseItemsOriginalRef) {
        await knex.schema.alterTable('purchase_items', (table) => {
            table.uuid('original_purchase_item_id').references('id').inTable('purchase_items').onDelete('RESTRICT');
        });
    }

    await knex.raw('CREATE INDEX IF NOT EXISTS idx_sales_tenant_is_return ON sales(tenant_id, is_return)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_sales_tenant_original_sale ON sales(tenant_id, original_sale_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchases_tenant_is_return ON purchases(tenant_id, is_return)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchases_tenant_original_purchase ON purchases(tenant_id, original_purchase_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_sale_items_original_sale_item ON sale_items(original_sale_item_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchase_items_original_purchase_item ON purchase_items(original_purchase_item_id)');

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'sales_original_sale_not_self'
            ) THEN
                ALTER TABLE sales
                    ADD CONSTRAINT sales_original_sale_not_self
                    CHECK (original_sale_id IS NULL OR original_sale_id <> id);
            END IF;
        END $$;
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'purchases_original_purchase_not_self'
            ) THEN
                ALTER TABLE purchases
                    ADD CONSTRAINT purchases_original_purchase_not_self
                    CHECK (original_purchase_id IS NULL OR original_purchase_id <> id);
            END IF;
        END $$;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_original_sale_not_self');
    await knex.raw('ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_original_purchase_not_self');

    await knex.raw('DROP INDEX IF EXISTS idx_sales_tenant_is_return');
    await knex.raw('DROP INDEX IF EXISTS idx_sales_tenant_original_sale');
    await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_is_return');
    await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_original_purchase');
    await knex.raw('DROP INDEX IF EXISTS idx_sale_items_original_sale_item');
    await knex.raw('DROP INDEX IF EXISTS idx_purchase_items_original_purchase_item');

    const hasSaleItemsOriginalRef = await knex.schema.hasColumn('sale_items', 'original_sale_item_id');
    if (hasSaleItemsOriginalRef) {
        await knex.schema.alterTable('sale_items', (table) => {
            table.dropColumn('original_sale_item_id');
        });
    }

    const hasPurchaseItemsOriginalRef = await knex.schema.hasColumn('purchase_items', 'original_purchase_item_id');
    if (hasPurchaseItemsOriginalRef) {
        await knex.schema.alterTable('purchase_items', (table) => {
            table.dropColumn('original_purchase_item_id');
        });
    }

    const hasSalesOriginalId = await knex.schema.hasColumn('sales', 'original_sale_id');
    if (hasSalesOriginalId) {
        await knex.schema.alterTable('sales', (table) => {
            table.dropColumn('original_sale_id');
        });
    }

    const hasSalesIsReturn = await knex.schema.hasColumn('sales', 'is_return');
    if (hasSalesIsReturn) {
        await knex.schema.alterTable('sales', (table) => {
            table.dropColumn('is_return');
        });
    }

    const hasPurchasesOriginalId = await knex.schema.hasColumn('purchases', 'original_purchase_id');
    if (hasPurchasesOriginalId) {
        await knex.schema.alterTable('purchases', (table) => {
            table.dropColumn('original_purchase_id');
        });
    }

    const hasPurchasesIsReturn = await knex.schema.hasColumn('purchases', 'is_return');
    if (hasPurchasesIsReturn) {
        await knex.schema.alterTable('purchases', (table) => {
            table.dropColumn('is_return');
        });
    }

    // Enum value removal is intentionally skipped for PostgreSQL.
};
