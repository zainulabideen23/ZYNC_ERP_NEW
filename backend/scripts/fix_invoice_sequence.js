const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const knex = require(path.join(__dirname, '..', 'src', 'config', 'database'));

async function fixInvoiceSequence() {
    console.log('🔧 Fixing Invoice Sequence...');

    try {
        await knex.transaction(async trx => {
            // 1. Identify the rogue invoice
            // searching for any invoice > 2 (assuming we want to reset to small numbers)
            // or specifically 111 as reported
            const sales = await trx('sales')
                .where('invoice_number', 'like', 'SINV%')
                .orderBy('id', 'desc');

            const rogueSales = sales.filter(s => {
                const num = parseInt(s.invoice_number.replace('SINV-', ''));
                return num > 1 && num > 1; // invoices > 1 (e.g. 2 is fine if next, but we want to renumber jumps)
                // Actually, if we see 111, that's a jump.
                // Let's just find anything > 1 assuming we have very few data and want to compact them.
                return num > 1;
            }).sort((a, b) => a.id - b.id);

            if (rogueSales.length === 0) {
                console.log('No rogue invoices found (> 1).');
                return;
            }

            console.log(`Found ${rogueSales.length} rogue invoices. Renumbering sequentially starting from SINV-000002...`);

            let nextNum = 2;
            for (const sale of rogueSales) {
                const oldInvoice = sale.invoice_number;
                const newInvoice = `SINV-${String(nextNum).padStart(6, '0')}`;

                if (oldInvoice === newInvoice) {
                    console.log(`Skipping ${oldInvoice} (already correct)`);
                    nextNum++;
                    continue;
                }

                console.log(`Renaming ${oldInvoice} -> ${newInvoice}`);

                // 2. Update Sale
                await trx('sales')
                    .where('id', sale.id)
                    .update({ invoice_number: newInvoice });

                // 3. Update Journal
                await trx('journals')
                    .where('description', 'like', `%${oldInvoice}%`)
                    .update({
                        description: trx.raw(`REPLACE(description, ?, ?)`, [oldInvoice, newInvoice])
                    });

                // 4. Update Ledger Entries
                await trx('ledger_entries')
                    .where('description', 'like', `%${oldInvoice}%`)
                    .update({
                        description: trx.raw(`REPLACE(description, ?, ?)`, [oldInvoice, newInvoice])
                    });

                // 5. Update Stock Movements
                await trx('stock_movements')
                    .where('notes', 'like', `%${oldInvoice}%`)
                    .update({
                        notes: trx.raw(`REPLACE(notes, ?, ?)`, [oldInvoice, newInvoice])
                    });

                nextNum++;
            }

            // 6. Reset Sequence
            console.log(`Resetting sequence to ${nextNum - 1}...`);
            await trx('sequences')
                .where('name', 'invoice')
                .update({ current_value: nextNum - 1 });

            console.log('✅ Fix applied successfully!');
        });

    } catch (error) {
        console.error('❌ Error fixing sequence:', error);
    } finally {
        await knex.destroy();
    }
}

fixInvoiceSequence();
