/**
 * Migration: Add onboarding tracking + company info columns to tenants table
 * 
 * onboarding_step values:
 *   1 = company_info
 *   2 = categories
 *   3 = brands
 *   4 = units
 *   5 = complete
 */

exports.up = async function (knex) {
    // Add onboarding + company info columns
    await knex.schema.alterTable('tenants', (table) => {
        // Onboarding tracking
        table.boolean('is_onboarded').defaultTo(false).notNullable();
        table.smallint('onboarding_step').defaultTo(1);

        // Company information (used by Settings & invoices)
        table.string('ntn_number', 50);
        table.string('strn_number', 50);
        table.decimal('default_tax_rate', 5, 2).defaultTo(0);
        table.string('phone', 30);
        table.string('city', 100);
        table.text('address');
        table.smallint('financial_year_start').defaultTo(1);  // January
        table.smallint('financial_year_end').defaultTo(12);   // December
    });

    // IMPORTANT: Mark ALL existing tenants as already onboarded
    // so they never see the setup wizard
    await knex('tenants').update({ is_onboarded: true, onboarding_step: 5 });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('tenants', (table) => {
        table.dropColumn('is_onboarded');
        table.dropColumn('onboarding_step');
        table.dropColumn('ntn_number');
        table.dropColumn('strn_number');
        table.dropColumn('default_tax_rate');
        table.dropColumn('phone');
        table.dropColumn('city');
        table.dropColumn('address');
        table.dropColumn('financial_year_start');
        table.dropColumn('financial_year_end');
    });
};
