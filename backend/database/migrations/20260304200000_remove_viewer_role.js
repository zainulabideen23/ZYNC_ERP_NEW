/**
 * Migration: Remove 'viewer' role from user_role ENUM
 * 
 * Step 1: Update any existing viewer users to cashier
 * Step 2: Recreate ENUM without viewer
 */

exports.up = async function(knex) {
    // Step 1: Update any existing viewer users to cashier
    await knex.raw(`UPDATE users SET role = 'cashier' WHERE role = 'viewer'`);

    // Step 2: Create new ENUM without viewer
    await knex.raw(`ALTER TYPE user_role RENAME TO user_role_old`);
    await knex.raw(`CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier')`);
    await knex.raw(`
        ALTER TABLE users 
        ALTER COLUMN role TYPE user_role 
        USING role::text::user_role
    `);
    await knex.raw(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'cashier'`);
    await knex.raw(`DROP TYPE user_role_old`);
};

exports.down = async function(knex) {
    // Recreate with viewer
    await knex.raw(`ALTER TYPE user_role RENAME TO user_role_old`);
    await knex.raw(`CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier', 'viewer')`);
    await knex.raw(`
        ALTER TABLE users 
        ALTER COLUMN role TYPE user_role 
        USING role::text::user_role
    `);
    await knex.raw(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'cashier'`);
    await knex.raw(`DROP TYPE user_role_old`);
};
