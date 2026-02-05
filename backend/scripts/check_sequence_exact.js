const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function checkSequence() {
    try {
        console.log('Checking sequence "supplier" for whitespace/case issues...');

        const sequences = await db('sequences').select('name').where('name', 'like', '%supplier%');
        console.log('Found sequences matching "%supplier%":');
        console.table(sequences.map(s => ({
            name: `"${s.name}"`,
            length: s.name.length
        })));


    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.destroy();
    }
}

checkSequence();
