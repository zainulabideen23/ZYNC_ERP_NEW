/**
 * Migration: Drop the purchases_check1 constraint that prevents overpayment
 * This constraint enforces amount_due = total_amount - amount_paid
 * which fails when supplier is overpaid (amount_due should be 0, not negative)
 */

exports.up = async function (knex) {
    console.log('Dropping purchases check constraints that prevent overpayment...');
    
    // 1. Drop purchases_check1 explicitly (this is the auto-named constraint)
    await knex.raw(`
        ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_check1;
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
                WHERE conrelid = 'purchases'::regclass
                AND contype = 'c'
                AND (
                    pg_get_constraintdef(c.oid) ILIKE '%amount_due%=%total_amount%-%amount_paid%'
                    OR pg_get_constraintdef(c.oid) ILIKE '%amount_due =%'
                )
            LOOP
                RAISE NOTICE 'Dropping constraint: %', constraint_rec.conname;
                EXECUTE 'ALTER TABLE purchases DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_rec.conname);
            END LOOP;
        END $$;
    `);
    
    // 3. Also drop purchases_check (in case it exists with that name)
    await knex.raw(`
        ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_check;
    `);

    console.log('Successfully dropped purchases check constraints');
};

exports.down = async function (knex) {
    // Re-add the constraint (though it limits functionality)
    await knex.raw(`
        ALTER TABLE purchases ADD CONSTRAINT purchases_amount_due_formula 
        CHECK (amount_due = total_amount - amount_paid);
    `);
};
