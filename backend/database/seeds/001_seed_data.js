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
        await knex('categories').del();
        await knex('ledger_entries').del();
        await knex('accounts').del();
        await knex('account_groups').del();
        await knex('users').del();
        await knex('sequences').del();
    }

    // =====================================================
    // 0. GET OR CREATE DEFAULT TENANT
    // =====================================================
    let defaultTenant = await knex('tenants').where('slug', 'default').first();
    if (!defaultTenant) {
        [defaultTenant] = await knex('tenants').insert({
            name: 'Default Tenant',
            slug: 'default',
            is_active: true,
            plan: 'enterprise',
            max_users: 100
        }).returning('*');
    }
    const tid = defaultTenant.id || defaultTenant;

    // Skip seed if data already exists
    const existingAdmin = await knex('users').where('username', 'admin').first();
    if (existingAdmin) {
        console.log('✓ Data already seeded, skipping...');
        return;
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
            phone_number: '+923001000000',
            role: 'admin',
            is_active: true,
            tenant_id: tid
        },
        {
            username: 'cashier',
            password_hash: cashierHash,
            full_name: 'Cashier User',
            email: 'cashier@zync-erp.local',
            phone_number: '+923002000000',
            role: 'cashier',
            is_active: true,
            tenant_id: tid
        },
        {
            username: 'manager',
            password_hash: managerHash,
            full_name: 'Manager User',
            email: 'manager@zync-erp.local',
            phone_number: '+923003000000',
            role: 'manager',
            is_active: true,
            tenant_id: tid
        }
    ]).returning('id');

    // =====================================================
    // 2. CREATE ACCOUNT GROUPS (Chart of Accounts)
    // =====================================================
    const accountGroupResults = await knex('account_groups').insert([
        { name: 'Bank Accounts', account_type: 'asset', code: '1100', sequence_order: 1, is_system: true, tenant_id: tid },
        { name: 'Cash', account_type: 'asset', code: '1000', sequence_order: 2, is_system: true, tenant_id: tid },
        { name: 'Inventory', account_type: 'asset', code: '1400', sequence_order: 3, is_system: true, tenant_id: tid },
        { name: 'Receivables', account_type: 'asset', code: '1200', sequence_order: 4, is_system: true, tenant_id: tid },
        { name: 'Payables', account_type: 'liability', code: '2000', sequence_order: 10, is_system: true, tenant_id: tid },
        { name: 'Bank Loans', account_type: 'liability', code: '2100', sequence_order: 11, is_system: true, tenant_id: tid },
        { name: 'Sales Revenue', account_type: 'income', code: '4000', sequence_order: 20, is_system: true, tenant_id: tid },
        { name: 'Cost of Goods Sold', account_type: 'expense', code: '5000', sequence_order: 30, is_system: true, tenant_id: tid },
        { name: 'Operating Expenses', account_type: 'expense', code: '6000', sequence_order: 31, is_system: true, tenant_id: tid },
        { name: 'Owner Capital', account_type: 'equity', code: '3000', sequence_order: 40, is_system: true, tenant_id: tid }
    ]).returning('id');
    const accountGroups = accountGroupResults.map(row => row.id || row);

    // =====================================================
    // 3. CREATE CHART OF ACCOUNTS
    // =====================================================
    const accountResults = await knex('accounts').insert([
        { code: '1001', name: 'Cash in Hand', group_id: accountGroups[1], account_type: 'asset', is_system: true, is_active: true, opening_balance: 100000, current_balance: 100000, tenant_id: tid },
        { code: '1002', name: 'Bank Account', group_id: accountGroups[0], account_type: 'asset', is_bank_account: true, bank_name: 'Default Bank', is_system: true, is_active: true, opening_balance: 500000, current_balance: 500000, tenant_id: tid },
        { code: '1004', name: 'Inventory', group_id: accountGroups[2], account_type: 'asset', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '1201', name: 'Customer Receivables', group_id: accountGroups[3], account_type: 'asset', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '2001', name: 'Supplier Payables', group_id: accountGroups[4], account_type: 'liability', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '2100', name: 'Bank Loans', group_id: accountGroups[5], account_type: 'liability', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '4001', name: 'Sales Income', group_id: accountGroups[6], account_type: 'income', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '4002', name: 'Sales Discount', group_id: accountGroups[6], account_type: 'income', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '5001', name: 'Cost of Goods Sold', group_id: accountGroups[7], account_type: 'expense', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '6001', name: 'Salaries & Wages', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
        { code: '6002', name: 'Rent & Utilities', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
        { code: '6003', name: 'Interest Expense', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
        { code: '6006', name: 'Marketing & Advertising', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
        { code: '6200', name: 'Late Payment Penalty', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
        { code: '3001', name: 'Owner Capital', group_id: accountGroups[9], account_type: 'equity', is_system: true, is_active: true, opening_balance: 600000, current_balance: 600000, tenant_id: tid },
        { code: '3002', name: 'Retained Earnings', group_id: accountGroups[9], account_type: 'equity', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid },
        { code: '3003', name: 'Owner Drawings', group_id: accountGroups[9], account_type: 'equity', is_system: true, is_active: true, opening_balance: 0, current_balance: 0, tenant_id: tid }
    ]).returning('id');
    const accounts = accountResults.map(row => row.id || row);

    const [transportationAccount, officeSuppliesAccount] = await knex('accounts').insert([
        { code: '6004', name: 'Transportation Expense', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
        { code: '6005', name: 'Office Supplies', group_id: accountGroups[8], account_type: 'expense', is_system: true, is_active: true, tenant_id: tid },
    ]).returning('id');

    // =====================================================
    // 4. CREATE UNITS OF MEASURE
    // =====================================================
    const unitResults = await knex('units').insert([
        { name: 'Piece', abbreviation: 'pcs', tenant_id: tid },
        { name: 'Kilogram', abbreviation: 'kg', tenant_id: tid },
        { name: 'Liter', abbreviation: 'ltr', tenant_id: tid },
        { name: 'Box', abbreviation: 'box', tenant_id: tid },
        { name: 'Pack', abbreviation: 'pack', tenant_id: tid },
        { name: 'Dozen', abbreviation: 'dz', tenant_id: tid },
        { name: 'Meter', abbreviation: 'm', tenant_id: tid },
        { name: 'Square Meter', abbreviation: 'sqm', tenant_id: tid }
    ]).returning('id');
    const units = unitResults.map(row => row.id || row);

    // =====================================================
    // 5. CREATE CATEGORIES
    // =====================================================
    const categoriesResults = await knex('categories').insert([
        { name: 'Electronics', description: 'Electronic products', tenant_id: tid },
        { name: 'Clothing', description: 'Apparel and clothing', tenant_id: tid },
        { name: 'Groceries', description: 'Grocery items', tenant_id: tid },
        { name: 'Home & Garden', description: 'Home and garden products', tenant_id: tid },
        { name: 'Sports & Outdoors', description: 'Sports equipment', tenant_id: tid }
    ]).returning('id');
    const categories = categoriesResults.map(row => row.id || row);

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
            unit_id: units[0],
            retail_price: 250,
            wholesale_price: 200,
            cost_price: 150,
            min_stock_level: 10,
            track_stock: true,
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'SKU002',
            barcode: '123456789002',
            name: 'Wireless Mouse',
            description: '2.4GHz wireless mouse',
            category_id: categories[0],
            unit_id: units[0],
            retail_price: 1500,
            wholesale_price: 1200,
            cost_price: 900,
            min_stock_level: 5,
            track_stock: true,
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'SKU003',
            barcode: '123456789003',
            name: 'T-Shirt (Cotton)',
            description: '100% cotton t-shirt',
            category_id: categories[1],
            unit_id: units[0],
            retail_price: 800,
            wholesale_price: 600,
            cost_price: 400,
            min_stock_level: 20,
            track_stock: true,
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'SKU004',
            barcode: '123456789004',
            name: 'Rice (1kg)',
            description: 'Basmati rice 1kg pack',
            category_id: categories[2],
            unit_id: units[1],
            retail_price: 350,
            wholesale_price: 300,
            cost_price: 250,
            min_stock_level: 50,
            track_stock: true,
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'SKU005',
            barcode: '123456789005',
            name: 'Coffee (500g)',
            description: 'Premium coffee beans',
            category_id: categories[2],
            unit_id: units[1],
            retail_price: 1200,
            wholesale_price: 1000,
            cost_price: 750,
            min_stock_level: 10,
            track_stock: true,
            is_active: true,
            tenant_id: tid
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
            notes: 'Initial stock load',
            tenant_id: tid
        },
        {
            product_id: products[1],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 50,
            unit_cost: 900,
            remaining_qty: 50,
            notes: 'Initial stock load',
            tenant_id: tid
        },
        {
            product_id: products[2],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 200,
            unit_cost: 400,
            remaining_qty: 200,
            notes: 'Initial stock load',
            tenant_id: tid
        },
        {
            product_id: products[3],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 500,
            unit_cost: 250,
            remaining_qty: 500,
            notes: 'Initial stock load',
            tenant_id: tid
        },
        {
            product_id: products[4],
            movement_type: 'IN',
            reference_type: 'opening',
            reference_id: null,
            quantity: 75,
            unit_cost: 750,
            remaining_qty: 75,
            notes: 'Initial stock load',
            tenant_id: tid
        }
    ]);



    // =====================================================
    // 8. CREATE SAMPLE CUSTOMERS
    // =====================================================
    const customersResults = await knex('customers').insert([
        {
            code: 'CUST001',
            name: 'Ahmed Khan',
            phone_number: '+923001111111',
            phone_number_alt: '+923211111111',
            email: 'ahmed@example.com',
            address_line1: '123 Main Street',
            city: 'Karachi',
            country: 'Pakistan',
            credit_limit: 50000,
            opening_balance: 0,
            account_id: accounts[3],
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'CUST002',
            name: 'Fatima Ali',
            phone_number: '+923002222222',
            email: 'fatima@example.com',
            address_line1: '456 Market Road',
            city: 'Lahore',
            country: 'Pakistan',
            credit_limit: 75000,
            opening_balance: 0,
            account_id: accounts[3],
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'CUST003',
            name: 'Muhammad Hassan',
            phone_number: '+923003333333',
            email: 'hassan@example.com',
            address_line1: '789 Business Park',
            city: 'Islamabad',
            country: 'Pakistan',
            credit_limit: 100000,
            opening_balance: 0,
            account_id: accounts[3],
            is_active: true,
            tenant_id: tid
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
            phone_number: '+923001112222',
            email: 'contact@techimports.com',
            address_line1: '100 Industrial Area',
            city: 'Karachi',
            country: 'Pakistan',
            contact_person: 'Ali Malik',
            opening_balance: 0,
            account_id: accounts[4],
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'SUPP002',
            name: 'Fashion Wholesale Co',
            phone_number: '+923003334444',
            email: 'sales@fashionco.com',
            address_line1: '200 Trade Center',
            city: 'Lahore',
            country: 'Pakistan',
            contact_person: 'Sana Sardar',
            opening_balance: 0,
            account_id: accounts[4],
            is_active: true,
            tenant_id: tid
        },
        {
            code: 'SUPP003',
            name: 'Agricultural Exports',
            phone_number: '+923005556666',
            email: 'info@agexports.com',
            address_line1: '300 Export Zone',
            city: 'Islamabad',
            country: 'Pakistan',
            contact_person: 'Malik Muhammad',
            opening_balance: 0,
            account_id: accounts[4],
            is_active: true,
            tenant_id: tid
        }
    ]).returning('id');
    const suppliers = suppliersResults.map(row => row.id || row);

    // =====================================================
    // 10. CREATE EXPENSE CATEGORIES
    // =====================================================
    await knex('expense_categories').insert([
        { name: 'Salaries', account_id: accounts[9], tenant_id: tid },
        { name: 'Rent', account_id: accounts[10], tenant_id: tid },
        { name: 'Utilities', account_id: accounts[10], tenant_id: tid },
        { name: 'Marketing', account_id: accounts[12], tenant_id: tid },
        { name: 'Transportation', account_id: transportationAccount.id || transportationAccount, tenant_id: tid },
        { name: 'Office Supplies', account_id: officeSuppliesAccount.id || officeSuppliesAccount, tenant_id: tid }
    ]);

    // =====================================================
    // 11. CREATE SEQUENCES FOR AUTO-NUMBERING
    // =====================================================
    await knex('sequences').insert([
        { name: 'invoice', prefix: 'INV-', current_value: 0, pad_length: 6, tenant_id: tid },
        { name: 'purchase', prefix: 'PUR-', current_value: 0, pad_length: 6, tenant_id: tid },
        { name: 'journal', prefix: 'JRN-', current_value: 0, pad_length: 6, tenant_id: tid },
        { name: 'quotation', prefix: 'QT-', current_value: 0, pad_length: 6, tenant_id: tid },
        { name: 'expense', prefix: 'EXP-', current_value: 0, pad_length: 6, tenant_id: tid },
        { name: 'challan', prefix: 'CH-', current_value: 0, pad_length: 6, tenant_id: tid },
        { name: 'supplier', prefix: 'SUP-', current_value: 0, pad_length: 4, tenant_id: tid },
        { name: 'customer', prefix: 'CUST-', current_value: 0, pad_length: 4, tenant_id: tid }
    ]);

    console.log('✓ Database seeded successfully');
    console.log('✓ Default users created (admin/admin123, cashier/cashier123, manager/manager123)');
    console.log('✓ Chart of accounts initialized');
    console.log('✓ Sample products, customers, and suppliers created');
};
