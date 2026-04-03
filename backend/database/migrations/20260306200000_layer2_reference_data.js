/**
 * Layer 2 — Reference Data fixes
 * Single migration covering units, categories, brands, products, company_info
 */
exports.up = async function (knex) {
    // ─── 1A: units table — add created_by, updated_at ───
    await knex.schema.alterTable('units', (t) => {
        t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // ─── 1B: categories table — add product_count, created_by, updated_at ───
    await knex.schema.alterTable('categories', (t) => {
        t.integer('product_count').defaultTo(0).notNullable();
        t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Fix sequence_order (all currently 0): parents get id*10
    await knex.raw(`
        UPDATE categories
        SET sequence_order = id * 10
        WHERE parent_id IS NULL
    `);
    // Children get parent's sequence_order + their own id offset
    await knex.raw(`
        UPDATE categories c
        SET sequence_order = (
            SELECT p.sequence_order FROM categories p WHERE p.id = c.parent_id
        ) + c.id
        WHERE parent_id IS NOT NULL
    `);

    // Backfill product_count from actual products
    await knex.raw(`
        UPDATE categories c
        SET product_count = (
            SELECT COUNT(*) FROM products p
            WHERE p.category_id = c.id
            AND p.is_deleted = false
        )
    `);

    // ─── 1C: brands table — add created_by, updated_at ───
    await knex.schema.alterTable('brands', (t) => {
        t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // ─── 1D: products table — add brand_id FK ───
    await knex.schema.alterTable('products', (t) => {
        t.uuid('brand_id').references('id').inTable('brands').onDelete('SET NULL');
    });

    // ─── 1E: company_info table — add missing columns ───
    // email, website already exist from prior migration
    const hasCols = await knex('company_info').columnInfo();
    if (!hasCols.logo_url) {
        await knex.schema.alterTable('company_info', (t) => {
            t.string('logo_url', 500);
        });
    }
    if (!hasCols.bank_name) {
        await knex.schema.alterTable('company_info', (t) => {
            t.string('bank_name', 100);
            t.string('bank_account_number', 50);
            t.string('bank_iban', 34);
            t.string('bank_branch_code', 20);
        });
    }

    // ─── 1F: product_count trigger ───
    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_category_product_count()
        RETURNS TRIGGER AS $$
        BEGIN
            -- New product inserted
            IF TG_OP = 'INSERT' AND NEW.is_deleted = false THEN
                UPDATE categories SET product_count = product_count + 1
                WHERE id = NEW.category_id;

            -- Product hard deleted
            ELSIF TG_OP = 'DELETE' THEN
                IF OLD.is_deleted = false THEN
                    UPDATE categories SET product_count = product_count - 1
                    WHERE id = OLD.category_id;
                END IF;

            ELSIF TG_OP = 'UPDATE' THEN
                -- Category changed on a non-deleted product
                IF OLD.category_id IS DISTINCT FROM NEW.category_id
                   AND OLD.is_deleted = false AND NEW.is_deleted = false THEN
                    UPDATE categories SET product_count = product_count - 1
                    WHERE id = OLD.category_id;
                    UPDATE categories SET product_count = product_count + 1
                    WHERE id = NEW.category_id;
                END IF;

                -- Soft deleted
                IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
                    UPDATE categories SET product_count = product_count - 1
                    WHERE id = NEW.category_id;
                END IF;

                -- Restored from soft delete
                IF OLD.is_deleted = true AND NEW.is_deleted = false THEN
                    UPDATE categories SET product_count = product_count + 1
                    WHERE id = NEW.category_id;
                END IF;
            END IF;

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        DROP TRIGGER IF EXISTS trigger_category_product_count ON products;
        CREATE TRIGGER trigger_category_product_count
            AFTER INSERT OR UPDATE OR DELETE ON products
            FOR EACH ROW
            EXECUTE FUNCTION update_category_product_count();
    `);

    // ─── 1G: category deactivation cascade trigger ───
    await knex.raw(`
        CREATE OR REPLACE FUNCTION deactivate_child_categories()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_active = false AND OLD.is_active = true THEN
                UPDATE categories
                SET is_active = false, updated_at = NOW()
                WHERE parent_id = NEW.id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        DROP TRIGGER IF EXISTS trigger_deactivate_children ON categories;
        CREATE TRIGGER trigger_deactivate_children
            AFTER UPDATE ON categories
            FOR EACH ROW
            EXECUTE FUNCTION deactivate_child_categories();
    `);
};

exports.down = async function (knex) {
    // Drop triggers
    await knex.raw('DROP TRIGGER IF EXISTS trigger_deactivate_children ON categories');
    await knex.raw('DROP FUNCTION IF EXISTS deactivate_child_categories()');
    await knex.raw('DROP TRIGGER IF EXISTS trigger_category_product_count ON products');
    await knex.raw('DROP FUNCTION IF EXISTS update_category_product_count()');

    // Remove brand_id from products
    await knex.schema.alterTable('products', (t) => {
        t.dropColumn('brand_id');
    });

    // Remove added columns from brands
    await knex.schema.alterTable('brands', (t) => {
        t.dropColumn('created_by');
        t.dropColumn('updated_at');
    });

    // Remove added columns from categories
    await knex.schema.alterTable('categories', (t) => {
        t.dropColumn('product_count');
        t.dropColumn('created_by');
        t.dropColumn('updated_at');
    });

    // Remove added columns from units
    await knex.schema.alterTable('units', (t) => {
        t.dropColumn('created_by');
        t.dropColumn('updated_at');
    });

    // Remove company_info additions
    const hasCols = await knex('company_info').columnInfo();
    await knex.schema.alterTable('company_info', (t) => {
        if (hasCols.logo_url) t.dropColumn('logo_url');
        if (hasCols.bank_name) t.dropColumn('bank_name');
        if (hasCols.bank_account_number) t.dropColumn('bank_account_number');
        if (hasCols.bank_iban) t.dropColumn('bank_iban');
        if (hasCols.bank_branch_code) t.dropColumn('bank_branch_code');
    });
};
