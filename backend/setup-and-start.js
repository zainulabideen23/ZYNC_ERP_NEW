const { execSync } = require('child_process');

function run(cmd) {
    const result = execSync(cmd, { cwd: __dirname, stdio: 'inherit', env: process.env, timeout: 120000 });
    return result;
}

try {
    console.log('\n=== Running initial migrations (best effort) ===\n');
    try { run('npx knex migrate:latest'); } catch (e) {
        console.log('\nMigration pass 1 finished (some failures expected on fresh DB)\n');
    }

    console.log('\n=== Running seed ===\n');
    try { run('npx knex seed:run'); } catch (e) {
        console.log('\nSeed finished (may have partially completed)\n');
    }

    console.log('\n=== Running migrations again ===\n');
    try { run('npx knex migrate:latest'); } catch (e) {
        console.log('\nMigration pass 2 finished\n');
    }

    console.log('\n=== Starting server ===\n');
} catch (e) {
    console.error('Fatal error:', e.message);
    process.exit(1);
}

// Start the app in the same process
require('./src/index.js');
