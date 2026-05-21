const path = require('path');
const knex = require('knex');

async function main() {
    const env = process.env.NODE_ENV || 'development';
    const config = require('./knexfile.js')[env];

    if (!config) {
        console.error(`No knex config for environment: ${env}`);
        process.exit(1);
    }

    const db = knex(config);
    const migrator = db.migrate;

    try {
        const [completed, pending] = await migrator.list();
        const completedNames = new Set(completed.map(m => m.name));

        if (pending.length === 0) {
            console.log('All migrations already applied.');
            return;
        }

        console.log(`${pending.length} pending migration(s) to run individually:`);

        let successCount = 0;
        let failCount = 0;

        for (const migration of pending) {
            const name = migration.file || migration;

            if (completedNames.has(name)) {
                console.log(`  - ${name} (already completed, skipping)`);
                continue;
            }

            console.log(`\n▶ ${name}`);

            try {
                const result = await db.migrate.up({ name });
                const applied = result && result[1] ? result[1] : [];
                if (applied.length > 0) {
                    console.log(`  ✓ ${applied[0]} (batch ${result[0]})`);
                    completedNames.add(name);
                    successCount++;
                } else {
                    console.log(`  ✓ ${name}`);
                    completedNames.add(name);
                    successCount++;
                }
            } catch (err) {
                console.error(`  ✗ ${name} FAILED`);
                const msg = (err.message || String(err)).split('\n')[0];
                console.error(`    ${msg}`);
                failCount++;
            }
        }

        console.log(`\nResult: ${successCount} succeeded, ${failCount} failed`);
        if (failCount > 0 && process.exitCode === undefined) {
            process.exit(1);
        }
    } catch (err) {
        console.error('Fatal:', err.message || err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

main();
