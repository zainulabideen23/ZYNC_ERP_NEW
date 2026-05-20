/**
 * Purchase enhancement schema:
 * - Adds duplicate/cancellation metadata on purchases.
 * - Adds purchase_templates table for reusable purchase drafts.
 */

exports.up = async function up(knex) {
    const hasPurchases = await knex.schema.hasTable('purchases');

    if (hasPurchases) {
        const hasDuplicateFingerprint = await knex.schema.hasColumn('purchases', 'duplicate_fingerprint');
        const hasCancelledAt = await knex.schema.hasColumn('purchases', 'cancelled_at');
        const hasCancelledBy = await knex.schema.hasColumn('purchases', 'cancelled_by');
        const hasReturnReason = await knex.schema.hasColumn('purchases', 'return_reason');

        await knex.schema.alterTable('purchases', (table) => {
            if (!hasDuplicateFingerprint) {
                table.string('duplicate_fingerprint', 64).nullable();
            }
            if (!hasCancelledAt) {
                table.timestamp('cancelled_at').nullable();
            }
            if (!hasCancelledBy) {
                table.uuid('cancelled_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            }
            if (!hasReturnReason) {
                table.text('return_reason').nullable();
            }
        });

        await knex.raw(`
            UPDATE purchases
            SET cancelled_at = COALESCE(cancelled_at, updated_at)
            WHERE status = 'cancelled'
              AND cancelled_at IS NULL;
        `);

        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_purchases_tenant_duplicate_fingerprint
            ON purchases(tenant_id, duplicate_fingerprint)
            WHERE duplicate_fingerprint IS NOT NULL;
        `);

        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_purchases_tenant_cancelled_at
            ON purchases(tenant_id, cancelled_at)
            WHERE cancelled_at IS NOT NULL;
        `);
    }

    const hasPurchaseTemplates = await knex.schema.hasTable('purchase_templates');
    if (!hasPurchaseTemplates) {
        await knex.schema.createTable('purchase_templates', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
            table.string('name', 120).notNullable();
            table.text('description').nullable();
            table.uuid('supplier_id').nullable().references('id').inTable('suppliers').onDelete('SET NULL');
            table.specificType('payment_method', 'payment_method').notNullable().defaultTo('bank_transfer');
            table.decimal('subtotal', 15, 2).notNullable().defaultTo(0);
            table.decimal('discount_amount', 15, 2).notNullable().defaultTo(0);
            table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0);
            table.decimal('total_amount', 15, 2).notNullable().defaultTo(0);
            table.integer('item_count').notNullable().defaultTo(0);
            table.jsonb('items').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
            table.text('notes').nullable();
            table.boolean('is_active').notNullable().defaultTo(true);
            table.boolean('is_deleted').notNullable().defaultTo(false);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
        });

        await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchase_templates_tenant_active ON purchase_templates(tenant_id, is_active, updated_at DESC);');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_purchase_templates_tenant_supplier ON purchase_templates(tenant_id, supplier_id);');
        await knex.raw(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_templates_tenant_name_active
            ON purchase_templates(tenant_id, LOWER(name))
            WHERE is_deleted = false;
        `);
    }
};

exports.down = async function down(knex) {
    const hasPurchaseTemplates = await knex.schema.hasTable('purchase_templates');
    if (hasPurchaseTemplates) {
        await knex.raw('DROP INDEX IF EXISTS uq_purchase_templates_tenant_name_active;');
        await knex.raw('DROP INDEX IF EXISTS idx_purchase_templates_tenant_supplier;');
        await knex.raw('DROP INDEX IF EXISTS idx_purchase_templates_tenant_active;');
        await knex.schema.dropTable('purchase_templates');
    }

    const hasPurchases = await knex.schema.hasTable('purchases');
    if (hasPurchases) {
        await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_duplicate_fingerprint;');
        await knex.raw('DROP INDEX IF EXISTS idx_purchases_tenant_cancelled_at;');

        const hasDuplicateFingerprint = await knex.schema.hasColumn('purchases', 'duplicate_fingerprint');
        const hasCancelledAt = await knex.schema.hasColumn('purchases', 'cancelled_at');
        const hasCancelledBy = await knex.schema.hasColumn('purchases', 'cancelled_by');
        const hasReturnReason = await knex.schema.hasColumn('purchases', 'return_reason');

        await knex.schema.alterTable('purchases', (table) => {
            if (hasReturnReason) {
                table.dropColumn('return_reason');
            }
            if (hasCancelledBy) {
                table.dropColumn('cancelled_by');
            }
            if (hasCancelledAt) {
                table.dropColumn('cancelled_at');
            }
            if (hasDuplicateFingerprint) {
                table.dropColumn('duplicate_fingerprint');
            }
        });
    }
};
