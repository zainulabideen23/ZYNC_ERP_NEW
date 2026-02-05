/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('products', table => {
        table.string('sub_category');
        table.text('tags');
        table.string('status').defaultTo('active'); // active, inactive, discontinued
        table.decimal('weight', 15, 3);
        table.string('weight_unit'); // kg, g, lb
        table.string('dimensions'); // length x width x height
        table.uuid('primary_supplier_id').references('id').inTable('suppliers').onDelete('SET NULL');
        table.string('supplier_sku');
        table.decimal('tax_rate', 5, 2).defaultTo(0);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('products', table => {
        table.dropColumn('sub_category');
        table.dropColumn('tags');
        table.dropColumn('status');
        table.dropColumn('weight');
        table.dropColumn('weight_unit');
        table.dropColumn('dimensions');
        table.dropForeign('primary_supplier_id');
        table.dropColumn('primary_supplier_id');
        table.dropColumn('supplier_sku');
        table.dropColumn('tax_rate');
    });
};
