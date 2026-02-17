/**
 * Script to sync all sequences with their respective tables
 * Run this when sequences get out of sync with actual data
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const knex = require(path.join(__dirname, '..', 'src', 'config', 'database'));

async function syncAllSequences() {
    console.log('🔄 Syncing sequences with actual table data...\n');

    try {
        // 1. Sync Invoice Sequence
        const invoiceResult = await knex.raw(`
            SELECT COALESCE(MAX(CAST(REPLACE(invoice_number, 'SINV-', '') AS INTEGER)), 0) as max_num 
            FROM sales
        `);
        const maxInvoice = invoiceResult.rows[0]?.max_num || 0;
        await knex('sequences').where('name', 'invoice').update({ current_value: maxInvoice });
        console.log(`✓ Invoice: Synced to ${maxInvoice}`);

        // 2. Sync Journal Sequence
        const journalResult = await knex.raw(`
            SELECT COALESCE(MAX(CAST(REPLACE(journal_number, 'JV-', '') AS INTEGER)), 0) as max_num 
            FROM journals
        `);
        const maxJournal = journalResult.rows[0]?.max_num || 0;
        await knex('sequences').where('name', 'journal').update({ current_value: maxJournal });
        console.log(`✓ Journal: Synced to ${maxJournal}`);

        // 3. Sync Purchase Sequence
        const purchaseResult = await knex.raw(`
            SELECT COALESCE(MAX(CAST(REPLACE(bill_number, 'PUR-', '') AS INTEGER)), 0) as max_num 
            FROM purchases
        `);
        const maxPurchase = purchaseResult.rows[0]?.max_num || 0;
        await knex('sequences').where('name', 'purchase').update({ current_value: maxPurchase });
        console.log(`✓ Purchase: Synced to ${maxPurchase}`);

        // 4. Sync Quotation Sequence
        const quotationResult = await knex.raw(`
            SELECT COALESCE(MAX(CAST(REPLACE(quotation_number, 'QUO-', '') AS INTEGER)), 0) as max_num 
            FROM quotations
        `);
        const maxQuotation = quotationResult.rows[0]?.max_num || 0;
        await knex('sequences').where('name', 'quotation').update({ current_value: maxQuotation });
        console.log(`✓ Quotation: Synced to ${maxQuotation}`);

        // Print final state
        console.log('\n📊 Updated Sequences:');
        const sequences = await knex('sequences').select('*');
        sequences.forEach(seq => {
            console.log(`   ${seq.name}: ${seq.prefix}${String(parseInt(seq.current_value) + 1).padStart(seq.pad_length, '0')} (next)`);
        });

        console.log('\n✅ All sequences synced successfully!');
    } catch (error) {
        console.error('❌ Error syncing sequences:', error.message);
    } finally {
        await knex.destroy();
    }
}

syncAllSequences();
