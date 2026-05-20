/**
 * Add quotation email tracking fields.
 * - email_sent_at: last time quotation was emailed
 * - email_sent_count: number of times quotation was emailed
 * - last_emailed_to: recipient of the last sent email
 */

exports.up = async function (knex) {
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

    const hasLastEmailedTo = await knex.schema.hasColumn('quotations', 'last_emailed_to');
    if (!hasLastEmailedTo) {
        await knex.schema.alterTable('quotations', (table) => {
            table.string('last_emailed_to', 255);
        });
    }
};

exports.down = async function (knex) {
    const hasLastEmailedTo = await knex.schema.hasColumn('quotations', 'last_emailed_to');
    if (hasLastEmailedTo) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('last_emailed_to');
        });
    }

    const hasEmailSentCount = await knex.schema.hasColumn('quotations', 'email_sent_count');
    if (hasEmailSentCount) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('email_sent_count');
        });
    }

    const hasEmailSentAt = await knex.schema.hasColumn('quotations', 'email_sent_at');
    if (hasEmailSentAt) {
        await knex.schema.alterTable('quotations', (table) => {
            table.dropColumn('email_sent_at');
        });
    }
};