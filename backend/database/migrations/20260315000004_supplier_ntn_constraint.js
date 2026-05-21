exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('suppliers', 'ntn');
  if (!hasColumn) {
    await knex.schema.table('suppliers', (table) => {
      table.string('ntn', 20).nullable();
    });
  }
  await knex.schema.raw(`
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_ntn_format CHECK (ntn IS NULL OR ntn ~ '^[0-9]{7}-[0-9]{1}$');
  `);
};

exports.down = function(knex) {
  return knex.schema.raw(`
    ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_ntn_format;
  `);
};
