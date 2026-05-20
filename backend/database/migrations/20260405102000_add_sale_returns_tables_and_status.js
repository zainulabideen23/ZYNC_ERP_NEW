/**
 * Add sale return workflow support.
 *
 * - Adds 'returned' to sale_status enum if missing.
 * - Creates sale_returns and sale_return_items tables.
 * - Ensures sale_return sequence exists per tenant.
 */

exports.up = async function up(knex) {
    await knex.raw("ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'returned'");

    const hasSaleReturns = await knex.schema.hasTable('sale_returns');
    if (!hasSaleReturns) {
        await knex.schema.createTable('sale_returns', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.string('return_number', 50).notNullable();
            table.uuid('sale_id').notNullable().references('id').inTable('sales').onDelete('RESTRICT');
            table.uuid('customer_id').references('id').inTable('customers').onDelete('SET NULL');
            table.timestamp('return_date').notNullable().defaultTo(knex.fn.now());
            table.decimal('subtotal', 15, 2).notNullable().defaultTo(0);
            table.decimal('total_amount', 15, 2).notNullable().defaultTo(0);
            table.string('status', 20).notNullable().defaultTo('processed');
            table.text('notes');
            table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('RESTRICT');

            table.unique(['tenant_id', 'return_number']);
            table.index(['tenant_id', 'sale_id'], 'idx_sale_returns_tenant_sale');
            table.index(['tenant_id', 'return_date'], 'idx_sale_returns_tenant_date');
        });
    }

    const hasSaleReturnItems = await knex.schema.hasTable('sale_return_items');
    if (!hasSaleReturnItems) {
        await knex.schema.createTable('sale_return_items', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('sale_return_id').notNullable().references('id').inTable('sale_returns').onDelete('CASCADE');
            table.uuid('sale_id').notNullable().references('id').inTable('sales').onDelete('RESTRICT');
            table.uuid('sale_item_id').notNullable().references('id').inTable('sale_items').onDelete('RESTRICT');
            table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
            table.decimal('quantity', 15, 2).notNullable();
            table.decimal('unit_price', 15, 2).notNullable().defaultTo(0);
            table.decimal('cost_price', 15, 2).notNullable().defaultTo(0);
            table.decimal('line_total', 15, 2).notNullable().defaultTo(0);
            table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('RESTRICT');

            table.unique(['sale_return_id', 'sale_item_id'], 'uq_sale_return_item_per_line');
            table.index(['tenant_id', 'sale_id'], 'idx_sale_return_items_tenant_sale');
            table.index(['tenant_id', 'product_id'], 'idx_sale_return_items_tenant_product');
        });
    }

    const tenants = await knex('tenants').select('id');

    for (const tenant of tenants) {
        const tenantId = tenant.id;
        const exists = await knex('sequences')
            .where({ tenant_id: tenantId, name: 'sale_return' })
            .first();

        if (!exists) {
            await knex('sequences').insert({
                tenant_id: tenantId,
                name: 'sale_return',
                prefix: 'SRN-',
                current_value: 0,
                pad_length: 6,
                is_active: true,
                description: 'Sale Return Numbering',
            });
        }
    }
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('sale_return_items');
    await knex.schema.dropTableIfExists('sale_returns');

    // Note: enum value removal for PostgreSQL types is intentionally skipped.
};
