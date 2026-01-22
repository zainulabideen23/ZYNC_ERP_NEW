const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function seedDatabase() {
    try {
        console.log('Reading seed file...');
        const seedSQL = fs.readFileSync(
            path.join(__dirname, '../../database/seeds/001_seed_data.sql'),
            'utf8'
        );

        console.log('Executing seed SQL...');
        await db.raw(seedSQL);

        console.log('✅ Database seeded successfully!');
        console.log('Sequences, accounts, and sample data have been loaded.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        process.exit(1);
    }
}

seedDatabase();
