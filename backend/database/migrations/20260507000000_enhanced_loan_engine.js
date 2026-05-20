exports.up = async function up(knex) {
    // Add missing columns to loans table using raw SQL
    const loansColumns = await knex.raw(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'loans' AND table_schema = 'public'
    `);
    const existingLoanCols = loansColumns.rows.map(r => r.column_name);

    if (!existingLoanCols.includes('purpose')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN purpose VARCHAR(255)`);
    }
    if (!existingLoanCols.includes('interest_type')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN interest_type VARCHAR(255) DEFAULT 'fixed'`);
    }
    if (!existingLoanCols.includes('base_rate')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN base_rate DECIMAL(7,3)`);
    }
    if (!existingLoanCols.includes('margin')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN margin DECIMAL(5,2)`);
    }
    if (!existingLoanCols.includes('payment_frequency')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN payment_frequency VARCHAR(255) DEFAULT 'monthly'`);
    }
    if (!existingLoanCols.includes('collateral_details')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN collateral_details TEXT`);
    }
    if (!existingLoanCols.includes('original_emi')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN original_emi DECIMAL(15,2)`);
    }
    if (!existingLoanCols.includes('next_payment_date')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN next_payment_date DATE`);
    }
    if (!existingLoanCols.includes('overdue_amount')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN overdue_amount DECIMAL(15,2) DEFAULT 0`);
    }
    if (!existingLoanCols.includes('overdue_days')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN overdue_days INTEGER DEFAULT 0`);
    }
    if (!existingLoanCols.includes('grace_period_type')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN grace_period_type VARCHAR(50) DEFAULT 'none'`);
    }
    if (!existingLoanCols.includes('grace_period_months')) {
        await knex.raw(`ALTER TABLE loans ADD COLUMN grace_period_months INTEGER DEFAULT 0`);
    }

    // Add missing columns to loan_payments
    const paymentColumns = await knex.raw(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'loan_payments' AND table_schema = 'public'
    `);
    const existingPaymentCols = paymentColumns.rows.map(r => r.column_name);

    if (!existingPaymentCols.includes('payment_status')) {
        await knex.raw(`ALTER TABLE loan_payments ADD COLUMN payment_status VARCHAR(20) DEFAULT 'on_time'`);
    }
    if (!existingPaymentCols.includes('late_penalty')) {
        await knex.raw(`ALTER TABLE loan_payments ADD COLUMN late_penalty DECIMAL(15,2) DEFAULT 0`);
    }
    if (!existingPaymentCols.includes('settlement_type')) {
        await knex.raw(`ALTER TABLE loan_payments ADD COLUMN settlement_type VARCHAR(20) DEFAULT 'regular'`);
    }
    if (!existingPaymentCols.includes('prepayment_amount')) {
        await knex.raw(`ALTER TABLE loan_payments ADD COLUMN prepayment_amount DECIMAL(15,2) DEFAULT 0`);
    }

    // Create loan_rate_history table
    const hasRateHistoryTable = await knex.schema.hasTable('loan_rate_history');
    if (!hasRateHistoryTable) {
        await knex.schema.createTable('loan_rate_history', (table) => {
            table.increments('id').primary();
            table.uuid('loan_id').notNullable();
            table.uuid('tenant_id').notNullable();
            table.date('effective_from').notNullable();
            table.string('rate_type');
            table.decimal('base_rate', 7, 3);
            table.decimal('margin', 5, 2);
            table.decimal('effective_rate', 7, 3);
            table.integer('created_by').unsigned();
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        });
        
        await knex.raw(`CREATE INDEX IF NOT EXISTS loan_rate_history_loan_idx ON loan_rate_history(loan_id)`);
    }

    console.log('✓ Migration completed successfully');
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('loan_rate_history');
};