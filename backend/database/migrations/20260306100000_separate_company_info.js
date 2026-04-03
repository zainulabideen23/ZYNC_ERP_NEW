/**
 * Migration: Separate company_info from tenants
 *
 * BEFORE: Business details (phone, city, address, NTN, STRN, tax_rate, FY)
 *         live on the tenants table alongside platform fields (plan, slug, etc.)
 *
 * AFTER:  - tenants table = platform-only (slug, plan, max_users, expires_at, is_active, etc.)
 *         - company_info table = tenant-owned business details (name, NTN, STRN, phone,
 *           address, city, province, postal_code, country, tax_rate, FY, currency, etc.)
 *
 * This migration:
 *   1. Copies existing business data from tenants → company_info (one row per tenant)
 *   2. Drops the business columns from tenants
 */

exports.up = async function (knex) {
    // ─── 1. For every tenant, upsert a company_info row ───
    const tenants = await knex('tenants').select(
        'id', 'name',
        'ntn_number', 'strn_number', 'default_tax_rate',
        'phone', 'city', 'address',
        'financial_year_start', 'financial_year_end'
    );

    for (const t of tenants) {
        const exists = await knex('company_info').where('tenant_id', t.id).first();

        if (exists) {
            // Update existing row with tenants data (tenants columns are the source of truth)
            await knex('company_info').where('tenant_id', t.id).update({
                company_name: t.name || exists.company_name,
                tax_id: t.ntn_number || exists.tax_id || '',
                phone_number: t.phone || exists.phone_number || '',
                city: t.city || exists.city || '',
                address_line1: t.address || exists.address_line1 || '',
                default_tax_rate: t.default_tax_rate || exists.default_tax_rate || 0,
                financial_year_start: t.financial_year_start || exists.financial_year_start || 1,
                financial_year_end: t.financial_year_end || exists.financial_year_end || 12,
                updated_at: knex.fn.now(),
            });
        } else {
            // Insert new row
            await knex('company_info').insert({
                company_name: t.name || 'My Company',
                registration_number: '',
                tax_id: t.ntn_number || '',
                email: '',
                phone_number: t.phone || '',
                website: '',
                address_line1: t.address || '',
                address_line2: '',
                city: t.city || '',
                province_state: '',
                postal_code: '',
                country: 'Pakistan',
                financial_year_start: t.financial_year_start || 1,
                financial_year_end: t.financial_year_end || 12,
                default_currency: 'PKR',
                default_tax_rate: t.default_tax_rate || 0,
                tenant_id: t.id,
            });
        }
    }

    // ─── 2. Add strn_number to company_info if not exists ───
    const hasStrn = await knex.schema.hasColumn('company_info', 'strn_number');
    if (!hasStrn) {
        await knex.schema.alterTable('company_info', (table) => {
            table.string('strn_number', 100).nullable().after('tax_id');
        });
        // Copy STRN data
        for (const t of tenants) {
            if (t.strn_number) {
                await knex('company_info').where('tenant_id', t.id).update({
                    strn_number: t.strn_number,
                });
            }
        }
    }

    // ─── 3. Drop business columns from tenants ───
    await knex.schema.alterTable('tenants', (table) => {
        table.dropColumn('ntn_number');
        table.dropColumn('strn_number');
        table.dropColumn('default_tax_rate');
        table.dropColumn('phone');
        table.dropColumn('city');
        table.dropColumn('address');
        table.dropColumn('financial_year_start');
        table.dropColumn('financial_year_end');
    });
};

exports.down = async function (knex) {
    // ─── 1. Re-add business columns to tenants ───
    await knex.schema.alterTable('tenants', (table) => {
        table.string('ntn_number', 100).nullable();
        table.string('strn_number', 100).nullable();
        table.decimal('default_tax_rate', 5, 2).notNullable().defaultTo(0);
        table.string('phone', 50).nullable();
        table.string('city', 100).nullable();
        table.text('address').nullable();
        table.smallint('financial_year_start').notNullable().defaultTo(1);
        table.smallint('financial_year_end').notNullable().defaultTo(12);
    });

    // ─── 2. Copy data back from company_info → tenants ───
    const rows = await knex('company_info').select('*');
    for (const row of rows) {
        await knex('tenants').where('id', row.tenant_id).update({
            ntn_number: row.tax_id || null,
            strn_number: row.strn_number || null,
            default_tax_rate: row.default_tax_rate || 0,
            phone: row.phone_number || null,
            city: row.city || null,
            address: row.address_line1 || null,
            financial_year_start: row.financial_year_start || 1,
            financial_year_end: row.financial_year_end || 12,
        });
    }
};
