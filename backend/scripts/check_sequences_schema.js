const path = require('path');
const knex = require('knex')(require(path.join(__dirname, '..', 'knexfile')).development);

async function check() {
    const cols = await knex.raw(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sequences' ORDER BY ordinal_position"
    );
    console.log('=== sequences columns ===');
    console.table(cols.rows);

    const data = await knex('sequences').select('*');
    console.log('\n=== sequences data ===');
    console.table(data);

    process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
