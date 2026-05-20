/**
 * Add quotation response tracking fields for customer one-click accept/reject flow.
 */

exports.up = async function up(knex) {
    const hasResponseToken = await knex.schema.hasColumn('quotations', 'response_token');
    if (!hasResponseToken) {
        await knex.schema.alterTable('quotations', (table) => {
            table.string('response_token', 255);
        });
    }

    const hasTokenExpiresAt = await knex.schema.hasColumn('quotations', 'token_expires_at');
    if (!hasTokenExpiresAt) {
        await knex.schema.alterTable('quotations', (table) => {
            table.timestamp('token_expires_at');
        });
    }

    const hasRespondedAt = await knex.schema.hasColumn('quotations', 'responded_at');
    if (!hasRespondedAt) {
        await knex.schema.alterTable('quotations', (table) => {
            table.timestamp('responded_at');
        });
    }

    const hasResponseIp = await knex.schema.hasColumn('quotations', 'response_ip');
    if (!hasResponseIp) {
        await knex.schema.alterTable('quotations', (table) => {
            table.string('response_ip', 50);
        });
    }

    const hasCustomerResponseNotes = await knex.schema.hasColumn('quotations', 'customer_response_notes');
    if (!hasCustomerResponseNotes) {
        await knex.schema.alterTable('quotations', (table) => {
            table.text('customer_response_notes');
        });
    }

    // Keep this idempotent in case older environments missed the earlier email-tracking migration.
    const hasEmailSentAt = await knex.schema.hasColumn('quotations', 'email_sent_at');
    if (!hasEmailSentAt) {
        await knex.schema.alterTable('quotations', (table) => {
            table.timestamp('email_sent_at');
        });
    }

    const hasEmailSentCount = await knex.schema.hasColumn('quotations', 'email_sent_count');
    if (!hasEmailSentCount) {
        await knex.schema.alterTable('quotations', (table) => {
            table.integer('email_sent_count').notNullable().defaultTo(0);
        });
    }

    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND indexname = 'quotations_response_token_unique_idx'
            ) THEN
                CREATE UNIQUE INDEX quotations_response_token_unique_idx
                ON quotations (response_token)
                WHERE response_token IS NOT NULL;
            END IF;
        END $$;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS quotations_response_token_unique_idx;');

    const hasCustomerResponseNotes = await knex.schema.hasColumn('quotations', 'customer_response_notes');
    if (hasCustomerResponseNotes) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('customer_response_notes');
        });
    }

    const hasResponseIp = await knex.schema.hasColumn('quotations', 'response_ip');
    if (hasResponseIp) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('response_ip');
        });
    }

    const hasRespondedAt = await knex.schema.hasColumn('quotations', 'responded_at');
    if (hasRespondedAt) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('responded_at');
        });
    }

    const hasTokenExpiresAt = await knex.schema.hasColumn('quotations', 'token_expires_at');
    if (hasTokenExpiresAt) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('token_expires_at');
        });
    }

    const hasResponseToken = await knex.schema.hasColumn('quotations', 'response_token');
    if (hasResponseToken) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('response_token');
        });
    }
};
