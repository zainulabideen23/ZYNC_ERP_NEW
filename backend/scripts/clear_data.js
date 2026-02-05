const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function clearData() {
    console.log('🚀 Starting Database Cleanup...');

    try {
        await db.transaction(async (trx) => {
            // Transactional/Operational Data
            console.log('Truncating transactional data...');
            await trx('audit_logs').del();
            await trx('ledger_entries').del();
            await trx('journals').del();
            await trx('payments').del();
            await trx('stock_movements').del();
            await trx('sale_items').del();
            await trx('sales').del();
            await trx('purchase_items').del();
            await trx('purchases').del();
            await trx('expenses').del();
            await trx('quotation_items').del();
            await trx('quotations').del();
            await trx('delivery_challans').del();
            await trx('gate_passes').del();

            // Master Dummy Data
            console.log('Truncating master dummy data...');
            await trx('products').del();
            await trx('customers').del();
            await trx('suppliers').del();

            // Note: We keep categories, companies, units, and users as they might be used as templates/configuration.
            // But if they are dummy, we could clear them too. Let's keep them for now to avoid breaking system structure.
            // await trx('categories').del();
            // await trx('companies').del();

            // Reset Sequences
            console.log('Resetting sequences...');
            await trx('sequences').update({ current_value: 0 });

            console.log('✅ Cleanup successful! Transaction committed.');
        });
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

clearData();
