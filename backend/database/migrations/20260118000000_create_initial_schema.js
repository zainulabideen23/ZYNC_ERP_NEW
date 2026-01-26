/**
 * ZYNC-ERP: Complete Database Schema Migration
 * PostgreSQL 15+
 * 
 * This migration creates all core tables, enums, indexes, and relationships
 */

exports.up = async function (knex) {
    // Enable UUID extension
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // =====================================================
    // CREATE ENUMS
    // =====================================================
    
    await knex.schema.raw(`
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier', 'viewer');
        CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
        CREATE TYPE sale_status AS ENUM ('completed', 'cancelled', 'returned');
        CREATE TYPE purchase_status AS ENUM ('completed', 'cancelled', 'returned');
        CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT');
        CREATE TYPE reference_type AS ENUM ('sale', 'purchase', 'adjustment', 'opening', 'return', 'transfer');
        CREATE TYPE payment_type AS ENUM ('receipt', 'payment');
        CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'cheque');
        CREATE TYPE account_type AS ENUM ('asset', 'liability', 'income', 'expense', 'capital');
        CREATE TYPE entry_type AS ENUM ('debit', 'credit');
        CREATE TYPE journal_type AS ENUM ('sales', 'purchase', 'receipt', 'payment', 'expense', 'general');
        CREATE TYPE ledger_reference_type AS ENUM ('sale', 'purchase', 'payment', 'expense', 'journal', 'opening');
        CREATE TYPE quotation_status AS ENUM ('draft', 'sent', 'converted', 'expired');
        CREATE TYPE challan_status AS ENUM ('pending', 'delivered');
        CREATE TYPE pass_type AS ENUM ('inward', 'outward');
        CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');
        CREATE TYPE setting_type AS ENUM ('string', 'number', 'boolean', 'json');
    `);

    // =====================================================
    // MASTER TABLES
    // =====================================================

    // Users table
    await knex.schema.createTable('users', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('username', 50).unique().notNullable();
        table.string('password_hash', 255).notNullable();
        table.string('full_name', 100).notNullable();
        table.string('email', 100).unique();
        table.string('phone', 20);
        table.enum('role', ['admin', 'manager', 'cashier', 'viewer']).notNullable().defaultTo('cashier');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('last_login', { useTz: true });
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true });
    });

    // Categories table (hierarchical)
    await knex.schema.createTable('categories', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 100).unique().notNullable();
        table.text('description');
        table.uuid('parent_id').references('id').inTable('categories').onDelete('SET NULL');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Companies/Brands table
    await knex.schema.createTable('companies', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 100).unique().notNullable();
        table.text('description');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Units of measure
    await knex.schema.createTable('units', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 50).unique().notNullable();
        table.string('abbreviation', 10).notNullable();
        table.boolean('is_active').notNullable().defaultTo(true);
    });

    // Account groups
    await knex.schema.createTable('account_groups', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 100).notNullable();
        table.enum('type', ['asset', 'liability', 'income', 'expense', 'capital']).notNullable();
        table.uuid('parent_id').references('id').inTable('account_groups').onDelete('SET NULL');
        table.integer('sequence');
        table.boolean('is_system').notNullable().defaultTo(false);
    });

    // Chart of Accounts
    await knex.schema.createTable('accounts', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('code', 20).unique().notNullable();
        table.string('name', 100).notNullable();
        table.uuid('group_id').notNullable().references('id').inTable('account_groups');
        table.enum('account_type', ['asset', 'liability', 'income', 'expense', 'capital']).notNullable();
        table.boolean('is_bank_account').notNullable().defaultTo(false);
        table.string('bank_name', 100);
        table.string('account_number', 50);
        table.decimal('opening_balance', 15, 2).notNullable().defaultTo(0);
        table.decimal('current_balance', 15, 2).notNullable().defaultTo(0);
        table.boolean('is_system').notNullable().defaultTo(false);
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Customers
    await knex.schema.createTable('customers', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('code', 20).unique();
        table.string('name', 200).notNullable();
        table.string('phone', 20);
        table.string('phone_alt', 20);
        table.string('email', 100);
        table.text('address');
        table.string('city', 100);
        table.string('cnic', 15);
        table.decimal('credit_limit', 15, 2).notNullable().defaultTo(0);
        table.decimal('opening_balance', 15, 2).notNullable().defaultTo(0);
        table.uuid('account_id').references('id').inTable('accounts');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true });
    });

    // Suppliers
    await knex.schema.createTable('suppliers', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('code', 20).unique();
        table.string('name', 200).notNullable();
        table.string('phone', 20);
        table.string('email', 100);
        table.text('address');
        table.string('city', 100);
        table.string('contact_person', 100);
        table.decimal('opening_balance', 15, 2).notNullable().defaultTo(0);
        table.uuid('account_id').references('id').inTable('accounts');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true });
    });

    // Products
    await knex.schema.createTable('products', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('code', 50).unique().notNullable();
        table.string('barcode', 50).unique();
        table.string('name', 200).notNullable();
        table.text('description');
        table.uuid('category_id').references('id').inTable('categories').onDelete('SET NULL');
        table.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
        table.uuid('unit_id').references('id').inTable('units');
        table.decimal('retail_price', 15, 2).notNullable();
        table.decimal('wholesale_price', 15, 2);
        table.decimal('cost_price', 15, 2);
        table.decimal('min_stock_level', 15, 3).notNullable().defaultTo(0);
        table.boolean('track_stock').notNullable().defaultTo(true);
        table.string('image_path', 500);
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true });
    });

    // =====================================================
    // TRANSACTION TABLES
    // =====================================================

    // Sales header
    await knex.schema.createTable('sales', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('invoice_number', 30).unique().notNullable();
        table.date('invoice_date').notNullable();
        table.uuid('customer_id').references('id').inTable('customers');
        table.decimal('subtotal', 15, 2).notNullable();
        table.decimal('discount_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('total_amount', 15, 2).notNullable();
        table.decimal('paid_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('balance_amount', 15, 2).generatedAlwaysAs(
            knex.raw('total_amount - paid_amount'), 'stored'
        );
        table.enum('payment_status', ['paid', 'partial', 'unpaid']).notNullable().defaultTo('unpaid');
        table.enum('status', ['completed', 'cancelled', 'returned']).notNullable().defaultTo('completed');
        table.text('notes');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true });
    });

    // Sale items
    await knex.schema.createTable('sale_items', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
        table.uuid('product_id').notNullable().references('id').inTable('products');
        table.decimal('quantity', 15, 3).notNullable();
        table.decimal('unit_price', 15, 2).notNullable();
        table.decimal('cost_price', 15, 2).notNullable();
        table.decimal('discount_percent', 5, 2).notNullable().defaultTo(0);
        table.decimal('discount_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('tax_percent', 5, 2).notNullable().defaultTo(0);
        table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('line_total', 15, 2).notNullable();
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Purchases header
    await knex.schema.createTable('purchases', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('bill_number', 30).unique().notNullable();
        table.date('bill_date').notNullable();
        table.uuid('supplier_id').references('id').inTable('suppliers');
        table.string('reference_number', 50);
        table.decimal('subtotal', 15, 2).notNullable();
        table.decimal('discount_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('total_amount', 15, 2).notNullable();
        table.decimal('paid_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('balance_amount', 15, 2).generatedAlwaysAs(
            knex.raw('total_amount - paid_amount'), 'stored'
        );
        table.enum('payment_status', ['paid', 'partial', 'unpaid']).notNullable().defaultTo('unpaid');
        table.enum('status', ['completed', 'cancelled', 'returned']).notNullable().defaultTo('completed');
        table.text('notes');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true });
    });

    // Purchase items
    await knex.schema.createTable('purchase_items', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('purchase_id').notNullable().references('id').inTable('purchases').onDelete('CASCADE');
        table.uuid('product_id').notNullable().references('id').inTable('products');
        table.decimal('quantity', 15, 3).notNullable();
        table.decimal('unit_cost', 15, 2).notNullable();
        table.decimal('discount_percent', 5, 2).notNullable().defaultTo(0);
        table.decimal('discount_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('tax_percent', 5, 2).notNullable().defaultTo(0);
        table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0);
        table.decimal('line_total', 15, 2).notNullable();
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Stock movements (CRITICAL for FIFO)
    await knex.schema.createTable('stock_movements', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('product_id').notNullable().references('id').inTable('products');
        table.enum('movement_type', ['IN', 'OUT', 'ADJUSTMENT']).notNullable();
        table.enum('reference_type', ['sale', 'purchase', 'adjustment', 'opening', 'return', 'transfer']).notNullable();
        table.uuid('reference_id');
        table.decimal('quantity', 15, 3).notNullable();
        table.decimal('unit_cost', 15, 2).notNullable();
        table.decimal('remaining_qty', 15, 3);
        table.text('notes');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Payments
    await knex.schema.createTable('payments', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.enum('payment_type', ['receipt', 'payment']).notNullable();
        table.enum('payment_method', ['cash', 'bank', 'cheque']).notNullable();
        table.string('reference_type', 20).notNullable();
        table.uuid('reference_id').notNullable();
        table.decimal('amount', 15, 2).notNullable();
        table.date('payment_date').notNullable();
        table.uuid('bank_account_id').references('id').inTable('accounts');
        table.string('cheque_number', 50);
        table.text('notes');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // =====================================================
    // ACCOUNTING TABLES
    // =====================================================

    // Journals
    await knex.schema.createTable('journals', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('journal_number', 30).unique();
        table.date('journal_date').notNullable();
        table.enum('journal_type', ['sales', 'purchase', 'receipt', 'payment', 'expense', 'general']).notNullable();
        table.text('narration');
        table.boolean('is_posted').notNullable().defaultTo(true);
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Ledger entries (double-entry)
    await knex.schema.createTable('ledger_entries', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.date('entry_date').notNullable();
        table.uuid('account_id').notNullable().references('id').inTable('accounts');
        table.enum('entry_type', ['debit', 'credit']).notNullable();
        table.decimal('amount', 15, 2).notNullable();
        table.enum('reference_type', ['sale', 'purchase', 'payment', 'expense', 'journal', 'opening']).notNullable();
        table.uuid('reference_id');
        table.text('narration');
        table.uuid('journal_id').references('id').inTable('journals');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // =====================================================
    // EXPENSE TABLES
    // =====================================================

    // Expense categories
    await knex.schema.createTable('expense_categories', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 100).unique().notNullable();
        table.uuid('account_id').references('id').inTable('accounts');
        table.boolean('is_active').notNullable().defaultTo(true);
    });

    // Expenses
    await knex.schema.createTable('expenses', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('expense_number', 30).unique();
        table.date('expense_date').notNullable();
        table.uuid('category_id').references('id').inTable('expense_categories');
        table.decimal('amount', 15, 2).notNullable();
        table.enum('payment_method', ['cash', 'bank', 'cheque']).notNullable();
        table.uuid('bank_account_id').references('id').inTable('accounts');
        table.text('description');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // =====================================================
    // LOGISTICS TABLES
    // =====================================================

    // Quotations
    await knex.schema.createTable('quotations', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('quotation_number', 30).unique();
        table.date('quotation_date').notNullable();
        table.uuid('customer_id').references('id').inTable('customers');
        table.date('valid_until');
        table.decimal('total_amount', 15, 2);
        table.enum('status', ['draft', 'sent', 'converted', 'expired']).notNullable().defaultTo('draft');
        table.uuid('converted_to_sale_id').references('id').inTable('sales');
        table.text('notes');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Quotation items
    await knex.schema.createTable('quotation_items', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('quotation_id').notNullable().references('id').inTable('quotations').onDelete('CASCADE');
        table.uuid('product_id').notNullable().references('id').inTable('products');
        table.decimal('quantity', 15, 3).notNullable();
        table.decimal('unit_price', 15, 2).notNullable();
        table.decimal('discount_percent', 5, 2).notNullable().defaultTo(0);
        table.decimal('line_total', 15, 2).notNullable();
    });

    // Delivery challans
    await knex.schema.createTable('delivery_challans', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('challan_number', 30).unique();
        table.date('challan_date').notNullable();
        table.uuid('sale_id').references('id').inTable('sales');
        table.uuid('customer_id').references('id').inTable('customers');
        table.text('delivery_address');
        table.enum('status', ['pending', 'delivered']).notNullable().defaultTo('pending');
        table.timestamp('delivered_at', { useTz: true });
        table.text('notes');
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Gate passes
    await knex.schema.createTable('gate_passes', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('pass_number', 30).unique();
        table.date('pass_date').notNullable();
        table.enum('pass_type', ['inward', 'outward']).notNullable();
        table.string('reference_type', 20);
        table.uuid('reference_id');
        table.text('description');
        table.string('vehicle_number', 20);
        table.string('driver_name', 100);
        table.uuid('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // =====================================================
    // SUPPORT TABLES
    // =====================================================

    // Sequences for auto-numbering
    await knex.schema.createTable('sequences', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 50).unique().notNullable();
        table.string('prefix', 10);
        table.bigInteger('current_value').notNullable().defaultTo(0);
        table.integer('pad_length').notNullable().defaultTo(6);
        table.boolean('reset_yearly').notNullable().defaultTo(false);
        table.date('last_reset');
    });

    // Application settings
    await knex.schema.createTable('settings', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('key', 100).unique().notNullable();
        table.text('value');
        table.enum('type', ['string', 'number', 'boolean', 'json']).notNullable().defaultTo('string');
        table.text('description');
        table.timestamp('updated_at', { useTz: true });
    });

    // Audit logs
    await knex.schema.createTable('audit_logs', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').references('id').inTable('users');
        table.enum('action', ['create', 'update', 'delete']).notNullable();
        table.string('table_name', 50).notNullable();
        table.uuid('record_id').notNullable();
        table.jsonb('old_values');
        table.jsonb('new_values');
        table.string('ip_address', 45);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // =====================================================
    // CREATE INDEXES
    // =====================================================

    // Customer indexes
    await knex.schema.table('customers', (table) => {
        table.index('phone');
        table.index('name');
    });

    // Product indexes
    await knex.schema.table('products', (table) => {
        table.index('name');
        table.index('barcode');
        table.index('code');
        table.index('category_id');
        table.index('company_id');
    });

    // Sales indexes
    await knex.schema.table('sales', (table) => {
        table.index('invoice_date');
        table.index('customer_id');
        table.index('status');
    });

    await knex.schema.table('sale_items', (table) => {
        table.index('sale_id');
        table.index('product_id');
    });

    // Purchase indexes
    await knex.schema.table('purchases', (table) => {
        table.index('bill_date');
        table.index('supplier_id');
    });

    await knex.schema.table('purchase_items', (table) => {
        table.index('purchase_id');
    });

    // Stock movement indexes (CRITICAL)
    await knex.schema.table('stock_movements', (table) => {
        table.index(['product_id', 'created_at']);
        table.index('reference_type');
        table.index('reference_id');
    });

    // Ledger indexes
    await knex.schema.table('ledger_entries', (table) => {
        table.index(['account_id', 'entry_date']);
        table.index('reference_type');
        table.index('reference_id');
        table.index('journal_id');
    });

    // Payment indexes
    await knex.schema.table('payments', (table) => {
        table.index(['reference_type', 'reference_id']);
        table.index('payment_date');
    });

    // Audit log indexes
    await knex.schema.table('audit_logs', (table) => {
        table.index(['table_name', 'record_id']);
        table.index('user_id');
        table.index('created_at');
    });
};

exports.down = async function (knex) {
    // Drop all tables in reverse order
    await knex.schema.dropTableIfExists('audit_logs');
    await knex.schema.dropTableIfExists('settings');
    await knex.schema.dropTableIfExists('sequences');
    await knex.schema.dropTableIfExists('gate_passes');
    await knex.schema.dropTableIfExists('delivery_challans');
    await knex.schema.dropTableIfExists('quotation_items');
    await knex.schema.dropTableIfExists('quotations');
    await knex.schema.dropTableIfExists('expenses');
    await knex.schema.dropTableIfExists('expense_categories');
    await knex.schema.dropTableIfExists('ledger_entries');
    await knex.schema.dropTableIfExists('journals');
    await knex.schema.dropTableIfExists('payments');
    await knex.schema.dropTableIfExists('stock_movements');
    await knex.schema.dropTableIfExists('purchase_items');
    await knex.schema.dropTableIfExists('purchases');
    await knex.schema.dropTableIfExists('sale_items');
    await knex.schema.dropTableIfExists('sales');
    await knex.schema.dropTableIfExists('products');
    await knex.schema.dropTableIfExists('suppliers');
    await knex.schema.dropTableIfExists('customers');
    await knex.schema.dropTableIfExists('accounts');
    await knex.schema.dropTableIfExists('account_groups');
    await knex.schema.dropTableIfExists('units');
    await knex.schema.dropTableIfExists('companies');
    await knex.schema.dropTableIfExists('categories');
    await knex.schema.dropTableIfExists('users');

    // Drop enums
    await knex.schema.raw(`
        DROP TYPE IF EXISTS setting_type;
        DROP TYPE IF EXISTS audit_action;
        DROP TYPE IF EXISTS pass_type;
        DROP TYPE IF EXISTS challan_status;
        DROP TYPE IF EXISTS quotation_status;
        DROP TYPE IF EXISTS ledger_reference_type;
        DROP TYPE IF EXISTS journal_type;
        DROP TYPE IF EXISTS entry_type;
        DROP TYPE IF EXISTS account_type;
        DROP TYPE IF EXISTS payment_method;
        DROP TYPE IF EXISTS payment_type;
        DROP TYPE IF EXISTS reference_type;
        DROP TYPE IF EXISTS movement_type;
        DROP TYPE IF EXISTS purchase_status;
        DROP TYPE IF EXISTS sale_status;
        DROP TYPE IF EXISTS payment_status;
        DROP TYPE IF EXISTS user_role;
    `);
};
