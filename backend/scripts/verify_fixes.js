const path = require('path');
const knex = require('knex')(require(path.join(__dirname, '..', 'knexfile')).development);

async function verify() {
    // Check triggers on ledger_entries
    const triggers = await knex.raw(
        "SELECT tgname, tgtype FROM pg_trigger WHERE tgrelid = 'ledger_entries'::regclass"
    );
    console.log('\n=== Triggers on ledger_entries ===');
    console.table(triggers.rows);

    // Run balance reconciliation function
    const integrity = await knex.raw('SELECT * FROM check_account_balance_integrity()');
    console.log('\n=== Balance Integrity Discrepancies ===');
    if (integrity.rows.length === 0) {
        console.log('No discrepancies found! All balances match.');
    } else {
        console.table(integrity.rows);
    }

    // Show migration status
    const migrations = await knex.raw(
        "SELECT name, batch FROM knex_migrations ORDER BY id DESC LIMIT 5"
    );
    console.log('\n=== Recent Migrations ===');
    console.table(migrations.rows);

    process.exit(0);
}

verify().catch(e => { console.error(e); process.exit(1); });
