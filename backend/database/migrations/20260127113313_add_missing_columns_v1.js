
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Add missing items to purchase_items
    await knex.schema.alterTable('purchase_items', table => {
        table.decimal('line_discount', 15, 2).notNullable().defaultTo(0);
        table.decimal('tax_rate', 5, 2).notNullable().defaultTo(0);
        table.renameColumn('quantity_ordered', 'quantity');
    });

    // 2. Add cost_price to sale_items
    await knex.schema.alterTable('sale_items', table => {
        table.decimal('cost_price', 15, 2).notNullable().defaultTo(0);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('purchase_items', table => {
        table.dropColumn('line_discount');
        table.dropColumn('tax_rate');
        table.renameColumn('quantity', 'quantity_ordered');
    });

    await knex.schema.alterTable('sale_items', table => {
        table.dropColumn('cost_price');
    });
};
