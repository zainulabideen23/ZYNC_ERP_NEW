exports.up = async function up(knex) {
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'loan';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'loan_received';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'loan_payment';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'year_close';
            END IF;
        END $$;
    `);

    const tenants = await knex('tenants').where('is_active', true).select('id');

    for (const tenant of tenants) {
        const tenantId = tenant.id;

        let bankLoansGroup = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '2100' })
            .first();

        if (!bankLoansGroup) {
            const [createdGroup] = await knex('account_groups').insert({
                tenant_id: tenantId,
                account_type: 'liability',
                code: '2100',
                name: 'Bank Loans',
                description: 'Long-term bank loans and credit facilities',
                sequence_order: 60,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
            }).returning('*');
            bankLoansGroup = createdGroup;
        }

        let equityGroup = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '3000' })
            .first();

        if (!equityGroup) {
            const [createdGroup] = await knex('account_groups').insert({
                tenant_id: tenantId,
                account_type: 'equity',
                code: '3000',
                name: 'Equity',
                description: 'Owner investment and retained earnings',
                sequence_order: 70,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
            }).returning('*');
            equityGroup = createdGroup;
        }

        const operatingExpensesGroup = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '6000' })
            .first();

        const requiredAccounts = [
            { code: '2100', name: 'Bank Loans', account_type: 'liability', group_id: bankLoansGroup.id },
            { code: '3001', name: 'Owner Capital', account_type: 'equity', group_id: equityGroup.id },
            { code: '3002', name: 'Retained Earnings', account_type: 'equity', group_id: equityGroup.id },
            { code: '3003', name: 'Owner Drawings', account_type: 'equity', group_id: equityGroup.id },
            operatingExpensesGroup && {
                code: '6003',
                name: 'Interest Expense',
                account_type: 'expense',
                group_id: operatingExpensesGroup.id,
            },
        ].filter(Boolean);

        for (const account of requiredAccounts) {
            const existing = await knex('accounts')
                .where({ tenant_id: tenantId, code: account.code })
                .first();

            if (existing) {
                await knex('accounts')
                    .where({ id: existing.id })
                    .update({
                        name: account.name,
                        account_type: account.account_type,
                        group_id: account.group_id,
                        is_system: true,
                        is_active: true,
                        updated_at: knex.fn.now(),
                    });
                continue;
            }

            await knex('accounts').insert({
                tenant_id: tenantId,
                code: account.code,
                name: account.name,
                account_type: account.account_type,
                group_id: account.group_id,
                opening_balance: 0,
                current_balance: 0,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
            });
        }
    }

    if (await knex.schema.hasTable('loan_payments')) {
        const hasUpdatedAt = await knex.schema.hasColumn('loan_payments', 'updated_at');
        if (!hasUpdatedAt) {
            await knex.schema.table('loan_payments', (table) => {
                table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
            });
        }
    }

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS loans_tenant_status_idx
            ON loans(tenant_id, status)
            WHERE is_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS loans_tenant_reference_active_uq
            ON loans(tenant_id, loan_reference)
            WHERE is_deleted = false;

        CREATE INDEX IF NOT EXISTS loan_payments_tenant_loan_date_idx
            ON loan_payments(tenant_id, loan_id, payment_date);
    `);

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loans_tenant_fk'
            ) THEN
                ALTER TABLE loans
                    ADD CONSTRAINT loans_tenant_fk
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loans_created_by_fk'
            ) THEN
                ALTER TABLE loans
                    ADD CONSTRAINT loans_created_by_fk
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_tenant_fk'
            ) THEN
                ALTER TABLE loan_payments
                    ADD CONSTRAINT loan_payments_tenant_fk
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_loan_fk'
            ) THEN
                ALTER TABLE loan_payments
                    ADD CONSTRAINT loan_payments_loan_fk
                    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_created_by_fk'
            ) THEN
                ALTER TABLE loan_payments
                    ADD CONSTRAINT loan_payments_created_by_fk
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loans_principal_positive_chk'
            ) THEN
                ALTER TABLE loans
                    ADD CONSTRAINT loans_principal_positive_chk CHECK (principal_amount > 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loans_interest_non_negative_chk'
            ) THEN
                ALTER TABLE loans
                    ADD CONSTRAINT loans_interest_non_negative_chk CHECK (interest_rate >= 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_principal_non_negative_chk'
            ) THEN
                ALTER TABLE loan_payments
                    ADD CONSTRAINT loan_payments_principal_non_negative_chk CHECK (principal_paid >= 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_interest_non_negative_chk'
            ) THEN
                ALTER TABLE loan_payments
                    ADD CONSTRAINT loan_payments_interest_non_negative_chk CHECK (interest_paid >= 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_total_positive_chk'
            ) THEN
                ALTER TABLE loan_payments
                    ADD CONSTRAINT loan_payments_total_positive_chk CHECK (total_payment > 0);
            END IF;
        END $$;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS loan_payments_tenant_loan_date_idx;');
    await knex.raw('DROP INDEX IF EXISTS loans_tenant_reference_active_uq;');
    await knex.raw('DROP INDEX IF EXISTS loans_tenant_status_idx;');
};
