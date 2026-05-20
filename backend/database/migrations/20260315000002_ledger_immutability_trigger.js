exports.up = function(knex) {
  return knex.schema
    .raw('DROP TRIGGER IF EXISTS trigger_update_account ON ledger_entries')
    .then(() => knex.schema.raw('DROP TRIGGER IF EXISTS trigger_update_stock_sale ON ledger_entries'));
};

exports.down = function(knex) {};
