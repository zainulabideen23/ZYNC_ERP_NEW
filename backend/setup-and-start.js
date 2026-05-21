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
            resolve();
        });
        child.on('error', (err) => {
            console.error(`\n${name} error: ${err.message}\n`);
            resolve();
        });
    });
}

async function main() {
    console.log('\n=== Starting server immediately ===\n');
    const app = require('./src/index.js');

    // Give server a moment to bind to port
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n=== Running migrations + seed in background ===\n');

    // Run async in background — server handles requests during migration
    runAsync('PASS 1: Initial migrations', 'migrate').then(async () => {
        await runAsync('PASS 2: Seed data', 'seed');
        await runAsync('PASS 3: Migrations again', 'migrate');
        console.log('\n=== Setup complete ===\n');
    }).catch(e => {
        console.error('Setup background error:', e.message);
    });
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
