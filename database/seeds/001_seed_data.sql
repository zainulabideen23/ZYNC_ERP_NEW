-- ZYNC-ERP: Seed Data
-- Default system data required for the application to function

-- =====================================================
-- DEFAULT UNITS
-- =====================================================

INSERT INTO units (id, name, abbreviation) VALUES
    (uuid_generate_v4(), 'Piece', 'pcs'),
    (uuid_generate_v4(), 'Kilogram', 'kg'),
    (uuid_generate_v4(), 'Gram', 'g'),
    (uuid_generate_v4(), 'Liter', 'L'),
    (uuid_generate_v4(), 'Milliliter', 'ml'),
    (uuid_generate_v4(), 'Meter', 'm'),
    (uuid_generate_v4(), 'Centimeter', 'cm'),
    (uuid_generate_v4(), 'Box', 'box'),
    (uuid_generate_v4(), 'Dozen', 'doz'),
    (uuid_generate_v4(), 'Pair', 'pair'),
    (uuid_generate_v4(), 'Set', 'set'),
    (uuid_generate_v4(), 'Pack', 'pack'),
    (uuid_generate_v4(), 'Carton', 'ctn'),
    (uuid_generate_v4(), 'Roll', 'roll'),
    (uuid_generate_v4(), 'Sheet', 'sht');

-- =====================================================
-- ACCOUNT GROUPS (Chart of Accounts Structure)
-- =====================================================

-- Level 1: Main Groups
INSERT INTO account_groups (id, name, type, parent_id, sequence, is_system) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Assets', 'asset', NULL, 1, true),
    ('20000000-0000-0000-0000-000000000001', 'Liabilities', 'liability', NULL, 2, true),
    ('30000000-0000-0000-0000-000000000001', 'Capital', 'capital', NULL, 3, true),
    ('40000000-0000-0000-0000-000000000001', 'Income', 'income', NULL, 4, true),
    ('50000000-0000-0000-0000-000000000001', 'Expenses', 'expense', NULL, 5, true);

-- Level 2: Sub Groups
INSERT INTO account_groups (id, name, type, parent_id, sequence, is_system) VALUES
    -- Asset sub-groups
    ('11000000-0000-0000-0000-000000000001', 'Current Assets', 'asset', '10000000-0000-0000-0000-000000000001', 1, true),
    ('12000000-0000-0000-0000-000000000001', 'Fixed Assets', 'asset', '10000000-0000-0000-0000-000000000001', 2, true),
    -- Liability sub-groups
    ('21000000-0000-0000-0000-000000000001', 'Current Liabilities', 'liability', '20000000-0000-0000-0000-000000000001', 1, true),
    ('22000000-0000-0000-0000-000000000001', 'Long-term Liabilities', 'liability', '20000000-0000-0000-0000-000000000001', 2, true),
    -- Income sub-groups
    ('41000000-0000-0000-0000-000000000001', 'Sales Revenue', 'income', '40000000-0000-0000-0000-000000000001', 1, true),
    ('42000000-0000-0000-0000-000000000001', 'Other Income', 'income', '40000000-0000-0000-0000-000000000001', 2, true),
    -- Expense sub-groups
    ('51000000-0000-0000-0000-000000000001', 'Cost of Sales', 'expense', '50000000-0000-0000-0000-000000000001', 1, true),
    ('52000000-0000-0000-0000-000000000001', 'Operating Expenses', 'expense', '50000000-0000-0000-0000-000000000001', 2, true),
    ('53000000-0000-0000-0000-000000000001', 'Administrative Expenses', 'expense', '50000000-0000-0000-0000-000000000001', 3, true);

-- =====================================================
-- DEFAULT ACCOUNTS (Chart of Accounts)
-- =====================================================

INSERT INTO accounts (id, code, name, group_id, account_type, is_system, is_bank_account) VALUES
    -- Current Assets
    ('a1000000-0000-0000-0000-000000000001', '1001', 'Cash in Hand', '11000000-0000-0000-0000-000000000001', 'asset', true, false),
    ('a1100000-0000-0000-0000-000000000001', '1002', 'Bank Account', '11000000-0000-0000-0000-000000000001', 'asset', true, true),
    ('a1200000-0000-0000-0000-000000000001', '1003', 'Accounts Receivable', '11000000-0000-0000-0000-000000000001', 'asset', true, false),
    ('a1300000-0000-0000-0000-000000000001', '1004', 'Inventory', '11000000-0000-0000-0000-000000000001', 'asset', true, false),
    
    -- Current Liabilities
    ('a2000000-0000-0000-0000-000000000001', '2001', 'Accounts Payable', '21000000-0000-0000-0000-000000000001', 'liability', true, false),
    
    -- Capital
    ('a3000000-0000-0000-0000-000000000001', '3001', 'Owner Capital', '30000000-0000-0000-0000-000000000001', 'capital', true, false),
    ('a3100000-0000-0000-0000-000000000001', '3002', 'Retained Earnings', '30000000-0000-0000-0000-000000000001', 'capital', true, false),
    
    -- Income
    ('a4000000-0000-0000-0000-000000000001', '4001', 'Sales', '41000000-0000-0000-0000-000000000001', 'income', true, false),
    ('a4100000-0000-0000-0000-000000000001', '4002', 'Sales Returns', '41000000-0000-0000-0000-000000000001', 'income', true, false),
    ('a4200000-0000-0000-0000-000000000001', '4003', 'Sales Discount', '41000000-0000-0000-0000-000000000001', 'income', true, false),
    
    -- Cost of Sales
    ('a5000000-0000-0000-0000-000000000001', '5001', 'Cost of Goods Sold', '51000000-0000-0000-0000-000000000001', 'expense', true, false),
    ('a5100000-0000-0000-0000-000000000001', '5002', 'Purchase Returns', '51000000-0000-0000-0000-000000000001', 'expense', true, false),
    ('a5200000-0000-0000-0000-000000000001', '5003', 'Purchase Discount', '51000000-0000-0000-0000-000000000001', 'expense', true, false),
    
    -- Operating Expenses
    ('a6000000-0000-0000-0000-000000000001', '6001', 'Rent Expense', '52000000-0000-0000-0000-000000000001', 'expense', true, false),
    ('a6100000-0000-0000-0000-000000000001', '6002', 'Utilities Expense', '52000000-0000-0000-0000-000000000001', 'expense', true, false),
    ('a6200000-0000-0000-0000-000000000001', '6003', 'Salaries Expense', '52000000-0000-0000-0000-000000000001', 'expense', true, false),
    ('a6300000-0000-0000-0000-000000000001', '6004', 'Transportation Expense', '52000000-0000-0000-0000-000000000001', 'expense', true, false),
    ('a6400000-0000-0000-0000-000000000001', '6005', 'Miscellaneous Expense', '52000000-0000-0000-0000-000000000001', 'expense', true, false);

-- =====================================================
-- DEFAULT EXPENSE CATEGORIES
-- =====================================================

INSERT INTO expense_categories (name, account_id, is_active) VALUES
    ('Rent', 'a6000000-0000-0000-0000-000000000001', true),
    ('Utilities (Electricity/Gas/Water)', 'a6100000-0000-0000-0000-000000000001', true),
    ('Salaries & Wages', 'a6200000-0000-0000-0000-000000000001', true),
    ('Transportation & Delivery', 'a6300000-0000-0000-0000-000000000001', true),
    ('Office Supplies', 'a6400000-0000-0000-0000-000000000001', true),
    ('Repairs & Maintenance', 'a6400000-0000-0000-0000-000000000001', true),
    ('Communication (Phone/Internet)', 'a6400000-0000-0000-0000-000000000001', true),
    ('Miscellaneous', 'a6400000-0000-0000-0000-000000000001', true);

-- =====================================================
-- SEQUENCES FOR AUTO-NUMBERING
-- =====================================================

INSERT INTO sequences (name, prefix, current_value, pad_length, reset_yearly) VALUES
    ('invoice', 'INV-', 0, 6, true),
    ('purchase', 'PUR-', 0, 6, true),
    ('quotation', 'QTN-', 0, 6, true),
    ('challan', 'DC-', 0, 6, true),
    ('gatepass', 'GP-', 0, 6, true),
    ('expense', 'EXP-', 0, 6, true),
    ('journal', 'JRN-', 0, 6, true),
    ('customer', 'CUST-', 0, 5, false),
    ('supplier', 'SUPP-', 0, 5, false),
    ('product', 'PRD-', 0, 6, false);

-- =====================================================
-- DEFAULT SETTINGS
-- =====================================================

INSERT INTO settings (key, value, type, description) VALUES
    ('company_name', 'ZYNC Trading Company', 'string', 'Business name for invoices'),
    ('company_address', 'Lahore, Pakistan', 'string', 'Business address'),
    ('company_phone', '', 'string', 'Business phone number'),
    ('company_email', '', 'string', 'Business email'),
    ('company_ntn', '', 'string', 'National Tax Number'),
    ('currency_symbol', 'Rs.', 'string', 'Currency symbol'),
    ('currency_code', 'PKR', 'string', 'ISO currency code'),
    ('decimal_places', '2', 'number', 'Decimal places for amounts'),
    ('stock_valuation_method', 'FIFO', 'string', 'Stock valuation: FIFO or AVERAGE'),
    ('allow_negative_stock', 'false', 'boolean', 'Allow sales when stock is insufficient'),
    ('default_tax_rate', '0', 'number', 'Default tax percentage'),
    ('invoice_footer', 'Thank you for your business!', 'string', 'Invoice footer text'),
    ('backup_path', '', 'string', 'Path for automatic backups'),
    ('auto_backup_enabled', 'false', 'boolean', 'Enable automatic backups'),
    ('auto_backup_frequency', 'daily', 'string', 'Backup frequency: daily, weekly');

-- =====================================================
-- DEFAULT ADMIN USER
-- Password: admin123 (CHANGE THIS!)
-- =====================================================

INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES
    ('admin', '$2b$10$rQZ5q3.VxK8N9Fx9xjKXPOQZgPP0E4IYJK0VbL5pAQJV.K8VX5YXa', 'System Administrator', 'admin', true);

-- =====================================================
-- SAMPLE CATEGORIES (Optional - for testing)
-- =====================================================

INSERT INTO categories (name, description) VALUES
    ('Electronics', 'Electronic devices and accessories'),
    ('Clothing', 'Apparel and garments'),
    ('Groceries', 'Food and household items'),
    ('Stationery', 'Office and school supplies'),
    ('Hardware', 'Tools and hardware items'),
    ('Furniture', 'Home and office furniture'),
    ('Cosmetics', 'Beauty and personal care'),
    ('Sports', 'Sports equipment and accessories');

-- =====================================================
-- SAMPLE COMPANIES/BRANDS (Optional - for testing)
-- =====================================================

INSERT INTO companies (name, description) VALUES
    ('Local Brand', 'Local manufacturer'),
    ('Samsung', 'Electronics manufacturer'),
    ('Nike', 'Sportswear brand'),
    ('Unilever', 'Consumer goods'),
    ('Nestle', 'Food & beverages');

-- Walk-in Customer (for cash sales without customer)
INSERT INTO customers (id, code, name, phone, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'WALKIN', 'Walk-in Customer', '0000000000', true);
