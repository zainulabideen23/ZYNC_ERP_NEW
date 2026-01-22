require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/config/database');

async function insertSequences() {
    try {
        console.log('Checking if sequences exist...');

        const existingSequences = await db('sequences').select('name');
        console.log(`Found ${existingSequences.length} existing sequences`);

        if (existingSequences.length > 0) {
            console.log('Sequences already exist. Skipping insert.');
            process.exit(0);
        }

        console.log('Inserting sequences...');

        await db('sequences').insert([
            { name: 'invoice', prefix: 'INV-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'purchase', prefix: 'PUR-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'quotation', prefix: 'QTN-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'challan', prefix: 'DC-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'gatepass', prefix: 'GP-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'expense', prefix: 'EXP-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'journal', prefix: 'JRN-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'debit_note', prefix: 'DN-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'credit_note', prefix: 'CN-', current_value: 0, pad_length: 6, reset_yearly: true },
            { name: 'customer', prefix: 'CUST-', current_value: 0, pad_length: 5, reset_yearly: false },
            { name: 'supplier', prefix: 'SUPP-', current_value: 0, pad_length: 5, reset_yearly: false },
            { name: 'product', prefix: 'PROD-', current_value: 0, pad_length: 5, reset_yearly: false }
        ]);

        console.log('✅ Sequences inserted successfully!');

        const count = await db('sequences').count('* as total').first();
        console.log(`Total sequences in database: ${count.total}`);

        await db.destroy();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error inserting sequences:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

insertSequences();
