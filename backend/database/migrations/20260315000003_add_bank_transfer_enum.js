exports.up = async function(knex) {
  const exists = await knex.raw(`
    SELECT 1 FROM pg_type WHERE typname = 'enum_ledger_entries_account_type'
  `);
  if (exists.rows.length > 0) {
    await knex.raw(`
      ALTER TYPE enum_ledger_entries_account_type ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
    `);
  }
};

exports.down = function(knex) {};
