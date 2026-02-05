
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('account_groups', table => {
        table.string('code', 20).unique().nullable();
    });

    // Seed basic codes for system groups if they exist
    await knex('account_groups').where('name', 'Cash').update({ code: '1000' });
    await knex('account_groups').where('name', 'Bank Accounts').update({ code: '1100' });
    await knex('account_groups').where('name', 'Inventory').update({ code: '1400' });
    await knex('account_groups').where('name', 'Receivables').update({ code: '1200' });
    await knex('account_groups').where('name', 'Payables').update({ code: '2000' });
    await knex('account_groups').where('name', 'Sales Revenue').update({ code: '4000' });
    await knex('account_groups').where('name', 'Cost of Goods Sold').update({ code: '5000' });
    await knex('account_groups').where('name', 'Operating Expenses').update({ code: '6000' });
    await knex('account_groups').where('name', 'Owner Capital').update({ code: '3000' });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('account_groups', table => {
        table.dropColumn('code');
    });
};
