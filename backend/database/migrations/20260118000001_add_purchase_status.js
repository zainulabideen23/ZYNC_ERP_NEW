
exports.up = function (knex) {
    return knex.schema.raw("ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'returned'");
};

exports.down = function (knex) {
    // PostgreSQL doesn't support removing enum values easily
};
