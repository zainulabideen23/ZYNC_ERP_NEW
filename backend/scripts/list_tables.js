const knex = require('knex');
const config = require('../knexfile');
const db = knex(config.development);

(async () => {
  try {
    const res = await db.raw("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await db.destroy();
  }
})();
