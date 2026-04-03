/**
 * Fix units unique constraints to be tenant-scoped
 * 
 * The original constraints (units_name_key, units_abbreviation_key) are global,
 * which prevents two tenants from using the same unit name/abbreviation.
 * This migration changes them to composite (tenant_id, name) and (tenant_id, abbreviation).
 */
exports.up = async function (knex) {
    await knex.raw('ALTER TABLE units DROP CONSTRAINT IF EXISTS units_name_key');
    await knex.raw('ALTER TABLE units DROP CONSTRAINT IF EXISTS units_abbreviation_key');

    await knex.raw('ALTER TABLE units ADD CONSTRAINT units_tenant_name_unique UNIQUE (tenant_id, name)');
    await knex.raw('ALTER TABLE units ADD CONSTRAINT units_tenant_abbreviation_unique UNIQUE (tenant_id, abbreviation)');
};

exports.down = async function (knex) {
    await knex.raw('ALTER TABLE units DROP CONSTRAINT IF EXISTS units_tenant_name_unique');
    await knex.raw('ALTER TABLE units DROP CONSTRAINT IF EXISTS units_tenant_abbreviation_unique');

    await knex.raw('ALTER TABLE units ADD CONSTRAINT units_name_key UNIQUE (name)');
    await knex.raw('ALTER TABLE units ADD CONSTRAINT units_abbreviation_key UNIQUE (abbreviation)');
};
