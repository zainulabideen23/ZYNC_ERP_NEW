/**
 * Migration: Add phone number format constraints
 * 
 * Enforces strict Pakistani mobile format: +92 3[0-4]X XXXXXXX
 * - Must start with +92
 * - First digit after +92 must be 3
 * - Operator prefix 30x-34x (Jazz, Telenor, Zong, Ufone, Warid)
 * - Followed by 7 more digits (total 10 digits after +92 = 13 chars)
 * - Regex: ^\\+92(3[0-4][0-9])\\d{7}$
 * 
 * Cleans up existing data before adding constraints
 */

exports.up = async function(knex) {
    // Step 1: Clean existing data — normalize to +92 format
    await knex.raw(`
        UPDATE users 
        SET phone_number = '+92' || RIGHT(phone_number, 10)
        WHERE phone_number IS NOT NULL 
        AND phone_number != ''
        AND phone_number NOT LIKE '+92%'
    `);
    
    await knex.raw(`
        UPDATE customers 
        SET phone_number = '+92' || RIGHT(phone_number, 10)
        WHERE phone_number IS NOT NULL 
        AND phone_number != ''
        AND phone_number NOT LIKE '+92%'
    `);
    
    await knex.raw(`
        UPDATE suppliers 
        SET phone_number = '+92' || RIGHT(phone_number, 10)
        WHERE phone_number IS NOT NULL 
        AND phone_number != ''
        AND phone_number NOT LIKE '+92%'
    `);

    // Nullify any phone numbers that still don't match the strict Pakistani mobile format
    // Valid: +92 followed by 3[0-4]X then 7 digits (e.g. +923001234567)
    await knex.raw(`
        UPDATE users SET phone_number = NULL
        WHERE phone_number IS NOT NULL 
        AND phone_number !~ '^\\+92(3[0-4][0-9])\\d{7}$'
    `);

    await knex.raw(`
        UPDATE customers SET phone_number = NULL
        WHERE phone_number IS NOT NULL 
        AND phone_number !~ '^\\+92(3[0-4][0-9])\\d{7}$'
    `);

    await knex.raw(`
        UPDATE customers SET phone_number_alt = NULL
        WHERE phone_number_alt IS NOT NULL 
        AND phone_number_alt !~ '^\\+92(3[0-4][0-9])\\d{7}$'
    `);

    await knex.raw(`
        UPDATE suppliers SET phone_number = NULL
        WHERE phone_number IS NOT NULL 
        AND phone_number !~ '^\\+92(3[0-4][0-9])\\d{7}$'
    `);

    await knex.raw(`
        UPDATE suppliers SET phone_number_alt = NULL
        WHERE phone_number_alt IS NOT NULL 
        AND phone_number_alt !~ '^\\+92(3[0-4][0-9])\\d{7}$'
    `);

    // Step 2: Add CHECK constraints — strict Pakistani mobile: +92 3[0-4]X 7digits
    await knex.raw(`
        ALTER TABLE users
        ADD CONSTRAINT users_phone_format
        CHECK (phone_number IS NULL OR phone_number ~ '^\\+92(3[0-4][0-9])\\d{7}$')
    `);
    
    await knex.raw(`
        ALTER TABLE customers
        ADD CONSTRAINT customers_phone_format
        CHECK (phone_number IS NULL OR phone_number ~ '^\\+92(3[0-4][0-9])\\d{7}$')
    `);
    
    await knex.raw(`
        ALTER TABLE customers
        ADD CONSTRAINT customers_phone_alt_format
        CHECK (phone_number_alt IS NULL OR phone_number_alt ~ '^\\+92(3[0-4][0-9])\\d{7}$')
    `);
    
    await knex.raw(`
        ALTER TABLE suppliers
        ADD CONSTRAINT suppliers_phone_format
        CHECK (phone_number IS NULL OR phone_number ~ '^\\+92(3[0-4][0-9])\\d{7}$')
    `);
    
    await knex.raw(`
        ALTER TABLE suppliers
        ADD CONSTRAINT suppliers_phone_alt_format
        CHECK (phone_number_alt IS NULL OR phone_number_alt ~ '^\\+92(3[0-4][0-9])\\d{7}$')
    `);
};

exports.down = async function(knex) {
    await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_format`);
    await knex.raw(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_format`);
    await knex.raw(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_alt_format`);
    await knex.raw(`ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_phone_format`);
    await knex.raw(`ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_phone_alt_format`);
};
