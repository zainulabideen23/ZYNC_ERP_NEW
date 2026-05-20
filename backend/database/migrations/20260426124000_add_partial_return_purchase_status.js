exports.up = async function up(knex) {
    await knex.raw("ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'partial_return'");
};

exports.down = async function down() {
    // PostgreSQL does not support removing enum values safely.
};
