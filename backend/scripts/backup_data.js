const knex = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function backup() {
    console.log('Starting backup of current data...');
    try {
        const products = await knex('products').select('*');
        const categories = await knex('categories').select('*');
        const customers = await knex('customers').select('*');
        const suppliers = await knex('suppliers').select('*');

        const backupData = {
            products,
            categories,
            customers,
            suppliers,
            timestamp: new Date().toISOString()
        };

        const backupPath = path.join(__dirname, '../logs/pre_migration_backup.json');
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

        console.log(`✅ Backup saved to ${backupPath}`);
        console.log(`- Products: ${products.length}`);
        console.log(`- Categories: ${categories.length}`);
    } catch (error) {
        console.error('❌ Backup failed:', error.message);
    } finally {
        process.exit(0);
    }
}

backup();
