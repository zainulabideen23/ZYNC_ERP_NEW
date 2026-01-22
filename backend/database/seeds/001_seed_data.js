/**
 * Seed initial data for ZYNC-ERP
 * Creates default users, account structure, and master data
 */

const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
    // Clear existing data (only in development)
    if (process.env.NODE_ENV === 'development') {
        await knex('audit_logs').del();
        await knex('ledger_entries').del();
        await knex('journals').del();
        await knex('payments').del();
        await knex('stock_movements').del();
        await knex('sale_items').del();
        await knex('sales').del();
        await knex('purchase_items').del();
        await knex('purchases').del();
        await knex('expenses').del();
        await knex('expense_categories').del();
        await knex('customers').del();
        await knex('suppliers').del();
        await knex('products').del();
        await knex('units').del();
        await knex('companies').del();
        await knex('categories').del();
        await knex('ledger_entries').del();
        await knex('accounts').del();
        await knex('account_groups').del();
        await knex('users').del();
        await knex('sequences').del();
        await knex('settings').del();
    }

    // =====================================================
    // 1. CREATE USERS
    // =====================================================
    const adminHash = await bcrypt.hash('admin123', 10);
    const cashierHash = await bcrypt.hash('cashier123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);

    const [adminUser, cashierUser, managerUser] = await knex('users').insert([
        {
            username: 'admin',
            password_hash: adminHash,
            full_name: 'Administrator',
            email: 'admin@zync-erp.local',
            phone: '0300-1000000',
            role: 'admin',
            is_active: true
        },
        {
            username: 'cashier',
            password_hash: cashierHash,
            full_name: 'Cashier User',
            email: 'cashier@zync-erp.local',
            phone: '0300-2000000',
            role: 'cashier',
            is_active: true
        },
        {
            username: 'manager',
            password_hash: managerHash,
            full_name: 'Manager User',
            email: 'manager@zync-erp.local',
            phone: '0300-3000000',
            role: 'manager',
            is_active: true
        }
    ]).returning('id');

    // =====================================================
    // 2. CREATE ACCOUNT GROUPS (Chart of Accounts)
    // =====================================================
    const accountGroupResults = await knex('account_groups').insert([
        // Assets
        { name: 'Bank Accounts', type: 'asset', sequence: 1, is_system: true },
        { name: 'Cash', type: 'asset', sequence: 2, is_system: true },
        { name: 'Inventory', type: 'asset', sequence: 3, is_system: true },
        { name: 'Receivables', type: 'asset', sequence: 4, is_system: true },
        // Liabilities
        { name: 'Payables', type: 'liability', sequence: 10, is_system: true },
        { name: 'Bank Loans', type: 'liability', sequence: 11, is_system: true },
        // Income
        { name: 'Sales Revenue', type: 'income', sequence: 20, is_system: true },
        // Expenses
        { name: 'Cost of Goods Sold', type: 'expense', sequence: 30, is_system: true },
        { name: 'Operating Expenses', type: 'expense', sequence: 31, is_system: true },
        // Capital
        { name: 'Owner Capital', type: 'capital', sequence: 40, is_system: true }
    ]).returning('id');
    const accountGroups = accountGroupResults.map(row => row.id || row);

    // =====================================================
    // 3. CREATE CHART OF ACCOUNTS
    // =====================================================
    const accountResults = await knex('accounts').insert([
        // Bank & Cash
        { code: '1001', name: 'Cash in Hand', group_id: accountGroups[1], account_type: 'asset', is_system: true, is_active: true, opening_balance: 100000, current_balance: 100000 },
        { code: '1002', name: 'Bank Account', group_id: accountGroups[0], account_type: 'asset', is_bank_account: true, bank_name: 'Default Bank', is_system: true, is_active: true, opening_balance: 500000, current_balance: 500000 },
        // Inventory
        { code: '1004', name: 'Inventory', group_id: accountGroups[2], account_type: 'asset', is_system: true, is_active: true, opening_balance: 0, current_balance: 0 },
        // Receivables
        { code: '1201', name: 'Customer Receivables', group_id: accountGroups[3], account_type: 'asset', is_system: true, is_active: true, opening_balance: 0, current_balance: 0 },
        // Payables
        { code: '2001', name: 'Supplier Payables', group_id: accountGroups[4], account_type: 'liability', is_system: true, is_active: true, opening_balance: 0, current_balance: 0 },
        // Sales
        { code: '4001', name: 'Sales Income', group_id: accountGroups[6], account_type: 'income', is_system: true, is_active: true, opening_balance: 0, current_balance: 0 },
        { code: '4002', name: 'Sales Discount', group_id: accountGroups[6], account_type: 'income', is_system: true, is_active: true, opening_balance: 0, current_balance: 0 },
        // COGS
        { code: '5001', name: 'Cost of Goods Sold', group_id: accountGroups[7], account_type: 'expense', is_system: true, is_active: true, opening_balance: 0, current_balance: 0 },
        // Operating Expenses
        { code: '6001', name: 'Salaries & Wages', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true },
        { code: '6002', name: 'Rent & Utilities', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true },
        { code: '6003', name: 'Marketing & Advertising', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true },
        // Capital
        { code: '3001', name: 'Owner Capital', group_id: accountGroups[9], account_type: 'capital', is_system: true, is_active: true, opening_balance: 600000, current_balance: 600000 }
    ]).returning('id');
    const accounts = accountResults.map(row => row.id || row);

    // =====================================================
    // 4. CREATE UNITS OF MEASURE
    // =====================================================
    const unitResults = await knex('units').insert([
        { name: 'Piece', abbreviation: 'pcs' },
        { name: 'Kilogram', abbreviation: 'kg' },
        { name: 'Liter', abbreviation: 'ltr' },
        { name: 'Box', abbreviation: 'box' },
        { name: 'Pack', abbreviation: 'pack' },
        { name: 'Dozen', abbreviation: 'dz' },
        { name: 'Meter', abbreviation: 'm' },
        { name: 'Square Meter', abbreviation: 'sqm' }
    ]).returning('id');
    const units = unitResults.map(row => row.id || row);

    // =====================================================
    // 5. CREATE CATEGORIES
    // =====================================================
    const categoriesResults = await knex('categories').insert([
        { name: 'Electronics', description: 'Electronic products' },
        { name: 'Clothing', description: 'Apparel and clothing' },
        { name: 'Groceries', description: 'Grocery items' },
        { name: 'Home & Garden', description: 'Home and garden products' },
        { name: 'Sports & Outdoors', description: 'Sports equipment' }
    ]).returning('id');
    const categories = categoriesResults.map(row => row.id || row);

    // =====================================================
    // 6. CREATE COMPANIES/BRANDS
    // =====================================================
    const companiesResults = await knex('companies').insert([
        { name: 'Generic Brand', description: 'Generic/Store brand' },
        { name: 'Premium Brand', description: 'Premium quality brand' },
        { name: 'Budget Brand', description: 'Budget-friendly brand' }
    ]).returning('id');
    const companies = companiesResults.map(row => row.id || row);

    // =====================================================
    // 7. CREATE SAMPLE PRODUCTS
    // =====================================================
    const productsResults = await knex('products').insert([
        {
            code: 'SKU001',
            barcode: '123456789001',
            name: 'USB Cable (2m)',
            description: 'High-quality USB 2.0 cable',
            category_id: categories[0],
            company_id: companies[0],
            unit_id: units[0],
            retail_price: 250,
            wholesale_price: 200,
            cost_price: 150,
            min_stock_level: 10,
            track_stock: true,
            is_active: true
        },
        {
            code: 'SKU002',
            barcode: '123456789002',
            name: 'Wireless Mouse',
            description: '2.4GHz wireless mouse',
            category_id: categories[0],
            company_id: companies[1],
            unit_id: units[0],
            retail_price: 1500,
            wholesale_price: 1200,
            cost_price: 900,
            min_stock_level: 5,
            track_stock: true,
            is_active: true
        },
        {
            code: 'SKU003',
            barcode: '123456789003',
            name: 'T-Shirt (Cotton)',
            description: '100% cotton t-shirt',
            category_id: categories[1],
            company_id: companies[2],
            unit_id: units[0],
            retail_price: 800,
            wholesale_price: 600,
            cost_price: 400,
            min_stock_level: 20,
            track_stock: true,
            is_active: true
        },
        {
            code: 'SKU004',
            barcode: '123456789004',
            name: 'Rice (1kg)',
            description: 'Basmati rice 1kg pack',
            category_id: categories[2],
            company_id: companies[0],
            unit_id: units[1],
            retail_price: 350,
            wholesale_price: 300,
            cost_price: 250,
            min_stock_level: 50,
            track_stock: true,
            is_active: true
        },
        {
            code: 'SKU005',
            barcode: '123456789005',
            name: 'Coffee (500g)',
            description: 'Premium coffee beans',
            category_id: categories[2],
            company_id: companies[1],
            unit_id: units[1],
            retail_price: 1200,
            wholesale_price: 1000,
            cost_price: 750,
            min_stock_level: 10,
            track_stock: true,
            is_active: true
        }
    ]).returning('id');
    const products = productsResults.map(row => row.id || row);

    // =====================================================
    // 7A. CREATE INITIAL STOCK MOVEMENTS (CRITICAL!)
    // =====================================================
    // Initialize inventory for each product
    await knex('stock_movements').insert([
        {
            product_id: products[0],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 100,
            unit_cost: 150,
            remaining_qty: 100,
            notes: 'Initial stock load'
        },
        {
            product_id: products[1],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 50,
            unit_cost: 900,
            remaining_qty: 50,
            notes: 'Initial stock load'
        },
        {
            product_id: products[2],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 200,
            unit_cost: 400,
            remaining_qty: 200,
            notes: 'Initial stock load'
        },
        {
            product_id: products[3],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 500,
            unit_cost: 250,
            remaining_qty: 500,
            notes: 'Initial stock load'
        },
        {
            product_id: products[4],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 75,
            unit_cost: 750,
            remaining_qty: 75,
            notes: 'Initial stock load'
        }
    ]);



    // =====================================================
    // 8. CREATE SAMPLE CUSTOMERS
    // =====================================================
    const customersResults = await knex('customers').insert([
        {
            code: 'CUST001',
            name: 'Ahmed Khan',
            phone: '0300-1111111',
            phone_alt: '0321-1111111',
            email: 'ahmed@example.com',
            address: '123 Main Street',
            city: 'Karachi',
            credit_limit: 50000,
            opening_balance: 0,
            account_id: accounts[3],
            is_active: true
        },
        {
            code: 'CUST002',
            name: 'Fatima Ali',
            phone: '0300-2222222',
            email: 'fatima@example.com',
            address: '456 Market Road',
            city: 'Lahore',
            credit_limit: 75000,
            opening_balance: 0,
            account_id: accounts[3],
            is_active: true
        },
        {
            code: 'CUST003',
            name: 'Muhammad Hassan',
            phone: '0300-3333333',
            email: 'hassan@example.com',
            address: '789 Business Park',
            city: 'Islamabad',
            credit_limit: 100000,
            opening_balance: 0,
            account_id: accounts[3],
            is_active: true
        }
    ]).returning('id');
    const customers = customersResults.map(row => row.id || row);

    // =====================================================
    // 9. CREATE SAMPLE SUPPLIERS
    // =====================================================
    const suppliersResults = await knex('suppliers').insert([
        {
            code: 'SUPP001',
            name: 'Tech Imports Ltd',
            phone: '021-111-2222',
            email: 'contact@techimports.com',
            address: '100 Industrial Area',
            city: 'Karachi',
            contact_person: 'Ali Malik',
            opening_balance: 0,
            account_id: accounts[4],
            is_active: true
        },
        {
            code: 'SUPP002',
            name: 'Fashion Wholesale Co',
            phone: '042-333-4444',
            email: 'sales@fashionco.com',
            address: '200 Trade Center',
            city: 'Lahore',
            contact_person: 'Sana Sardar',
            opening_balance: 0,
            account_id: accounts[4],
            is_active: true
        },
        {
            code: 'SUPP003',
            name: 'Agricultural Exports',
            phone: '051-555-6666',
            email: 'info@agexports.com',
            address: '300 Export Zone',
            city: 'Islamabad',
            contact_person: 'Malik Muhammad',
            opening_balance: 0,
            account_id: accounts[4],
            is_active: true
        }
    ]).returning('id');
    const suppliers = suppliersResults.map(row => row.id || row);

    // =====================================================
    // 10. CREATE EXPENSE CATEGORIES
    // =====================================================
    await knex('expense_categories').insert([
        { name: 'Salaries', account_id: accounts[8] },
        { name: 'Rent', account_id: accounts[9] },
        { name: 'Utilities', account_id: accounts[9] },
        { name: 'Marketing', account_id: accounts[10] },
        { name: 'Transportation', account_id: accounts[10] },
        { name: 'Office Supplies', account_id: accounts[10] }
    ]);

    // =====================================================
    // 11. CREATE SEQUENCES FOR AUTO-NUMBERING
    // =====================================================
    await knex('sequences').insert([
        { name: 'invoice_number', prefix: 'INV', current_value: 0, pad_length: 6, reset_yearly: true },
        { name: 'bill_number', prefix: 'BILL', current_value: 0, pad_length: 6, reset_yearly: true },
        { name: 'journal_number', prefix: 'JNL', current_value: 0, pad_length: 6, reset_yearly: false },
        { name: 'quotation_number', prefix: 'QT', current_value: 0, pad_length: 6, reset_yearly: false },
        { name: 'challan_number', prefix: 'CH', current_value: 0, pad_length: 6, reset_yearly: false },
        { name: 'expense_number', prefix: 'EXP', current_value: 0, pad_length: 6, reset_yearly: false }
    ]);

    // =====================================================
    // 12. CREATE SETTINGS
    // =====================================================
    await knex('settings').insert([
        { key: 'company_name', value: 'ZYNC ERP', type: 'string', description: 'Business name' },
        { key: 'company_phone', value: '0300-0000000', type: 'string', description: 'Business phone' },
        { key: 'company_email', value: 'info@zync-erp.com', type: 'string', description: 'Business email' },
        { key: 'business_tax_id', value: '', type: 'string', description: 'Tax/NTN number' },
        { key: 'financial_year_start', value: '01-01', type: 'string', description: 'Financial year start date (MM-DD)' },
        { key: 'default_tax_rate', value: '0', type: 'number', description: 'Default tax percentage' },
        { key: 'currency_symbol', value: 'Rs.', type: 'string', description: 'Currency symbol' },
        { key: 'currency_code', value: 'PKR', type: 'string', description: 'Currency code' },
        { key: 'decimal_places', value: '2', type: 'number', description: 'Decimal places for amounts' },
        { key: 'enable_discounts', value: 'true', type: 'boolean', description: 'Allow line item discounts' }
    ]);

    console.log('✓ Database seeded successfully');
    console.log('✓ Default users created (admin/admin123, cashier/cashier123, manager/manager123)');
    console.log('✓ Chart of accounts initialized');
    console.log('✓ Sample products, customers, and suppliers created');
};
