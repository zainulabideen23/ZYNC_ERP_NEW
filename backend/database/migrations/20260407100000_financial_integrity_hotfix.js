/**
 * Financial Integrity Hotfix
 *
 * - Creates payment_applications table for deterministic allocation tracking.
 * - Ensures required sequences exist for every tenant.
 * - Ensures control accounts 1202/1203 exist for every tenant.
 * - Ensures transaction_type enum includes bank_transfer.
 * - Replaces account balance integrity function with account-type-aware, tenant-scoped logic.
 */

const REQUIRED_SEQUENCES = [
    { name: 'payment', prefix: 'PAY-', current_value: 0, pad_length: 6, is_active: true, description: 'Payment Numbering' },
    { name: 'stock_adjustment', prefix: 'ADJ-', current_value: 0, pad_length: 6, is_active: true, description: 'Stock Adjustment Numbering' },
    { name: 'sale_return', prefix: 'SRN-', current_value: 0, pad_length: 6, is_active: true, description: 'Sale Return Numbering' },
    { name: 'purchase_return', prefix: 'PRN-', current_value: 0, pad_length: 6, is_active: true, description: 'Purchase Return Numbering' },
];

async function getTenantIds(knex) {
    const hasTenantsTable = await knex.schema.hasTable('tenants');
    if (hasTenantsTable) {
        const rows = await knex('tenants').select('id');
        return rows.map((row) => row.id);
    }

    const rows = await knex('accounts')
        .whereNotNull('tenant_id')
        .distinct('tenant_id');
    return rows.map((row) => row.tenant_id);
}

async function ensureSequences(knex, tenantId) {
    for (const seq of REQUIRED_SEQUENCES) {
        const exists = await knex('sequences')
            .where({ tenant_id: tenantId, name: seq.name })
            .first();

        if (!exists) {
            await knex('sequences').insert({
                tenant_id: tenantId,
                ...seq,
            });
        }
    }
}

async function findReceivablesGroup(knex, tenantId) {
    const hasCodeColumn = await knex.schema.hasColumn('account_groups', 'code');
    if (hasCodeColumn) {
        const byCode = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '1200' })
            .first();
        if (byCode) return byCode;
    }

    const byName = await knex('account_groups')
        .where({ tenant_id: tenantId, account_type: 'asset' })
        .whereRaw('LOWER(name) LIKE ?', ['%receivable%'])
        .first();

    return byName || null;
}

async function ensureControlAccounts(knex, tenantId) {
    const receivablesGroup = await findReceivablesGroup(knex, tenantId);
    if (!receivablesGroup) return;

    const requiredAccounts = [
        { code: '1202', name: 'Supplier Advances', account_type: 'asset' },
        { code: '1203', name: 'Input Tax Receivable', account_type: 'asset' },
    ];

    for (const account of requiredAccounts) {
        const exists = await knex('accounts')
            .where({ tenant_id: tenantId, code: account.code })
            .first();

        if (!exists) {
            await knex('accounts').insert({
                tenant_id: tenantId,
                code: account.code,
                name: account.name,
                account_type: account.account_type,
                group_id: receivablesGroup.id,
                opening_balance: 0,
                current_balance: 0,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
            });
        }
    }
}

exports.up = async function up(knex) {
    // 1) Add bank_transfer enum value (idempotent)
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bank_transfer';
            END IF;
        END;
        $$;
    `);

    // 2) Create payment applications table if missing
    const hasPaymentApplications = await knex.schema.hasTable('payment_applications');
    if (!hasPaymentApplications) {
        await knex.schema.createTable('payment_applications', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
            table.uuid('payment_id').notNullable().references('id').inTable('payments').onDelete('CASCADE');
            table.uuid('sale_id').nullable().references('id').inTable('sales').onDelete('CASCADE');
            table.uuid('purchase_id').nullable().references('id').inTable('purchases').onDelete('CASCADE');
            table.decimal('applied_amount', 15, 2).notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');

            table.index(['tenant_id', 'payment_id'], 'idx_payment_applications_tenant_payment');
            table.index(['tenant_id', 'sale_id'], 'idx_payment_applications_tenant_sale');
            table.index(['tenant_id', 'purchase_id'], 'idx_payment_applications_tenant_purchase');
        });

        await knex.raw(`
            ALTER TABLE payment_applications
            ADD CONSTRAINT chk_payment_applications_amount_positive
            CHECK (applied_amount > 0);
        `);

        await knex.raw(`
            ALTER TABLE payment_applications
            ADD CONSTRAINT chk_payment_applications_target
            CHECK (
                (sale_id IS NOT NULL AND purchase_id IS NULL)
                OR
                (sale_id IS NULL AND purchase_id IS NOT NULL)
            );
        `);

        await knex.raw(`
            CREATE UNIQUE INDEX uq_payment_applications_payment_sale
            ON payment_applications(payment_id, sale_id)
            WHERE sale_id IS NOT NULL;
        `);

        await knex.raw(`
            CREATE UNIQUE INDEX uq_payment_applications_payment_purchase
            ON payment_applications(payment_id, purchase_id)
            WHERE purchase_id IS NOT NULL;
        `);
    }

    // 3) Ensure per-tenant sequence/account compatibility
    const tenantIds = await getTenantIds(knex);
    for (const tenantId of tenantIds) {
        await ensureSequences(knex, tenantId);
        await ensureControlAccounts(knex, tenantId);
    }

    // 4) Replace balance integrity function with account-type-aware + tenant-scoped version
    await knex.raw('DROP FUNCTION IF EXISTS check_account_balance_integrity();');

    await knex.raw(`
        CREATE OR REPLACE FUNCTION check_account_balance_integrity(p_tenant_id UUID DEFAULT NULL)
        RETURNS TABLE(
            account_id UUID,
            tenant_id UUID,
            account_name VARCHAR,
            stored_balance DECIMAL,
            computed_balance DECIMAL,
            difference DECIMAL
        ) AS $$
            WITH ledger_totals AS (
                SELECT
                    le.account_id,
                    le.tenant_id,
                    COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS debit_total,
                    COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS credit_total
                FROM ledger_entries le
                GROUP BY le.account_id, le.tenant_id
            )
            SELECT
                a.id AS account_id,
                a.tenant_id,
                a.name AS account_name,
                a.current_balance AS stored_balance,
                CASE
                    WHEN a.account_type IN ('asset', 'expense')
                        THEN a.opening_balance + COALESCE(lt.debit_total, 0) - COALESCE(lt.credit_total, 0)
                    ELSE a.opening_balance + COALESCE(lt.credit_total, 0) - COALESCE(lt.debit_total, 0)
                END AS computed_balance,
                a.current_balance - (
                    CASE
                        WHEN a.account_type IN ('asset', 'expense')
                            THEN a.opening_balance + COALESCE(lt.debit_total, 0) - COALESCE(lt.credit_total, 0)
                        ELSE a.opening_balance + COALESCE(lt.credit_total, 0) - COALESCE(lt.debit_total, 0)
                    END
                ) AS difference
            FROM accounts a
            LEFT JOIN ledger_totals lt
                ON lt.account_id = a.id
               AND lt.tenant_id = a.tenant_id
            WHERE (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
              AND ABS(
                    a.current_balance - (
                        CASE
                            WHEN a.account_type IN ('asset', 'expense')
                                THEN a.opening_balance + COALESCE(lt.debit_total, 0) - COALESCE(lt.credit_total, 0)
                            ELSE a.opening_balance + COALESCE(lt.credit_total, 0) - COALESCE(lt.debit_total, 0)
                        END
                    )
                  ) > 0.01
            ORDER BY a.tenant_id, a.code;
        $$ LANGUAGE sql;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP FUNCTION IF EXISTS check_account_balance_integrity(UUID);');
    await knex.raw('DROP FUNCTION IF EXISTS check_account_balance_integrity();');

    const hasPaymentApplications = await knex.schema.hasTable('payment_applications');
    if (hasPaymentApplications) {
        await knex.schema.dropTable('payment_applications');
    }
};
