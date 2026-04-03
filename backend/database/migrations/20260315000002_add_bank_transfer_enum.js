/**
 * Migration: Add bank_transfer to transaction_type enum
 */

exports.up = async function(knex) {
    await knex.raw(`
        ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bank_transfer';
    `);
};

exports.down = async function(knex) {
    // PostgreSQL doesn't support removing enum values directly
    // This is a forward-only migration for adding new transaction types
    await knex.raw(`
        -- Note: Cannot drop enum values in PostgreSQL without recreating the type
        -- This down migration is a no-op for safety
    `);
};
