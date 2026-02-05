
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw(`
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_date_check;
        ALTER TABLE sales ADD CONSTRAINT sales_sale_date_check CHECK (sale_date <= CURRENT_TIMESTAMP + interval '1 day');
        
        ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_purchase_date_check;
        ALTER TABLE purchases ADD CONSTRAINT purchases_purchase_date_check CHECK (purchase_date <= CURRENT_TIMESTAMP + interval '1 day');

        ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_journal_date_check;
        ALTER TABLE journals ADD CONSTRAINT journals_journal_date_check CHECK (journal_date <= CURRENT_DATE + interval '1 day');
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // Revert to original checks if needed, but original checks were buggy
    await knex.raw(`
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_date_check;
        ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_purchase_date_check;
        ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_journal_date_check;
    `);
};
