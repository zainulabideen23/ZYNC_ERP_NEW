exports.up = async function up(knex) {
    await knex('accounts')
        .where({ code: '4003' })
        .update({ account_type: 'expense' });
};

exports.down = async function down(knex) {
    await knex('accounts')
        .where({ code: '4003' })
        .update({ account_type: 'income' });
};