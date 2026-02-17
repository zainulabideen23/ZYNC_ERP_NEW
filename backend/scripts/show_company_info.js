const knex = require('knex');
const config = require('../knexfile');
const db = knex(config.development);

(async () => {
  try {
    const rows = await db('company_info').select('*');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await db.destroy();
  }
})();
