/**
 * Purchase Engine Balance Fixes
 *
 * - Ensures Purchase Discount account (5003) exists for every tenant.
 * - Backfills missing opening-balance journals for legacy suppliers.
 */

const CURRENCY_TOLERANCE = 0.01;
const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

async function getTenantIds(knex) {
    const hasTenants = await knex.schema.hasTable('tenants');
    if (hasTenants) {
        const tenants = await knex('tenants').select('id');
        return tenants.map((row) => row.id);
    }

    const accounts = await knex('accounts').whereNotNull('tenant_id').distinct('tenant_id');
    return accounts.map((row) => row.tenant_id);
}

async function resolveExpenseGroup(knex, tenantId) {
    let group = await knex('account_groups')
        .where({ tenant_id: tenantId, code: '5000' })
        .first();

    if (!group) {
        group = await knex('account_groups')
            .where({ tenant_id: tenantId, account_type: 'expense' })
            .whereILike('name', '%cost%')
            .first();
    }

    if (!group) {
        group = await knex('account_groups')
            .where({ tenant_id: tenantId, account_type: 'expense' })
            .first();
    }

    return group || null;
}

async function ensurePurchaseDiscountAccount(knex, tenantId) {
    const existing = await knex('accounts')
        .where({ tenant_id: tenantId, code: '5003' })
        .first();

    if (existing) {
        await knex('accounts')
            .where({ id: existing.id, tenant_id: tenantId })
            .update({
                name: existing.name || 'Purchase Discount',
                account_type: existing.account_type || 'expense',
                is_active: true,
                is_system: true,
                updated_at: knex.fn.now(),
            });
        return existing.id;
    }

    const expenseGroup = await resolveExpenseGroup(knex, tenantId);
    if (!expenseGroup) {
        return null;
    }

    const [created] = await knex('accounts').insert({
        tenant_id: tenantId,
        code: '5003',
        name: 'Purchase Discount',
        account_type: 'expense',
        group_id: expenseGroup.id,
        opening_balance: 0,
        current_balance: 0,
        is_system: true,
        is_active: true,
        created_at: knex.fn.now(),
    }).returning('id');

    return created.id;
}

async function resolveOpeningOffsetAccountId(knex, tenantId) {
    const ownerCapital = await knex('accounts')
        .where({ tenant_id: tenantId, code: '3001', is_active: true })
        .first('id');

    if (ownerCapital) {
        return ownerCapital.id;
    }

    const retained = await knex('accounts')
        .where({ tenant_id: tenantId, code: '3002', is_active: true })
        .first('id');

    if (!retained) {
        throw new Error(`Opening offset account not found for tenant ${tenantId}`);
    }

    return retained.id;
}

async function nextJournalNumber(trx, tenantId) {
    let sequence = await trx('sequences')
        .where({ tenant_id: tenantId, name: 'journal' })
        .forUpdate()
        .first();

    if (!sequence) {
        await trx('sequences').insert({
            tenant_id: tenantId,
            name: 'journal',
            prefix: 'JRN-',
            current_value: 0,
            pad_length: 6,
            is_active: true,
            description: 'Journal Numbering',
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
        });

        sequence = await trx('sequences')
            .where({ tenant_id: tenantId, name: 'journal' })
            .forUpdate()
            .first();

        if (!sequence) {
            throw new Error(`Journal sequence not configured for tenant ${tenantId}`);
        }
    }

    const nextValue = Number(sequence.current_value || 0) + 1;
    const prefix = sequence.prefix || 'JRN-';
    const padLength = sequence.pad_length || 6;

    await trx('sequences')
        .where({ tenant_id: tenantId, name: 'journal' })
        .update({ current_value: nextValue });

    return `${prefix}${String(nextValue).padStart(padLength, '0')}`;
}

async function recomputeAccountBalance(trx, tenantId, accountId) {
    const account = await trx('accounts')
        .where({ id: accountId, tenant_id: tenantId })
        .first('id', 'account_type', 'opening_balance');

    if (!account) return;

    const totals = await trx('ledger_entries as le')
        .join('journals as j', 'le.journal_id', 'j.id')
        .where('le.tenant_id', tenantId)
        .where('j.tenant_id', tenantId)
        .where('le.account_id', accountId)
        .first(
            trx.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS debit_total"),
            trx.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS credit_total")
        );

    const opening = Number(account.opening_balance || 0);
    const debitTotal = Number(totals?.debit_total || 0);
    const creditTotal = Number(totals?.credit_total || 0);

    const computed = ['asset', 'expense'].includes(account.account_type)
        ? roundCurrency(opening + debitTotal - creditTotal)
        : roundCurrency(opening + creditTotal - debitTotal);

    await trx('accounts')
        .where({ id: accountId, tenant_id: tenantId })
        .update({
            current_balance: computed,
            updated_at: trx.fn.now(),
        });
}

async function backfillSupplierOpeningJournals(knex, tenantId) {
    const suppliers = await knex('suppliers as s')
        .where('s.tenant_id', tenantId)
        .whereRaw('COALESCE(s.opening_balance, 0) > ?', [CURRENCY_TOLERANCE])
        .whereNotExists(
            knex('journals as j')
                .select(1)
                .whereRaw('j.tenant_id = s.tenant_id')
                .whereRaw('j.reference_id = s.id')
                .where('j.reference_type', 'opening')
        )
        .select('s.id', 's.code', 's.name', 's.account_id', 's.opening_balance', 's.created_by', 's.created_at');

    if (suppliers.length === 0) return;

    await knex.transaction(async (trx) => {
        const touchedAccounts = new Set();
        const offsetAccountId = await resolveOpeningOffsetAccountId(trx, tenantId);

        for (const supplier of suppliers) {
            const openingAmount = roundCurrency(supplier.opening_balance);
            if (!Number.isFinite(openingAmount) || openingAmount <= CURRENCY_TOLERANCE) {
                continue;
            }
            if (!supplier.account_id) {
                continue;
            }

            const journalNumber = await nextJournalNumber(trx, tenantId);
            const journalDate = supplier.created_at
                ? new Date(supplier.created_at).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10);

            const [journal] = await trx('journals').insert({
                tenant_id: tenantId,
                journal_number: journalNumber,
                journal_date: journalDate,
                reference_type: 'opening',
                reference_id: supplier.id,
                description: `Opening Balance - Supplier ${supplier.code || supplier.name}`,
                total_debit: openingAmount,
                total_credit: openingAmount,
                is_balanced: true,
                created_by: supplier.created_by || null,
                created_at: supplier.created_at || trx.fn.now(),
            }).returning('id');

            await trx('ledger_entries').insert([
                {
                    tenant_id: tenantId,
                    journal_id: journal.id,
                    account_id: offsetAccountId,
                    entry_type: 'debit',
                    amount: openingAmount,
                    description: `Supplier opening offset ${supplier.name}`,
                    created_by: supplier.created_by || null,
                    created_at: supplier.created_at || trx.fn.now(),
                },
                {
                    tenant_id: tenantId,
                    journal_id: journal.id,
                    account_id: supplier.account_id,
                    entry_type: 'credit',
                    amount: openingAmount,
                    description: `Supplier opening payable ${supplier.name}`,
                    created_by: supplier.created_by || null,
                    created_at: supplier.created_at || trx.fn.now(),
                },
            ]);

            touchedAccounts.add(offsetAccountId);
            touchedAccounts.add(supplier.account_id);
        }

        for (const accountId of touchedAccounts) {
            await recomputeAccountBalance(trx, tenantId, accountId);
        }
    });
}

exports.up = async function up(knex) {
    const tenantIds = await getTenantIds(knex);

    for (const tenantId of tenantIds) {
        await ensurePurchaseDiscountAccount(knex, tenantId);
        await backfillSupplierOpeningJournals(knex, tenantId);
    }
};

exports.down = async function down(knex) {
    await knex('accounts')
        .where({ code: '5003' })
        .update({
            is_active: false,
            updated_at: knex.fn.now(),
        });

    // Opening-balance journals are audit records and are intentionally not removed.
};
