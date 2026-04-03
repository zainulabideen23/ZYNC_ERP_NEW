const db = require('../src/config/database');
db.raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
  .then(r => { console.log(r.rows.map(x => x.tablename).join('\n')); process.exit(); })
  .catch(e => { console.error(e.message); process.exit(1); });
