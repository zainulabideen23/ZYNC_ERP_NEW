
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('customers', table => {
        table.string('company_name', 150).nullable();
        table.string('cnic_number', 20).nullable();
    });

    await knex.schema.alterTable('suppliers', table => {
        table.string('company_name', 150).nullable();
        table.string('cnic_number', 20).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('customers', table => {
        table.dropColumn('company_name');
        table.dropColumn('cnic_number');
    });

    await knex.schema.alterTable('suppliers', table => {
        table.dropColumn('company_name');
        table.dropColumn('cnic_number');
    });
};
