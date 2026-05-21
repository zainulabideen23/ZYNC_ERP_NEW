const { execSync } = require('child_process');
const path = require('path');

function run(cmd) {
    execSync(cmd, { cwd: __dirname, stdio: 'inherit', env: process.env });
}

async function setup() {
    console.log('\n=== Running initial migrations (best effort) ===\n');
    try { run('npx knex migrate:latest'); }
    catch (e) { console.log('\nMigration pass 1 finished (some failures expected on fresh DB)\n'); }

    console.log('\n=== Running seed ===\n');
    run('npx knex seed:run');

    console.log('\n=== Running migrations again ===\n');
    run('npx knex migrate:latest');

    console.log('\n=== Starting server ===\n');
    run('node src/index.js');
}

setup().catch(e => { console.error(e); process.exit(1); });
