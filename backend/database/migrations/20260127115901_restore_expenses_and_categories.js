
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Expense Categories (restored)
    await knex.raw(`
        CREATE TABLE expense_categories (
            id SMALLSERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (LENGTH(name) > 0)
        );
    `);

    // 2. Expenses (restored)
    await knex.raw(`
        CREATE TABLE expenses (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            expense_number VARCHAR(50) NOT NULL UNIQUE,
            category_id SMALLINT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            payment_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
            expense_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (expense_date <= CURRENT_TIMESTAMP),
            payment_method payment_method NOT NULL DEFAULT 'cash',
            status VARCHAR(20) NOT NULL DEFAULT 'paid',
            reference_number VARCHAR(100),
            attachment_url TEXT,
            notes TEXT,
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            CHECK (total_amount = amount + tax_amount)
        );
        CREATE INDEX idx_expenses_category ON expenses(category_id);
        CREATE INDEX idx_expenses_date ON expenses(expense_date);
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS expenses');
    await knex.raw('DROP TABLE IF EXISTS expense_categories');
};
