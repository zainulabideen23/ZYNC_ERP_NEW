const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Force IPv4 DNS resolution by using a custom resolver
process.env.DB_HOST = 'db.euxcyizvngnkszlvsqdp.supabase.co';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'postgres';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_SSL = 'true';
process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
process.env.NODE_ENV = 'production';

// Try to get IPv4 address using system DNS
try {
    const result = execSync('nslookup db.euxcyizvngnkszlvsqdp.supabase.co 8.8.8.8', { encoding: 'utf8', timeout: 10000 });
    console.log('DNS Result:', result);
} catch(e) {
    console.log('DNS lookup error:', e.message);
}

// Try migration
try {
    execSync('npx knex migrate:latest --knexfile knexfile.js', {
        cwd: __dirname,
        stdio: 'inherit',
        timeout: 120000,
        env: { ...process.env }
    });
    console.log('Migrations completed!');
} catch(e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
}
