exports.up = function(knex) {
  return knex.schema.raw(`
    ALTER TYPE enum_ledger_entries_account_type ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
  `);
};

exports.down = function(knex) {};
