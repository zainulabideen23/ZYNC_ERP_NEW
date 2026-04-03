/**
 * Migration: Extend audit_action ENUM with new values
 * 
 * Adds: login, login_failed, export, password_change, impersonate
 */

exports.up = async function(knex) {
    await knex.raw(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'login'`);
    await knex.raw(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'login_failed'`);
    await knex.raw(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'export'`);
    await knex.raw(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'password_change'`);
    await knex.raw(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impersonate'`);
};

exports.down = async function(knex) {
    // PostgreSQL does not support removing values from ENUMs
    // This migration is not reversible for the ENUM values
    // The values will remain but won't cause issues
};
