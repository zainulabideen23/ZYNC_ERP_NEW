
const knex = require('knex');
const config = require('../knexfile');
const db = knex(config.development);

const ProductService = require('../src/services/product.service');
const SaleService = require('../src/services/sale.service');
const PurchaseService = require('../src/services/purchase.service');
const CustomerService = require('../src/services/customer.service');
const SupplierService = require('../src/services/supplier.service');
const LedgerService = require('../src/services/ledger.service');

async function verify() {
    console.log('🚀 Starting Verification...');

    try {
        console.log('🧹 Cleaning up old test data...');
        // Delete in order of constraints
        await db('ledger_entries').del();
        await db('journals').del();
        await db('sale_items').del();
        await db('purchase_items').del();
        await db('sales').del();
        await db('purchases').del();
        await db('stock_movements').del();

        // Delete test products, suppliers, customers
        await db('products').where('name', 'Test Product').del();
        await db('suppliers').where('name', 'Test Supplier').del();
        await db('customers').where('name', 'Test Customer').del();

        // Clean up accounts created by services for these test entities
        await db('accounts').where('name', 'like', 'Payable - Test Supplier%').del();
        await db('accounts').where('name', 'like', 'Receivable - Test Customer%').del();

        // 1. Get an existing user
        const user = await db('users').first();
        if (!user) {
            console.log('❌ No user found. Run initial setup first.');
            process.exit(1);
        }
        const userId = user.id;

        // 2. Ensure Unit and Category exist (standard ones or create if missing)
        let unit = await db('units').first();
        if (!unit) {
            console.log('📦 Creating default unit...');
            [unit] = await db('units').insert({ name: 'Each', abbreviation: 'pcs' }).returning('*');
        }

        let cat = await db('categories').first();
        if (!cat) {
            console.log('📦 Creating default category...');
            [cat] = await db('categories').insert({ name: 'General' }).returning('*');
        }

        // 2.5 Consolidate duplicate account groups and fix codes
        const allGroups = await db('account_groups').select('*');
        const groupedByName = allGroups.reduce((acc, g) => {
            acc[g.name] = acc[g.name] || [];
            acc[g.name].push(g);
            return acc;
        }, {});

        for (const name in groupedByName) {
            const list = groupedByName[name];
            if (list.length > 1) {
                console.log(`🔧 Consolidating duplicate group: ${name}`);
                const primary = list.find(g => g.code) || list[0];
                const others = list.filter(g => g.id !== primary.id);
                for (const other of others) {
                    await db('accounts').where('group_id', other.id).update({ group_id: primary.id });
                    await db('account_groups').where('parent_id', other.id).update({ parent_id: primary.id });
                    await db('account_groups').where('id', other.id).del();
                }
            }
        }

        const groupsToFix = [
            { name: 'Receivables', code: '1200' },
            { name: 'Payables', code: '2000' },
            { name: 'Inventory', code: '1400' },
            { name: 'Sales Revenue', code: '4000' },
            { name: 'Cost of Goods Sold', code: '5000' },
            { name: 'Cash', code: '1000' },
            { name: 'Bank Accounts', code: '1100' }
        ];
        for (const g of groupsToFix) {
            const group = await db('account_groups').where('name', g.name).first();
            if (group) {
                if (!group.code) {
                    console.log(`🔧 Fixing group code: ${g.name} -> ${g.code}`);
                    await db('account_groups').where('id', group.id).update({ code: g.code });
                }
            }
        }

        // 3. Create a Product
        const productService = new ProductService(db);
        const product = await productService.create({
            code: 'T-VERIFY-' + Date.now().toString().slice(-4),
            name: 'Test Product',
            category_id: cat.id,
            unit_id: unit.id,
            cost_price: 100,
            retail_price: 150,
            opening_stock: 10,
            track_stock: true
        }, userId);
        console.log('   ✓ Product created:', product.name, 'with 10 opening stock');

        // 4. Create a Supplier and Customer
        console.log('🚛 Creating test supplier...');
        const supplierService = new SupplierService(db);
        const supplier = await supplierService.create({
            code: 'SUP-P' + Date.now().toString().slice(-4),
            name: 'Test Supplier',
            phone_number: '123456789',
            address_line1: 'Supplier Addr',
            city: 'City'
        }, userId);

        console.log('👥 Creating test customer...');
        const customerService = new CustomerService(db);
        const customer = await customerService.create({
            code: 'CUS-P' + Date.now().toString().slice(-4),
            name: 'Test Customer',
            phone_number: '987654321',
            address_line1: 'Customer Addr',
            city: 'City'
        }, userId);

        // 5. Create a Purchase (Add stock at different cost)
        console.log('🚛 Recording purchase (FIFO test)...');
        const purchaseService = new PurchaseService(db);
        await purchaseService.createPurchase({
            supplier_id: supplier.id,
            purchase_date: new Date(),
            items: [{
                product_id: product.id,
                quantity: 5,
                unit_cost: 120 // Higher cost
            }],
            amount_paid: 600,
            payment_method: 'cash'
        }, userId);
        console.log('   ✓ Purchase recorded for 5 units @ 120');

        // Total Stock should be 15
        const currentStock = await db('products').where('id', product.id).select('current_stock').first();
        console.log('   ✓ Current Stock:', currentStock.current_stock);

        // 6. Create a Sale (Consume stock - should take 10 @ 100 first)
        console.log('💰 Recording sale (12 units)...');
        const saleService = new SaleService(db);
        const sale = await saleService.createSale({
            customer_id: customer.id,
            items: [{
                product_id: product.id,
                quantity: 12,
                unit_price: 200
            }],
            amount_paid: 2400,
            payment_method: 'cash'
        }, userId);
        console.log('   ✓ Sale recorded for 12 units');

        // 7. Verify FIFO Costing
        // COGS should be: (10 * 100) + (2 * 120) = 1000 + 240 = 1240
        const journalEntriesData = await db('journals')
            .join('ledger_entries', 'journals.id', 'ledger_entries.journal_id')
            .join('accounts', 'ledger_entries.account_id', 'accounts.id')
            .where('journals.reference_type', 'sale')
            .where('accounts.code', '5001') // COGS
            .select('ledger_entries.amount', 'ledger_entries.entry_type');

        const saleCogsEntry = journalEntriesData.find(e => e.entry_type === 'debit');
        console.log('📊 Verification - Accounting:');
        console.log('   - Expected COGS (FIFO): 1240.00');
        console.log('   - Actual COGS Entry:', saleCogsEntry ? saleCogsEntry.amount : 'NOT FOUND');

        if (saleCogsEntry && Math.abs(parseFloat(saleCogsEntry.amount) - 1240) < 0.01) {
            console.log('✅ FIFO Costing Verified!');
        } else {
            console.log('❌ FIFO Costing Mismatch!');
        }

        // 8. Verify balanced ledger
        const totals = await db('ledger_entries').select('entry_type').sum('amount as total').groupBy('entry_type');
        const debits = parseFloat(totals.find(t => t.entry_type === 'debit')?.total || 0);
        const credits = parseFloat(totals.find(t => t.entry_type === 'credit')?.total || 0);

        console.log(`   - Total Ledger Debits: ${debits}`);
        console.log(`   - Total Ledger Credits: ${credits}`);

        if (Math.abs(debits - credits) < 0.01) {
            console.log('✅ Ledger is Balanced!');
        } else {
            console.log('❌ Ledger is UNBALANCED!');
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error.message);
        console.error(error.stack);
    } finally {
        await db.destroy();
    }
}

verify();
