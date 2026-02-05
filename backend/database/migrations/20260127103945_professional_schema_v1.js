/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 0. CLEANUP OLD SCHEMA
    await knex.raw(`
        DROP TABLE IF EXISTS audit_logs CASCADE;
        DROP TABLE IF EXISTS settings CASCADE;
        DROP TABLE IF EXISTS sequences CASCADE;
        DROP TABLE IF EXISTS gate_passes CASCADE;
        DROP TABLE IF EXISTS delivery_challans CASCADE;
        DROP TABLE IF EXISTS quotation_items CASCADE;
        DROP TABLE IF EXISTS quotations CASCADE;
        DROP TABLE IF EXISTS expenses CASCADE;
        DROP TABLE IF EXISTS expense_categories CASCADE;
        DROP TABLE IF EXISTS ledger_entries CASCADE;
        DROP TABLE IF EXISTS journals CASCADE;
        DROP TABLE IF EXISTS payments CASCADE;
        DROP TABLE IF EXISTS stock_movements CASCADE;
        DROP TABLE IF EXISTS stock_adjustments CASCADE;
        DROP TABLE IF EXISTS purchase_items CASCADE;
        DROP TABLE IF EXISTS purchases CASCADE;
        DROP TABLE IF EXISTS sale_items CASCADE;
        DROP TABLE IF EXISTS sales CASCADE;
        DROP TABLE IF EXISTS products CASCADE;
        DROP TABLE IF EXISTS suppliers CASCADE;
        DROP TABLE IF EXISTS customers CASCADE;
        DROP TABLE IF EXISTS company_info CASCADE;
        DROP TABLE IF EXISTS companies CASCADE;
        DROP TABLE IF EXISTS accounts CASCADE;
        DROP TABLE IF EXISTS account_groups CASCADE;
        DROP TABLE IF EXISTS categories CASCADE;
        DROP TABLE IF EXISTS units CASCADE;
        DROP TABLE IF EXISTS users CASCADE;

        DROP TYPE IF EXISTS audit_action CASCADE;
        DROP TYPE IF EXISTS ledger_entry_type CASCADE;
        DROP TYPE IF EXISTS transaction_type CASCADE;
        DROP TYPE IF EXISTS payment_status CASCADE;
        DROP TYPE IF EXISTS quotation_status CASCADE;
        DROP TYPE IF EXISTS purchase_status CASCADE;
        DROP TYPE IF EXISTS sale_status CASCADE;
        DROP TYPE IF EXISTS payment_method CASCADE;
        DROP TYPE IF EXISTS adjustment_reason CASCADE;
        DROP TYPE IF EXISTS stock_reference_type CASCADE;
        DROP TYPE IF EXISTS stock_movement_type CASCADE;
        DROP TYPE IF EXISTS account_type CASCADE;
        DROP TYPE IF EXISTS user_role CASCADE;
        
        -- Old schema enums that might be different
        DROP TYPE IF EXISTS movement_type CASCADE;
        DROP TYPE IF EXISTS reference_type CASCADE;
        DROP TYPE IF EXISTS payment_type CASCADE;
        DROP TYPE IF EXISTS entry_type CASCADE;
        DROP TYPE IF EXISTS journal_type CASCADE;
        DROP TYPE IF EXISTS ledger_reference_type CASCADE;
        DROP TYPE IF EXISTS challan_status CASCADE;
        DROP TYPE IF EXISTS pass_type CASCADE;
        DROP TYPE IF EXISTS setting_type CASCADE;
    `);

    // Enable UUID extension
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 1. CREATE ENUMS
    await knex.raw(`
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier', 'viewer');
        CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
        CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'DAMAGE', 'RETURN');
        CREATE TYPE stock_reference_type AS ENUM ('purchase', 'sale', 'adjustment', 'opening', 'damage', 'return');
        CREATE TYPE adjustment_reason AS ENUM ('damage', 'shrinkage', 'count_correction', 'theft', 'other');
        CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'cheque', 'credit_card', 'credit');
        CREATE TYPE sale_status AS ENUM ('draft', 'confirmed', 'completed', 'cancelled');
        CREATE TYPE purchase_status AS ENUM ('draft', 'ordered', 'received', 'billed', 'paid', 'cancelled');
        CREATE TYPE quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'converted');
        CREATE TYPE payment_status AS ENUM ('pending', 'reconciled', 'written_off', 'cancelled');
        CREATE TYPE transaction_type AS ENUM ('sale', 'purchase', 'payment', 'adjustment', 'opening', 'journal');
        CREATE TYPE ledger_entry_type AS ENUM ('debit', 'credit');
        CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'approve', 'reject');
    `);

    // 2. CORE TABLES

    // Users
    await knex.raw(`
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL UNIQUE,
            phone_number VARCHAR(20) NOT NULL,
            role user_role NOT NULL DEFAULT 'viewer',
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_superuser BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            CHECK (LENGTH(username) >= 3),
            CHECK (LENGTH(password_hash) > 0),
            CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'),
            CHECK (LENGTH(phone_number) >= 8)
        );
        CREATE INDEX idx_users_username ON users(username);
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_role ON users(role);
    `);

    // Units
    await knex.raw(`
        CREATE TABLE units (
            id SMALLSERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            abbreviation VARCHAR(10) NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (LENGTH(name) > 0),
            CHECK (LENGTH(abbreviation) > 0)
        );
    `);

    // Categories
    await knex.raw(`
        CREATE TABLE categories (
            id SMALLSERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            parent_id SMALLINT REFERENCES categories(id) ON DELETE RESTRICT,
            sequence_order SMALLINT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (LENGTH(name) > 0)
        );
    `);

    // Account Groups
    await knex.raw(`
        CREATE TABLE account_groups (
            id SMALLSERIAL PRIMARY KEY,
            account_type account_type NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            parent_id SMALLINT REFERENCES account_groups(id) ON DELETE RESTRICT,
            sequence_order SMALLINT NOT NULL DEFAULT 0,
            is_system BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            UNIQUE(account_type, name),
            CHECK (LENGTH(name) > 0)
        );
    `);

    // Accounts
    await knex.raw(`
        CREATE TABLE accounts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code VARCHAR(20) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            account_type account_type NOT NULL,
            group_id SMALLINT NOT NULL REFERENCES account_groups(id) ON DELETE RESTRICT,
            opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
            current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
            is_bank_account BOOLEAN NOT NULL DEFAULT false,
            bank_name VARCHAR(100),
            account_number VARCHAR(50),
            ifsc_code VARCHAR(20),
            is_system BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            requires_reconciliation BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (LENGTH(code) > 0),
            CHECK (LENGTH(name) > 0),
            CHECK (NOT is_bank_account OR (bank_name IS NOT NULL AND LENGTH(bank_name) > 0))
        );
        CREATE INDEX idx_accounts_code ON accounts(code);
        CREATE INDEX idx_accounts_group ON accounts(group_id);
    `);

    // Company Info
    await knex.raw(`
        CREATE TABLE company_info (
            id SMALLSERIAL PRIMARY KEY,
            company_name VARCHAR(150) NOT NULL,
            registration_number VARCHAR(100),
            tax_id VARCHAR(50) NOT NULL,
            email VARCHAR(100),
            phone_number VARCHAR(20),
            website VARCHAR(255),
            address_line1 VARCHAR(255) NOT NULL,
            address_line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            province_state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
            financial_year_start SMALLINT NOT NULL DEFAULT 1 CHECK (financial_year_start BETWEEN 1 AND 12),
            financial_year_end SMALLINT NOT NULL DEFAULT 12 CHECK (financial_year_end BETWEEN 1 AND 12),
            default_currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
            default_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (default_tax_rate >= 0),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Customers
    await knex.raw(`
        CREATE TABLE customers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(150) NOT NULL,
            phone_number VARCHAR(20) NOT NULL,
            phone_number_alt VARCHAR(20),
            email VARCHAR(100),
            address_line1 VARCHAR(255) NOT NULL,
            address_line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            province_state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
            credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
            current_credit_used DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (current_credit_used >= 0),
            opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
            current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (LENGTH(code) > 0),
            CHECK (LENGTH(name) > 0),
            CHECK (current_credit_used <= credit_limit)
        );
        CREATE INDEX idx_customers_code ON customers(code);
    `);

    // Suppliers
    await knex.raw(`
        CREATE TABLE suppliers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(150) NOT NULL,
            contact_person VARCHAR(100),
            phone_number VARCHAR(20) NOT NULL,
            phone_number_alt VARCHAR(20),
            email VARCHAR(100),
            address_line1 VARCHAR(255) NOT NULL,
            address_line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            province_state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
            opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
            current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (LENGTH(code) > 0),
            CHECK (LENGTH(name) > 0)
        );
        CREATE INDEX idx_suppliers_code ON suppliers(code);
    `);

    // Products
    await knex.raw(`
        CREATE TABLE products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code VARCHAR(50) NOT NULL UNIQUE,
            barcode VARCHAR(100) UNIQUE,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            category_id SMALLINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            unit_id SMALLINT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
            cost_price DECIMAL(15,2) NOT NULL CHECK (cost_price >= 0),
            retail_price DECIMAL(15,2) NOT NULL CHECK (retail_price > cost_price),
            wholesale_price DECIMAL(15,2) CHECK (wholesale_price IS NULL OR (wholesale_price > 0 AND wholesale_price <= retail_price)),
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
            min_stock_level SMALLINT NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
            current_stock DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
            reorder_quantity SMALLINT NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0),
            weight DECIMAL(10,3),
            dimensions VARCHAR(100),
            track_stock BOOLEAN NOT NULL DEFAULT true,
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (LENGTH(code) > 0),
            CHECK (LENGTH(name) > 0)
        );
        CREATE INDEX idx_products_code ON products(code);
        CREATE INDEX idx_products_barcode ON products(barcode);
    `);

    // Stock Movements
    await knex.raw(`
        CREATE TABLE stock_movements (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            movement_type stock_movement_type NOT NULL,
            reference_type stock_reference_type NOT NULL,
            reference_id UUID,
            quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
            unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
            remaining_qty DECIMAL(15,2) NOT NULL CHECK (remaining_qty >= 0),
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id)
        );
        CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
        CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);
    `);

    // Stock Adjustments
    await knex.raw(`
        CREATE TABLE stock_adjustments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            adjustment_type adjustment_reason NOT NULL,
            quantity_adjusted DECIMAL(15,2) NOT NULL,
            reason_notes TEXT NOT NULL,
            reference_attachment_url TEXT,
            is_approved BOOLEAN NOT NULL DEFAULT false,
            approved_by UUID REFERENCES users(id),
            approved_at TIMESTAMP,
            is_reversed BOOLEAN NOT NULL DEFAULT false,
            reversed_by UUID REFERENCES users(id),
            reversed_at TIMESTAMP,
            reversal_reason TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            CHECK (LENGTH(reason_notes) > 0),
            CHECK (quantity_adjusted != 0)
        );
    `);

    // Sales
    await knex.raw(`
        CREATE TABLE sales (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            invoice_number VARCHAR(50) NOT NULL UNIQUE,
            customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
            sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (sale_date <= CURRENT_TIMESTAMP),
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
            discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
            discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
            payment_method payment_method NOT NULL DEFAULT 'cash',
            amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
            amount_due DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
            status sale_status NOT NULL DEFAULT 'draft',
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (total_amount = (subtotal - discount_amount) + tax_amount),
            CHECK (amount_due = total_amount - amount_paid)
        );
        CREATE INDEX idx_sales_invoice ON sales(invoice_number);
        CREATE INDEX idx_sales_customer ON sales(customer_id);
    `);

    // Sale Items
    await knex.raw(`
        CREATE TABLE sale_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
            unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
            line_discount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
            line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            CHECK (line_total = (quantity * unit_price) - line_discount)
        );
        CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX idx_sale_items_product ON sale_items(product_id);
    `);

    // Purchases
    await knex.raw(`
        CREATE TABLE purchases (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            bill_number VARCHAR(50) NOT NULL UNIQUE,
            supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
            purchase_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (purchase_date <= CURRENT_TIMESTAMP),
            expected_delivery_date DATE,
            actual_delivery_date DATE,
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
            discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
            payment_method payment_method NOT NULL DEFAULT 'bank_transfer',
            amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
            amount_due DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
            status purchase_status NOT NULL DEFAULT 'draft',
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP,
            reference_number VARCHAR(100),
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (total_amount = (subtotal - discount_amount) + tax_amount),
            CHECK (amount_due = total_amount - amount_paid),
            CHECK (actual_delivery_date IS NULL OR actual_delivery_date >= purchase_date::date)
        );
        CREATE INDEX idx_purchases_bill ON purchases(bill_number);
        CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
    `);

    // Purchase Items
    await knex.raw(`
        CREATE TABLE purchase_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            quantity_ordered DECIMAL(15,2) NOT NULL CHECK (quantity_ordered > 0),
            quantity_received DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
            unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
            line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            CHECK (quantity_received <= quantity_ordered)
        );
        CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
    `);

    // Quotations
    await knex.raw(`
        CREATE TABLE quotations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            quotation_number VARCHAR(50) NOT NULL UNIQUE,
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
            quotation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (quotation_date <= CURRENT_TIMESTAMP),
            valid_until DATE NOT NULL CHECK (valid_until >= quotation_date::date),
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
            discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
            status quotation_status NOT NULL DEFAULT 'draft',
            converted_to_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
            rejection_reason TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            CHECK (total_amount = (subtotal - discount_amount) + tax_amount)
        );
    `);

    // Quotation Items
    await knex.raw(`
        CREATE TABLE quotation_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
            unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
            line_discount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id)
        );
    `);

    // Payments
    await knex.raw(`
        CREATE TABLE payments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
            purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
            customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
            supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
            payment_amount DECIMAL(15,2) NOT NULL CHECK (payment_amount > 0),
            payment_method payment_method NOT NULL,
            payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (payment_date <= CURRENT_TIMESTAMP),
            cheque_number VARCHAR(50),
            bank_name VARCHAR(100),
            status payment_status NOT NULL DEFAULT 'pending',
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            CHECK ((sale_id IS NOT NULL) OR (purchase_id IS NOT NULL)),
            CHECK (NOT ((sale_id IS NOT NULL) AND (purchase_id IS NOT NULL)))
        );
        CREATE INDEX idx_payments_date ON payments(payment_date);
    `);

    // Journals
    await knex.raw(`
        CREATE TABLE journals (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            journal_number VARCHAR(50) NOT NULL UNIQUE,
            journal_date DATE NOT NULL CHECK (journal_date <= CURRENT_DATE),
            reference_type transaction_type NOT NULL,
            reference_id UUID,
            description VARCHAR(500) NOT NULL,
            total_debit DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_debit >= 0),
            total_credit DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_credit >= 0),
            is_balanced BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            CHECK (description != ''),
            CHECK (total_debit = total_credit)
        );
        CREATE INDEX idx_journals_number ON journals(journal_number);
    `);

    // Ledger Entries
    await knex.raw(`
        CREATE TABLE ledger_entries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            entry_type ledger_entry_type NOT NULL,
            amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
            description TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id)
        );
        CREATE INDEX idx_ledger_account ON ledger_entries(account_id);
    `);

    // Audit Logs
    await knex.raw(`
        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            action audit_action NOT NULL,
            table_name VARCHAR(100) NOT NULL,
            record_id UUID NOT NULL,
            old_values JSONB,
            new_values JSONB,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (LENGTH(table_name) > 0)
        );
        CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
        CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);
    `);

    // 3. HELPER FUNCTIONS & TRIGGERS

    await knex.raw(`
        CREATE OR REPLACE FUNCTION check_single_row() RETURNS TRIGGER AS $$
        BEGIN
            IF (SELECT COUNT(*) FROM company_info) > 0 THEN
                RAISE EXCEPTION 'Only one company record allowed';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER ensure_single_company_info
        BEFORE INSERT ON company_info
        FOR EACH ROW
        EXECUTE FUNCTION check_single_row();
    `);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_stock_on_sale_item() RETURNS TRIGGER AS $$
        BEGIN
            UPDATE products
            SET current_stock = current_stock - NEW.quantity
            WHERE id = NEW.product_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_stock_sale
        AFTER INSERT ON sale_items
        FOR EACH ROW
        EXECUTE FUNCTION update_stock_on_sale_item();
    `);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_account_balance() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.entry_type = 'debit' THEN
                UPDATE accounts SET current_balance = current_balance + NEW.amount
                WHERE id = NEW.account_id;
            ELSE
                UPDATE accounts SET current_balance = current_balance - NEW.amount
                WHERE id = NEW.account_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_account
        AFTER INSERT ON ledger_entries
        FOR EACH ROW
        EXECUTE FUNCTION update_account_balance();
    `);
};

exports.down = async function (knex) {
    // Drop triggers and functions
    await knex.raw('DROP TRIGGER IF EXISTS trigger_update_account ON ledger_entries');
    await knex.raw('DROP FUNCTION IF EXISTS update_account_balance');
    await knex.raw('DROP TRIGGER IF EXISTS trigger_update_stock_sale ON sale_items');
    await knex.raw('DROP FUNCTION IF EXISTS update_stock_on_sale_item');
    await knex.raw('DROP TRIGGER IF EXISTS ensure_single_company_info ON company_info');
    await knex.raw('DROP FUNCTION IF EXISTS check_single_row');

    // Drop tables in reverse order
    await knex.raw('DROP TABLE IF EXISTS audit_logs');
    await knex.raw('DROP TABLE IF EXISTS ledger_entries');
    await knex.raw('DROP TABLE IF EXISTS journals');
    await knex.raw('DROP TABLE IF EXISTS payments');
    await knex.raw('DROP TABLE IF EXISTS quotation_items');
    await knex.raw('DROP TABLE IF EXISTS quotations');
    await knex.raw('DROP TABLE IF EXISTS purchase_items');
    await knex.raw('DROP TABLE IF EXISTS purchases');
    await knex.raw('DROP TABLE IF EXISTS sale_items');
    await knex.raw('DROP TABLE IF EXISTS sales');
    await knex.raw('DROP TABLE IF EXISTS stock_adjustments');
    await knex.raw('DROP TABLE IF EXISTS stock_movements');
    await knex.raw('DROP TABLE IF EXISTS products');
    await knex.raw('DROP TABLE IF EXISTS suppliers');
    await knex.raw('DROP TABLE IF EXISTS customers');
    await knex.raw('DROP TABLE IF EXISTS company_info');
    await knex.raw('DROP TABLE IF EXISTS accounts');
    await knex.raw('DROP TABLE IF EXISTS account_groups');
    await knex.raw('DROP TABLE IF EXISTS categories');
    await knex.raw('DROP TABLE IF EXISTS units');
    await knex.raw('DROP TABLE IF EXISTS users');

    // Drop enums
    await knex.raw(`
        DROP TYPE IF EXISTS audit_action;
        DROP TYPE IF EXISTS ledger_entry_type;
        DROP TYPE IF EXISTS transaction_type;
        DROP TYPE IF EXISTS payment_status;
        DROP TYPE IF EXISTS quotation_status;
        DROP TYPE IF EXISTS purchase_status;
        DROP TYPE IF EXISTS sale_status;
        DROP TYPE IF EXISTS payment_method;
        DROP TYPE IF EXISTS adjustment_reason;
        DROP TYPE IF EXISTS stock_reference_type;
        DROP TYPE IF EXISTS stock_movement_type;
        DROP TYPE IF EXISTS account_type;
        DROP TYPE IF EXISTS user_role;
    `);
};

