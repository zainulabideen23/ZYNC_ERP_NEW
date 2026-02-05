const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function seedCategories() {
    console.log('🚀 Seeding categories...');
    try {
        const cats = await db('categories').select('*');
        if (cats.length === 0) {
            await db('categories').insert([
                { name: 'Electronics', description: 'Electronic products' },
                { name: 'Furniture', description: 'Furniture products' },
                { name: 'Apparel', description: 'Clothing and apparel' },
                { name: 'Food & Beverage', description: 'Food and drink items' },
                { name: 'Hardware', description: 'Hardware and tools' },
                { name: 'Other', description: 'Miscellaneous items' }
            ]);
            console.log('✅ Default categories seeded.');
        } else {
            console.log('ℹ️ Categories already exist.');
        }
    } catch (error) {
        console.error('❌ Error seeding categories:', error.message);
    } finally {
        await db.destroy();
    }
}

seedCategories();
