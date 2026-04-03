/**
 * Migration: Make audit_logs.user_id nullable
 * 
 * Required to support login_failed entries where user_id is unknown
 */

exports.up = async function(knex) {
    await knex.raw(`ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL`);
};

exports.down = async function(knex) {
    // Delete any rows with null user_id before re-adding constraint
    await knex('audit_logs').whereNull('user_id').delete();
    await knex.raw(`ALTER TABLE audit_logs ALTER COLUMN user_id SET NOT NULL`);
};
