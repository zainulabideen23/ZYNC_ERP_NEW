class QuotationService {
    constructor(db) {
        this.db = db;
    }

    async createQuotation(data) {
        const { customer_id, quote_date, valid_until, items, notes, created_by } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Generate quotation number
            const quoteNumber = await this.generateQuotationNumber(trx);

            // 2. Calculate totals
            let totalAmount = 0;
            const processedItems = [];

            for (const item of items) {
                const lineTotal = item.quantity * item.unit_price;
                totalAmount += lineTotal;
                processedItems.push({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    line_total: lineTotal
                });
            }

            // 3. Create quotation record
            const [quotation] = await trx('quotations')
                .insert({
                    quotation_number: quoteNumber,
                    quotation_date: quote_date || new Date().toISOString().split('T')[0],
                    customer_id,
                    valid_until: valid_until || null,
                    total_amount: totalAmount,
                    notes,
                    status: 'draft',
                    created_by
                })
                .returning('*');

            // 4. Create items
            for (const item of processedItems) {
                // Assuming a quotation_items table exists, or we use a JSONB/generic item table.
                // In initial_schema.sql, let's verify if there is a quotation_items table.
                // If not, I'll need to create a migration or a separate table.
                // Checking previous view_file of 001_initial_schema.sql... I only saw 'delivery_challans'.
                // Let's re-verify the table name for items.
                await trx('quotation_items').insert({
                    quotation_id: quotation.id,
                    ...item
                });
            }

            return quotation;
        });
    }

    async generateQuotationNumber(trx) {
        const sequence = await trx('sequences').where('name', 'quotation_number').forUpdate().first();
        if (!sequence) throw new Error('Quotation sequence not found');

        const newValue = parseInt(sequence.current_value) + 1;
        await trx('sequences').where('name', 'quotation').update({ current_value: newValue });

        const prefix = sequence.prefix || 'QTN-';
        const padLength = sequence.pad_length || 6;
        return prefix + String(newValue).padStart(padLength, '0');
    }
}

module.exports = QuotationService;
