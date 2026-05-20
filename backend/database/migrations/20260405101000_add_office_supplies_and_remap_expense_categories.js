/**
 * Ensure operating expense mappings are complete per tenant.
 *
 * - Ensures account 6004 exists (used for Transportation mapping).
 * - Ensures account 6005 exists (Office Supplies).
 * - Remaps Transportation -> 6004 and Office Supplies -> 6005 categories.
 */

async function ensureAccount(knex, tenantId, { code, name, groupId }) {
    const existing = await knex('accounts')
        .where({ tenant_id: tenantId, code })
        .first();

    if (existing) {
        return existing;
    }

    const [created] = await knex('accounts')
        .insert({
            tenant_id: tenantId,
            code,
            name,
            account_type: 'expense',
            group_id: groupId,
            opening_balance: 0,
            current_balance: 0,
            is_system: true,
            is_active: true,
            created_at: knex.fn.now(),
        })
        .returning('*');

    return created;
}

async function upsertCategory(knex, tenantId, categoryName, accountId) {
    const existing = await knex('expense_categories')
        .where('tenant_id', tenantId)
        .whereRaw('LOWER(name) = LOWER(?)', [categoryName])
        .first();

    if (existing) {
        await knex('expense_categories')
            .where({ id: existing.id, tenant_id: tenantId })
            .update({ account_id: accountId, is_active: true });
        return;
    }

    await knex('expense_categories').insert({
        tenant_id: tenantId,
        name: categoryName,
        account_id: accountId,
        is_active: true,
        created_at: knex.fn.now(),
    });
}

exports.up = async function up(knex) {
    const tenants = await knex('tenants').select('id');

    for (const tenant of tenants) {
        const tenantId = tenant.id;

        const opexGroup = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '6000' })
            .first();

        if (!opexGroup) {
            continue;
        }

        const account6004 = await ensureAccount(knex, tenantId, {
            code: '6004',
            name: 'Transportation Expense',
            groupId: opexGroup.id,
        });

        const account6005 = await ensureAccount(knex, tenantId, {
            code: '6005',
            name: 'Office Supplies',
            groupId: opexGroup.id,
        });

        await upsertCategory(knex, tenantId, 'Transportation', account6004.id);
        await upsertCategory(knex, tenantId, 'Office Supplies', account6005.id);

        await knex('expense_categories')
            .where('tenant_id', tenantId)
            .whereRaw('LOWER(name) IN (?, ?, ?)', ['transport', 'transportation', 'travel'])
            .update({ account_id: account6004.id, is_active: true });

        await knex('expense_categories')
            .where('tenant_id', tenantId)
            .whereRaw('LOWER(name) IN (?, ?, ?)', ['office supplies', 'office supply', 'stationery'])
            .update({ account_id: account6005.id, is_active: true });
    }
};

exports.down = async function down(knex) {
    await knex('accounts')
        .where('code', '6005')
        .update({ is_active: false, updated_at: knex.fn.now() });
};
