/**
 * Migration: Add change_amount column to sales table
 * Purpose: Track overpayments when customers pay more than the total amount
 */

exports.up = async function (knex) {
    await knex.schema.table('sales', (table) => {
        table.decimal('change_amount', 15, 2).notNullable().defaultTo(0);
    });
};

exports.down = async function (knex) {
    await knex.schema.table('sales', (table) => {
        table.dropColumn('change_amount');
    });
};
