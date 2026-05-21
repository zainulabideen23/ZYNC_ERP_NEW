const { spawn } = require('child_process');
const path = require('path');

function runAsync(name, cmd) {
    return new Promise((resolve) => {
        console.log(`\n=== ${name} ===\n`);
        const child = spawn('npm', ['run', cmd], {
            cwd: __dirname,
            stdio: 'inherit',
            env: process.env,
            shell: true,
        });
        child.on('close', (code) => {
            console.log(`\n${name} completed (exit code: ${code})\n`);
            resolve(code);
        });
        child.on('error', (err) => {
            console.error(`\n${name} error: ${err.message}\n`);
            resolve(1);
        });
    });
}

async function main() {
    console.log('\n=== Starting server immediately ===\n');
    require('./src/index.js');
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n=== PASS 1: Run individual migrations ===\n');
    await runAsync('PASS 1: Migrations', 'run-migrations');

    console.log('\n=== PASS 2: Seed data ===\n');
    await runAsync('PASS 2: Seed', 'seed');

    console.log('\n=== PASS 3: Run migrations again ===\n');
    await runAsync('PASS 3: Migrations', 'run-migrations');

    console.log('\n=== Setup complete ===\n');
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
