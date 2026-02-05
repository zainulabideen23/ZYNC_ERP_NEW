const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function fakeMigrations() {
    console.log('🚀 Faking previous migrations...');

    try {
        const migrations = [
            '20260118000000_create_initial_schema.js',
            '20260118000001_add_purchase_status.js',
            '20260118000002_add_sale_status.js'
        ];

        // Ensure table exists
        const exists = await db.schema.hasTable('knex_migrations');
        if (!exists) {
            console.log('knex_migrations table missing? Something is wrong.');
            return;
        }

        for (const name of migrations) {
            const alreadyDone = await db('knex_migrations').where({ name }).first();
            if (!alreadyDone) {
                await db('knex_migrations').insert({
                    name,
                    batch: 1,
                    migration_time: new Date()
                });
                console.log(`✅ Marked ${name} as completed.`);
            } else {
                console.log(`ℹ️ ${name} was already marked.`);
            }
        }

        console.log('✅ Done! You can now run migrate:latest');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.destroy();
    }
}

fakeMigrations();
