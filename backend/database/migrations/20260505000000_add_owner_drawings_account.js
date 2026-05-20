exports.up = async function up(knex) {
    const tenants = await knex('accounts').distinct('tenant_id').pluck('tenant_id');

    for (const tenantId of tenants) {
        const equityGroup = await knex('account_groups')
            .where({ tenant_id: tenantId, code: '3000' })
            .first();

        if (!equityGroup) {
            console.log(`Equity group (3000) not found for tenant ${tenantId}, skipping`);
            continue;
        }

        const existing = await knex('accounts')
            .where({ tenant_id: tenantId, code: '3003' })
            .first();

        if (existing) {
            await knex('accounts')
                .where({ id: existing.id })
                .update({
                    name: existing.name || 'Owner Drawings',
                    account_type: 'equity',
                    group_id: equityGroup.id,
                    is_system: true,
                    is_active: true,
                    updated_at: knex.fn.now()
                });
            continue;
        }

        await knex('accounts').insert({
            tenant_id: tenantId,
            code: '3003',
            name: 'Owner Drawings',
            account_type: 'equity',
            group_id: equityGroup.id,
            opening_balance: 0,
            current_balance: 0,
            is_system: true,
            is_active: true,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now()
        });
        console.log(`Created Owner Drawings (3003) for tenant ${tenantId}`);
    }
};

exports.down = async function down(knex) {
    await knex('accounts')
        .where({ code: '3003', is_system: true })
        .del();
};
