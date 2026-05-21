/**
 * Migration: Fix sequences table
 * 
 * - Delete challan sequence
 * - Fix pad_length for customer and supplier (4 → 6)
 * - Add 4 missing sequences: payment, stock_adjustment, sale_return, purchase_return
 */

exports.up = async function(knex) {
    const DEFAULT_TENANT = 'c972d614-3fbb-426e-a8b2-ce8fd816197d';

    // Create default tenant if it doesn't exist yet (fresh DB before seed)
    const tenant = await knex('tenants').where('id', DEFAULT_TENANT).first();
    if (!tenant) {
        await knex('tenants').insert({
            id: DEFAULT_TENANT,
            name: 'Default',
            slug: 'default',
            is_active: true,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        });
    }

    // Delete challan sequence
    await knex('sequences')
        .where({ name: 'challan', tenant_id: DEFAULT_TENANT })
        .delete();

    // Fix pad_length inconsistencies
    await knex('sequences')
        .where({ tenant_id: DEFAULT_TENANT })
        .whereIn('name', ['customer', 'supplier'])
        .update({ pad_length: 6 });

    // Add missing sequences (only if they don't already exist)
    const existingNames = await knex('sequences')
        .where({ tenant_id: DEFAULT_TENANT })
        .whereIn('name', ['payment', 'stock_adjustment', 'sale_return', 'purchase_return'])
        .pluck('name');

    const toInsert = [
        { name: 'payment', prefix: 'PAY-', current_value: 0, pad_length: 6, is_active: true, tenant_id: DEFAULT_TENANT },
        { name: 'stock_adjustment', prefix: 'ADJ-', current_value: 0, pad_length: 6, is_active: true, tenant_id: DEFAULT_TENANT },
        { name: 'sale_return', prefix: 'SRN-', current_value: 0, pad_length: 6, is_active: true, tenant_id: DEFAULT_TENANT },
        { name: 'purchase_return', prefix: 'PRN-', current_value: 0, pad_length: 6, is_active: true, tenant_id: DEFAULT_TENANT },
    ].filter(s => !existingNames.includes(s.name));

    if (toInsert.length > 0) {
        await knex('sequences').insert(toInsert);
    }
};

exports.down = async function(knex) {
    const DEFAULT_TENANT = 'c972d614-3fbb-426e-a8b2-ce8fd816197d';

    // Remove added sequences
    await knex('sequences')
        .where({ tenant_id: DEFAULT_TENANT })
        .whereIn('name', ['payment', 'stock_adjustment', 'sale_return', 'purchase_return'])
        .delete();

    // Revert pad_length
    await knex('sequences')
        .where({ tenant_id: DEFAULT_TENANT })
        .whereIn('name', ['customer', 'supplier'])
        .update({ pad_length: 4 });

    // Re-add challan
    const exists = await knex('sequences')
        .where({ name: 'challan', tenant_id: DEFAULT_TENANT })
        .first();

    if (!exists) {
        await knex('sequences').insert({
            name: 'challan',
            prefix: 'CH-',
            current_value: 0,
            pad_length: 6,
            is_active: true,
            tenant_id: DEFAULT_TENANT
        });
    }
};
