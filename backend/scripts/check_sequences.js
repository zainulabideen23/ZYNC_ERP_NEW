require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/config/database');

async function checkSequences() {
    try {
        console.log('Fetching all sequences from database...\n');

        const sequences = await db('sequences').select('*').orderBy('name');

        console.log(`Total sequences found: ${sequences.length}\n`);
        console.log('Sequence Details:');
        console.log('─'.repeat(80));

        sequences.forEach(seq => {
            console.log(`Name: ${seq.name.padEnd(15)} | Prefix: ${seq.prefix.padEnd(8)} | Current: ${seq.current_value} | Pad: ${seq.pad_length} | Reset Yearly: ${seq.reset_yearly}`);
        });

        console.log('─'.repeat(80));

        const invoiceSeq = sequences.find(s => s.name === 'invoice');
        if (invoiceSeq) {
            console.log('\n✅ Invoice sequence EXISTS');
            console.log(`   Next invoice number will be: ${invoiceSeq.prefix}${String(invoiceSeq.current_value + 1).padStart(invoiceSeq.pad_length, '0')}`);
        } else {
            console.log('\n❌ Invoice sequence NOT FOUND');
        }

        await db.destroy();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking sequences:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

checkSequences();
