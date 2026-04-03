const db = require('../src/config/database');

(async () => {
    try {
        // Check if tenants table exists
        const t = await db.raw(`SELECT * FROM information_schema.tables WHERE table_name='tenants' AND table_schema='public'`);
        console.log('Tenants table exists:', t.rows.length > 0);
        if (t.rows.length > 0) {
            const d = await db('tenants');
            console.log('Tenants:', d);
        }

        // Check which tables have tenant_id
        const r = await db.raw(`SELECT table_name FROM information_schema.columns WHERE column_name='tenant_id' AND table_schema='public' ORDER BY table_name`);
        console.log('\nTables WITH tenant_id:', r.rows.map(x => x.table_name));

        // Check all tables
        const all = await db.raw(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
        const allTables = all.rows.map(x => x.tablename);
        const withTenant = r.rows.map(x => x.table_name);
        const without = allTables.filter(t => !withTenant.includes(t) && !['knex_migrations', 'knex_migrations_lock', 'tenants'].includes(t));
        console.log('\nTables WITHOUT tenant_id:', without);

        // Check triggers on ledger_entries
        const trigs = await db.raw(`SELECT tgname, tgtype FROM pg_trigger JOIN pg_class ON tgrelid=pg_class.oid WHERE relname='ledger_entries' AND NOT tgisinternal`);
        console.log('\nTriggers on ledger_entries:', trigs.rows);

        // Check migration state
        const migs = await db.raw(`SELECT name, batch FROM knex_migrations ORDER BY id`);
        console.log('\nMigrations:', migs.rows);
    } catch (e) {
        console.error('Error:', e.message);
    }
    await db.destroy();
})();
