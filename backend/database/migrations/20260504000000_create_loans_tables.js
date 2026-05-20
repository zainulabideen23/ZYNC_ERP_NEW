exports.up = async function up(knex) {
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'loan';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'loan_received';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'loan_payment';
            END IF;
        END $$;
    `);

    const hasLoans = await knex.schema.hasTable('loans');
    const hasLoanPayments = await knex.schema.hasTable('loan_payments');

    if (!hasLoans) {
        await knex.schema.createTable('loans', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
            table.string('loan_reference').notNullable();
            table.string('bank_name').notNullable();
            table.string('loan_type').defaultTo('business');
            table.decimal('principal_amount', 15, 2).notNullable();
            table.decimal('interest_rate', 5, 2).defaultTo(0);
            table.date('start_date').notNullable();
            table.date('end_date');
            table.decimal('emi_amount', 15, 2);
            table.string('repayment_type').defaultTo('emi');
            table.text('notes');
            table.string('status').defaultTo('active');
            table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
            table.boolean('is_deleted').defaultTo(false);
            table.timestamps(true, true);

            table.check('principal_amount > 0', [], 'loans_principal_positive_chk');
            table.check('interest_rate >= 0', [], 'loans_interest_non_negative_chk');
            table.check("status IN ('active', 'paid_off', 'defaulted')", [], 'loans_status_chk');
            table.unique(['tenant_id', 'loan_reference'], { indexName: 'loans_tenant_reference_uq' });
            table.index(['tenant_id', 'status'], 'loans_tenant_status_idx');
        });
    }

    if (!hasLoanPayments) {
        await knex.schema.createTable('loan_payments', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
            table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
            table.date('payment_date').notNullable();
            table.string('payment_type').defaultTo('emi');
            table.decimal('principal_paid', 15, 2).notNullable().defaultTo(0);
            table.decimal('interest_paid', 15, 2).notNullable().defaultTo(0);
            table.decimal('total_payment', 15, 2).notNullable();
            table.string('payment_method').defaultTo('bank_transfer');
            table.string('reference_number');
            table.text('notes');
            table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
            table.timestamps(true, true);

            table.check('principal_paid >= 0', [], 'loan_payments_principal_non_negative_chk');
            table.check('interest_paid >= 0', [], 'loan_payments_interest_non_negative_chk');
            table.check('total_payment > 0', [], 'loan_payments_total_positive_chk');
            table.index(['tenant_id', 'loan_id', 'payment_date'], 'loan_payments_tenant_loan_date_idx');
        });
    }
};

exports.down = function down(knex) {
    return knex.schema
        .dropTableIfExists('loan_payments')
        .dropTableIfExists('loans');
};
