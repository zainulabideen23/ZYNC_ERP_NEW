const { execSync } = require('child_process');

function run(cmd) {
    execSync(cmd, { cwd: __dirname, stdio: 'inherit', env: process.env, timeout: 180000 });
}

try {
    console.log('\n=== PASS 1: Initial migrations (best effort) ===\n');
    try { run('npm run migrate'); } catch (e) {
        console.log('\nPass 1 done - some failures expected on fresh DB\n');
    }

    console.log('\n=== PASS 2: Seed data ===\n');
    try { run('npm run seed'); } catch (e) {
        console.log('\nSeed done (may have partial data)\n');
    }

    console.log('\n=== PASS 3: Migrations again ===\n');
    try { run('npm run migrate'); } catch (e) {
        console.log('\nPass 3 done\n');
    }

    console.log('\n=== Starting server ===\n');
} catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
}

require('./src/index.js');
