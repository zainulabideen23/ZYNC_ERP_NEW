require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/config/database');

async function addMissingSequences() {
    try {
        console.log('Checking for missing sequences...\n');

        const requiredSequences = [
            { name: 'invoice', prefix: 'INV-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'purchase', prefix: 'PUR-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'credit_note', prefix: 'CN-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'debit_note', prefix: 'DN-', current_value: 0, pad_length: 6, reset_yearly: true }
        ];

        let added = 0;

        for (const seq of requiredSequences) {
            const exists = await db('sequences').where('name', seq.name).first();

            if (!exists) {
                await db('sequences').insert(seq);
                console.log(`✅ Added sequence: ${seq.name} (${seq.prefix})`);
                added++;
            } else {
                console.log(`⏭️  Sequence already exists: ${seq.name}`);
            }
        }

        console.log(`\n📊 Summary: ${added} new sequences added`);

        await db.destroy();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

addMissingSequences();
