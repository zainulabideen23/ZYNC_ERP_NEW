const knex = require('../src/config/database');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

async function migrate() {
    console.log('🚀 Starting Data Migration to Professional Schema...');

    try {
        // 1. Create Default Admin User
        console.log('Creating default admin user...');
        const passwordHash = await bcrypt.hash('admin123', 10);
        const [adminUser] = await knex('users').insert({
            username: 'admin',
            password_hash: passwordHash,
            full_name: 'System Administrator',
            email: 'admin@zyncerp.com',
            phone_number: '03000000000',
            role: 'admin',
            is_active: true,
            is_superuser: true
        }).returning('*');

        const adminId = adminUser.id;

        // 2. Create Units
        console.log('Creating units...');
        const unitData = [
            { name: 'Piece', abbreviation: 'pcs', description: 'Individual items' },
            { name: 'Kilogram', abbreviation: 'kg', description: 'Weight measurement' },
            { name: 'Liter', abbreviation: 'ltr', description: 'Volume measurement' },
            { name: 'Box', abbreviation: 'box', description: 'Box packaging' },
            { name: 'Pack', abbreviation: 'pack', description: 'Package unit' },
            { name: 'Dozen', abbreviation: 'dz', description: '12 items' },
            { name: 'Meter', abbreviation: 'm', description: 'Length measurement' },
            { name: 'Square Meter', abbreviation: 'sqm', description: 'Area measurement' }
        ];
        const units = await knex('units').insert(unitData).returning('*');
        const unitMap = units.reduce((acc, u) => ({ ...acc, [u.abbreviation]: u.id }), {});

        // 3. Create Categories
        console.log('Creating categories...');
        const catData = [
            { name: 'Electronics', description: 'Electronic products', sequence_order: 1 },
            { name: 'Furniture', description: 'Furniture and fixtures', sequence_order: 2 },
            { name: 'Apparel', description: 'Clothing and textiles', sequence_order: 3 },
            { name: 'Food & Beverage', description: 'Grocery and consumables', sequence_order: 4 },
            { name: 'Hardware', description: 'Hardware and tools', sequence_order: 5 }
        ];
        const categories = await knex('categories').insert(catData).returning('*');
        const catMap = categories.reduce((acc, c) => ({ ...acc, [c.name]: c.id }), {});

        // 4. Create Account Groups
        console.log('Creating account groups...');
        const groups = [
            { account_type: 'asset', name: 'Current Assets', is_system: true, created_by: adminId },
            { account_type: 'asset', name: 'Fixed Assets', is_system: true, created_by: adminId },
            { account_type: 'liability', name: 'Current Liabilities', is_system: true, created_by: adminId },
            { account_type: 'equity', name: 'Equity', is_system: true, created_by: adminId },
            { account_type: 'income', name: 'Operating Income', is_system: true, created_by: adminId },
            { account_type: 'expense', name: 'Direct Expenses', is_system: true, created_by: adminId },
            { account_type: 'expense', name: 'Indirect Expenses', is_system: true, created_by: adminId }
        ];
        const insertedGroups = await knex('account_groups').insert(groups).returning('*');
        const groupMap = insertedGroups.reduce((acc, g) => ({ ...acc, [g.name]: g.id }), {});

        // 5. Create Default Accounts
        console.log('Creating default accounts...');
        const accounts = [
            { code: '1001', name: 'Cash in Hand', account_type: 'asset', group_id: groupMap['Current Assets'], created_by: adminId, is_system: true },
            { code: '1002', name: 'Bank Account', account_type: 'asset', group_id: groupMap['Current Assets'], created_by: adminId, is_system: true, is_bank_account: true, bank_name: 'Main Bank' },
            { code: '1004', name: 'Inventory', account_type: 'asset', group_id: groupMap['Current Assets'], created_by: adminId, is_system: true },
            { code: '1201', name: 'Customer Receivables', account_type: 'asset', group_id: groupMap['Current Assets'], created_by: adminId, is_system: true },
            { code: '2001', name: 'Supplier Payables', account_type: 'liability', group_id: groupMap['Current Liabilities'], created_by: adminId, is_system: true },
            { code: '3001', name: 'Owner Capital', account_type: 'equity', group_id: groupMap['Equity'], created_by: adminId, is_system: true },
            { code: '4001', name: 'Sales Income', account_type: 'income', group_id: groupMap['Operating Income'], created_by: adminId, is_system: true },
            { code: '5001', name: 'Cost of Goods Sold', account_type: 'expense', group_id: groupMap['Direct Expenses'], created_by: adminId, is_system: true },
            { code: '6001', name: 'Salaries & Wages', account_type: 'expense', group_id: groupMap['Indirect Expenses'], created_by: adminId, is_system: true },
            { code: '6002', name: 'Rent & Utilities', account_type: 'expense', group_id: groupMap['Indirect Expenses'], created_by: adminId, is_system: true }
        ];
        await knex('accounts').insert(accounts);

        // 6. Create Company Info
        console.log('Creating company info...');
        await knex('company_info').insert({
            company_name: 'ZYNC ERP Solutions',
            tax_id: 'NTN-1234567-8',
            email: 'contact@zyncerp.com',
            phone_number: '03001234567',
            address_line1: 'Main Business District',
            city: 'Faisalabad',
            country: 'Pakistan',
            default_tax_rate: 18.00
        });

        // 7. Migrate Products
        console.log('Migrating products from backup...');
        const backupPath = path.join(__dirname, '../logs/pre_migration_backup.json');
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

        for (const p of backupData.products) {
            // Map category
            let categoryId = catMap['Electronics']; // Default
            if (p.tags.includes('furniture')) categoryId = catMap['Furniture'];
            else if (p.tags.includes('apparel')) categoryId = catMap['Apparel'];
            else if (p.tags.includes('food')) categoryId = catMap['Food & Beverage'];
            else if (p.tags.includes('hardware')) categoryId = catMap['Hardware'];

            // Map unit
            const unitId = unitMap[p.weight_unit === 'kg' && p.code.includes('RICE') ? 'kg' : 'pcs'] || unitMap['pcs'];

            const [newProduct] = await knex('products').insert({
                code: p.code,
                barcode: p.barcode,
                name: p.name,
                description: p.description,
                category_id: categoryId,
                unit_id: unitId,
                cost_price: parseFloat(p.cost_price),
                retail_price: parseFloat(p.retail_price),
                wholesale_price: p.wholesale_price ? parseFloat(p.wholesale_price) : null,
                tax_rate: parseFloat(p.tax_rate || 0),
                min_stock_level: parseInt(parseFloat(p.min_stock_level || 0)),
                current_stock: 0, // Will be updated by movements
                weight: parseFloat(p.weight || 0),
                dimensions: p.dimensions,
                created_by: adminId
            }).returning('*');

            // Opening stock movement if it was present
            // We'll assume the opening stock from dummy_products.json as a reference
            // since stock_movements in old DB might be mixed.
        }

        console.log('✅ Data migration completed successfully!');
    } catch (error) {
        console.error('❌ Data migration failed:', error);
    } finally {
        process.exit(0);
    }
}

migrate();
burial_place: Date.now()
