/**
 * Create brands table (replaces old companies table dropped in professional_schema_v1)
 */
exports.up = async function (knex) {
    await knex.schema.createTable('brands', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 150).notNullable();
        table.text('description');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    });

    await knex.raw('CREATE INDEX idx_brands_tenant ON brands(tenant_id)');
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('brands');
};
