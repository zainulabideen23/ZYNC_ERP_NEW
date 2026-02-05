/**
 * Migration: Fix sales table to support customer overpayment (change return)
 * - Add return_to_customer column for tracking change/overpayment
 * - Modify constraints to allow proper amount handling
 */

exports.up = async function (knex) {
    // 1. Add return_to_customer column if it doesn't exist
    const hasColumn = await knex.schema.hasColumn('sales', 'return_to_customer');
    if (!hasColumn) {
        await knex.schema.alterTable('sales', (table) => {
            table.decimal('return_to_customer', 15, 2).notNullable().defaultTo(0);
        });
    }

    // 2. Drop the problematic constraint that enforces amount_due = total_amount - amount_paid
    // This causes issues when customer overpays (amount_due would be negative)
    await knex.raw(`
        DO $$
        DECLARE
            constraint_rec RECORD;
        BEGIN
            FOR constraint_rec IN
                SELECT conname
                FROM pg_constraint c
                JOIN pg_namespace n ON n.oid = c.connamespace
                WHERE conrelid = 'sales'::regclass
                AND pg_get_constraintdef(c.oid) LIKE '%amount_due = total_amount - amount_paid%'
            LOOP
                EXECUTE 'ALTER TABLE sales DROP CONSTRAINT IF EXISTS ' || constraint_rec.conname;
            END LOOP;
        END $$;
    `);

    // 3. Ensure amount_due >= 0 constraint exists
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conrelid = 'sales'::regclass 
                AND conname = 'sales_amount_due_non_negative'
            ) THEN
                ALTER TABLE sales ADD CONSTRAINT sales_amount_due_non_negative CHECK (amount_due >= 0);
            END IF;
        EXCEPTION WHEN duplicate_object THEN
            -- Constraint already exists, ignore
        END $$;
    `);

    // 4. Add constraint for return_to_customer >= 0
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conrelid = 'sales'::regclass 
                AND conname = 'sales_return_to_customer_non_negative'
            ) THEN
                ALTER TABLE sales ADD CONSTRAINT sales_return_to_customer_non_negative CHECK (return_to_customer >= 0);
            END IF;
        EXCEPTION WHEN duplicate_object THEN
            -- Constraint already exists, ignore
        END $$;
    `);

    console.log('✓ Migration: Fixed sales table for overpayment handling');
};

exports.down = async function (knex) {
    // Remove the column and constraints
    await knex.raw(`
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_return_to_customer_non_negative;
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_amount_due_non_negative;
    `);
    
    const hasColumn = await knex.schema.hasColumn('sales', 'return_to_customer');
    if (hasColumn) {
        await knex.schema.alterTable('sales', (table) => {
            table.dropColumn('return_to_customer');
        });
    }
};
