/**
 * Add missing accounting control accounts used by purchase postings.
 * - 1202 Supplier Advances (asset)
 * - 1203 Input Tax Receivable (asset)
 */

exports.up = async function (knex) {
    const tenants = await knex('tenants').select('id');

    for (const tenant of tenants) {
        const tenantId = tenant.id;

        const receivablesGroup = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '1200' })
            .first();

        if (!receivablesGroup) {
            continue;
        }

        const definitions = [
            { code: '1202', name: 'Supplier Advances' },
            { code: '1203', name: 'Input Tax Receivable' }
        ];

        for (const definition of definitions) {
            const exists = await knex('accounts')
                .where({ tenant_id: tenantId, code: definition.code })
                .first();

            if (exists) {
                continue;
            }

            await knex('accounts').insert({
                tenant_id: tenantId,
                code: definition.code,
                name: definition.name,
                group_id: receivablesGroup.id,
                account_type: 'asset',
                opening_balance: 0,
                current_balance: 0,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
            });
        }
    }
};

exports.down = async function (knex) {
    await knex('accounts')
        .whereIn('code', ['1202', '1203'])
        .update({
            is_active: false,
            updated_at: knex.fn.now(),
        });
};
