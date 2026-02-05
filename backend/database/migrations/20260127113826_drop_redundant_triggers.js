
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Drop triggers that conflict with service-level business logic (FIFO & Accounting)
    await knex.raw(`
        DROP TRIGGER IF EXISTS trigger_update_stock_sale ON sale_items;
        DROP TRIGGER IF EXISTS trigger_update_stock_purchase ON purchase_items;
        DROP TRIGGER IF EXISTS trigger_update_account ON ledger_entries;
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // We don't want them back as they cause double counting
};
