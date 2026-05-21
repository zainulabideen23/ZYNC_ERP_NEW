exports.up = async function (knex) {
    await knex.schema.alterTable('account_groups', table => {
        table.dropUnique(['code'], 'account_groups_code_unique');
        table.unique(['tenant_id', 'code'], 'account_groups_tenant_code_unique');
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('account_groups', table => {
        table.dropUnique(['tenant_id', 'code'], 'account_groups_tenant_code_unique');
        table.unique(['code'], 'account_groups_code_unique');
    });
};
