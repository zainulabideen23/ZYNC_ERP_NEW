/**
 * Migration: Drop the sales_check1 constraint that prevents overpayment
 * This constraint enforces amount_due = total_amount - amount_paid
 * which fails when customer overpays (amount_due should be 0, not negative)
 */

exports.up = async function (knex) {
    console.log('Dropping sales check constraints that prevent overpayment...');
    
    // 1. Drop sales_check1 explicitly (this is the auto-named constraint)
    await knex.raw(`
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_check1;
    `);
    
    // 2. Drop any constraint that contains the problematic formula
    // This handles different naming conventions
    await knex.raw(`
        DO $$
        DECLARE
            constraint_rec RECORD;
        BEGIN
            FOR constraint_rec IN
                SELECT c.conname
                FROM pg_constraint c
                JOIN pg_namespace n ON n.oid = c.connamespace
                WHERE conrelid = 'sales'::regclass
                AND contype = 'c'
                AND (
                    pg_get_constraintdef(c.oid) ILIKE '%amount_due%=%total_amount%-%amount_paid%'
                    OR pg_get_constraintdef(c.oid) ILIKE '%amount_due =%'
                )
            LOOP
                RAISE NOTICE 'Dropping constraint: %', constraint_rec.conname;
                EXECUTE 'ALTER TABLE sales DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_rec.conname);
            END LOOP;
        END $$;
    `);
    
    // 3. Also drop sales_check (in case it exists with that name)
    await knex.raw(`
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_check;
    `);
    
    // 4. Ensure the return_to_customer column exists
    const hasColumn = await knex.schema.hasColumn('sales', 'return_to_customer');
    if (!hasColumn) {
        await knex.schema.alterTable('sales', (table) => {
            table.decimal('return_to_customer', 15, 2).notNullable().defaultTo(0);
        });
        console.log('Added return_to_customer column');
    }
    
    // 5. Ensure amount_due >= 0 constraint exists
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
            NULL;
        END $$;
    `);
    
    // 6. Ensure return_to_customer >= 0 constraint exists
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
            NULL;
        END $$;
    `);
    
    console.log('✓ Sales table overpayment constraints fixed');
};

exports.down = async function (knex) {
    // We don't want to restore the broken constraint
    console.log('Down migration: Not restoring the problematic constraint');
};
