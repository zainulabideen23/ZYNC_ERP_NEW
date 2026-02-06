/**
 * ZYNC-ERP Database Cleanup Script
 * Resets all transaction data and sequences to start fresh from 1
 * 
 * WARNING: This will DELETE all sales, purchases, journals, stock movements, etc.
 * Master data (products, customers, suppliers, accounts) will be PRESERVED.
 * 
 * Run: node scripts/cleanup_transactions.js
 */
const path = require('path');
const readline = require('readline');
const knex = require(path.join(__dirname, '..', 'src', 'config', 'database'));

async function cleanup() {
    console.log('\n⚠️  ZYNC-ERP DATABASE CLEANUP SCRIPT ⚠️\n');
    console.log('This will DELETE all:');
    console.log('  • Sales & Sale Items');
    console.log('  • Purchases & Purchase Items');
    console.log('  • Quotations & Quotation Items');
    console.log('  • Journals & Ledger Entries');
    console.log('  • Stock Movements');
    console.log('  • Expenses');
    console.log('');
    console.log('This will PRESERVE:');
    console.log('  • Products, Categories, Units');
    console.log('  • Customers, Suppliers');
    console.log('  • Accounts, Account Groups');
    console.log('  • Users, Settings');
    console.log('');

    // Ask for confirmation
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const confirm = await new Promise(resolve => {
        rl.question('Type "YES" to confirm cleanup: ', resolve);
    });
    rl.close();

    if (confirm !== 'YES') {
        console.log('\n❌ Cleanup cancelled.\n');
        process.exit(0);
    }

    console.log('\n🔄 Starting cleanup...\n');

    try {
        await knex.transaction(async (trx) => {
            // 1. Delete transaction data (in order to respect foreign keys)
            console.log('Deleting sale items...');
            await trx('sale_items').del();

            console.log('Deleting sales...');
            await trx('sales').del();

            console.log('Deleting purchase items...');
            await trx('purchase_items').del();

            console.log('Deleting purchases...');
            await trx('purchases').del();

            console.log('Deleting quotation items...');
            await trx('quotation_items').del();

            console.log('Deleting quotations...');
            await trx('quotations').del();

            console.log('Deleting ledger entries...');
            await trx('ledger_entries').del();

            console.log('Deleting journals...');
            await trx('journals').del();

            console.log('Deleting stock movements...');
            await trx('stock_movements').del();

            console.log('Deleting expenses...');
            await trx('expenses').del();

            // 2. Reset product stock to 0
            console.log('Resetting product stock levels to 0...');
            await trx('products').update({ current_stock: 0 });

            // 3. Reset customer/supplier balances
            console.log('Resetting customer balances...');
            await trx('customers').update({
                current_balance: 0,
                current_credit_used: 0
            });

            console.log('Resetting supplier balances...');
            await trx('suppliers').update({ current_balance: 0 });

            // 4. Reset account balances to opening balances
            console.log('Resetting account balances...');
            await trx.raw(`
                UPDATE accounts 
                SET current_balance = opening_balance
            `);

            // 5. Reset all sequences to 0
            console.log('Resetting all sequences to 0...');
            await trx('sequences').update({ current_value: 0 });
        });

        // Show final state
        console.log('\n✅ Cleanup completed successfully!\n');

        const sequences = await knex('sequences').select('*');
        console.log('📊 Sequence Status:');
        sequences.forEach(seq => {
            console.log(`   ${seq.name}: Next will be ${seq.prefix}000001`);
        });

        const productCount = await knex('products').where('is_deleted', false).count('id as count').first();
        const customerCount = await knex('customers').where('is_deleted', false).count('id as count').first();
        const supplierCount = await knex('suppliers').where('is_deleted', false).count('id as count').first();

        console.log('\n📦 Preserved Data:');
        console.log(`   Products: ${productCount.count}`);
        console.log(`   Customers: ${customerCount.count}`);
        console.log(`   Suppliers: ${supplierCount.count}`);
        console.log('');

    } catch (error) {
        console.error('\n❌ Cleanup failed:', error.message);
    } finally {
        await knex.destroy();
    }
}

cleanup();
