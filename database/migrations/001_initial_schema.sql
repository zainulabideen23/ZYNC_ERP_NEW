-- ZYNC-ERP: Complete Database Schema
-- PostgreSQL 15+
-- Run this migration to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier', 'viewer');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE sale_status AS ENUM ('completed', 'cancelled', 'returned');
CREATE TYPE purchase_status AS ENUM ('completed', 'cancelled');
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

-- =====================================================
-- MASTER TABLES
-- =====================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'cashier',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Categories table (hierarchical)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Companies/Brands table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Units of measure
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Account groups (for chart of accounts hierarchy)
CREATE TABLE account_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type account_type NOT NULL,
    parent_id UUID REFERENCES account_groups(id) ON DELETE SET NULL,
    sequence INTEGER,
    is_system BOOLEAN NOT NULL DEFAULT false
);

-- Chart of Accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    group_id UUID NOT NULL REFERENCES account_groups(id),
    account_type account_type NOT NULL,
    is_bank_account BOOLEAN NOT NULL DEFAULT false,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    phone_alt VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    cnic VARCHAR(15),
    credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0,
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    account_id UUID REFERENCES accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    contact_person VARCHAR(100),
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    account_id UUID REFERENCES accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id),
    retail_price DECIMAL(15,2) NOT NULL,
    wholesale_price DECIMAL(15,2),
    cost_price DECIMAL(15,2),
    min_stock_level DECIMAL(15,3) NOT NULL DEFAULT 0,
    track_stock BOOLEAN NOT NULL DEFAULT true,
    image_path VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TRANSACTION TABLES
-- =====================================================

-- Sales header
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    status sale_status NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Sale items
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    cost_price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Purchases header
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(30) UNIQUE NOT NULL,
    bill_date DATE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    reference_number VARCHAR(50),
    subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    status purchase_status NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Purchase items
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Stock movements (CRITICAL for FIFO)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    movement_type movement_type NOT NULL,
    reference_type reference_type NOT NULL,
    reference_id UUID,
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL,
    remaining_qty DECIMAL(15,3),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_type payment_type NOT NULL,
    payment_method payment_method NOT NULL,
    reference_type VARCHAR(20) NOT NULL,
    reference_id UUID NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    bank_account_id UUID REFERENCES accounts(id),
    cheque_number VARCHAR(50),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ACCOUNTING TABLES
-- =====================================================

-- Journals
CREATE TABLE journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_number VARCHAR(30) UNIQUE,
    journal_date DATE NOT NULL,
    journal_type journal_type NOT NULL,
    narration TEXT,
    is_posted BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ledger entries (double-entry)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id),
    entry_type entry_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reference_type ledger_reference_type NOT NULL,
    reference_id UUID,
    narration TEXT,
    journal_id UUID REFERENCES journals(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- EXPENSE TABLES
-- =====================================================

-- Expense categories
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number VARCHAR(30) UNIQUE,
    expense_date DATE NOT NULL,
    category_id UUID REFERENCES expense_categories(id),
    amount DECIMAL(15,2) NOT NULL,
    payment_method payment_method NOT NULL,
    bank_account_id UUID REFERENCES accounts(id),
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- LOGISTICS TABLES
-- =====================================================

-- Quotations
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number VARCHAR(30) UNIQUE,
    quotation_date DATE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    valid_until DATE,
    total_amount DECIMAL(15,2),
    status quotation_status NOT NULL DEFAULT 'draft',
    converted_to_sale_id UUID REFERENCES sales(id),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Quotation items
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL
);

-- Delivery challans
CREATE TABLE delivery_challans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challan_number VARCHAR(30) UNIQUE,
    challan_date DATE NOT NULL,
    sale_id UUID REFERENCES sales(id),
    customer_id UUID REFERENCES customers(id),
    delivery_address TEXT,
    status challan_status NOT NULL DEFAULT 'pending',
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Gate passes
CREATE TABLE gate_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_number VARCHAR(30) UNIQUE,
    pass_date DATE NOT NULL,
    pass_type pass_type NOT NULL,
    reference_type VARCHAR(20),
    reference_id UUID,
    description TEXT,
    vehicle_number VARCHAR(20),
    driver_name VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SUPPORT TABLES
-- =====================================================

-- Sequences for auto-numbering
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    prefix VARCHAR(10),
    current_value BIGINT NOT NULL DEFAULT 0,
    pad_length INTEGER NOT NULL DEFAULT 6,
    reset_yearly BOOLEAN NOT NULL DEFAULT false,
    last_reset DATE
);

-- Application settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    type setting_type NOT NULL DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action audit_action NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Customer phone lookup (Khata search)
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);

-- Product search
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_company ON products(company_id);

-- Sales indexes
CREATE INDEX idx_sales_date ON sales(invoice_date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- Purchase indexes
CREATE INDEX idx_purchases_date ON purchases(bill_date);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

-- Stock movements for FIFO (CRITICAL)
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at);
CREATE INDEX idx_stock_movements_remaining ON stock_movements(product_id, remaining_qty) 
    WHERE movement_type = 'IN' AND remaining_qty > 0;
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Ledger indexes
CREATE INDEX idx_ledger_account_date ON ledger_entries(account_id, entry_date);
CREATE INDEX idx_ledger_reference ON ledger_entries(reference_type, reference_id);
CREATE INDEX idx_ledger_journal ON ledger_entries(journal_id);

-- Payment indexes
CREATE INDEX idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Audit log indexes
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE stock_movements IS 'All stock changes tracked here. NEVER update stock directly. Use FIFO for cost calculation.';
COMMENT ON TABLE ledger_entries IS 'Double-entry accounting. SUM(debits) must equal SUM(credits) for each journal.';
COMMENT ON COLUMN stock_movements.remaining_qty IS 'Used for FIFO. Only IN movements have remaining_qty. Depleted as stock is sold.';
COMMENT ON COLUMN sales.balance_amount IS 'Auto-calculated: total_amount - paid_amount';
