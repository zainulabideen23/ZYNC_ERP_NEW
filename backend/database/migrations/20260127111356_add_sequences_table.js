
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw(`
        CREATE TABLE sequences (
            name VARCHAR(50) PRIMARY KEY,
            prefix VARCHAR(10) NOT NULL,
            current_value BIGINT NOT NULL DEFAULT 0,
            pad_length INT NOT NULL DEFAULT 6,
            is_active BOOLEAN NOT NULL DEFAULT true,
            description VARCHAR(255)
        );

        INSERT INTO sequences (name, prefix, description) VALUES 
        ('invoice', 'SINV-', 'Sale Invoice Numbering'),
        ('purchase', 'PUR-', 'Purchase Bill Numbering'),
        ('journal', 'JV-', 'Journal Voucher Numbering'),
        ('quotation', 'QUO-', 'Quotation Numbering');
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('sequences');
};
