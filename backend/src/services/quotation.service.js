const { AppError } = require('../middleware/errorHandler');

class QuotationService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a new quotation
     */
    async create(data, userId) {
        const {
            customer_id,
            quotation_date,
            valid_until,
            expiry_date, // Accept both for compatibility
            items,
            discount_amount = 0,
            tax_amount = 0,
            notes
        } = data;

        // Use valid_until or expiry_date (fallback)
        const validUntilDate = valid_until || expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Retry loop for unique constraint violations
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                return await this.db.transaction(async (trx) => {
                    // 1. Generate Quotation Number
                    const quotationNumber = await this.generateQuotationNumber(trx);

                    // 2. Process Items
                    let subtotal = 0;
                    const processedItems = [];

                    for (const item of items) {
                        const product = await trx('products').where('id', item.product_id).first();
                        if (!product) throw new AppError(`Product not found: ${item.product_id}`, 404);

                        const lineTotal = (item.quantity * item.unit_price) - (item.line_discount || 0);
                        subtotal += (item.quantity * item.unit_price);

                        processedItems.push({
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            line_discount: item.line_discount || 0,
                            tax_rate: item.tax_rate || 0,
                            line_total: item.line_total || lineTotal,
                            created_by: userId
                        });
                    }

                    const totalAmount = (subtotal - discount_amount) + tax_amount;

                    // 3. Create Quotation Record
                    const [quotation] = await trx('quotations').insert({
                        quotation_number: quotationNumber,
                        customer_id,
                        quotation_date: quotation_date || new Date(),
                        valid_until: validUntilDate,
                        subtotal,
                        discount_amount,
                        tax_amount,
                        total_amount: totalAmount,
                        status: 'draft',
                        created_by: userId
                    }).returning('*');

                    // 4. Create Quotation Items
                    for (const item of processedItems) {
                        await trx('quotation_items').insert({
                            quotation_id: quotation.id,
                            ...item
                        });
                    }

                    return quotation;
                });
            } catch (error) {
                if (error.code === '23505' && error.constraint === 'quotations_quotation_number_key') {
                    attempts++;
                    console.warn(`Duplicate quotation number detected. Retrying attempt ${attempts}/${maxAttempts}...`);
                    try {
                        const maxResult = await this.db.raw(`SELECT COALESCE(MAX(CAST(REPLACE(quotation_number, 'QUO-', '') AS INTEGER)), 0) as max_num FROM quotations`);
                        const maxNum = maxResult.rows[0].max_num;
                        await this.db('sequences').where('name', 'quotation').update({ current_value: maxNum });
                    } catch (syncError) {
                        console.error('Failed to sync sequence:', syncError);
                    }
                    if (attempts === maxAttempts) throw new AppError('Failed to generate unique quotation number', 500);
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Generate next quotation number
     */
    async generateQuotationNumber(trx) {
        const sequence = await trx('sequences').where('name', 'quotation').forUpdate().first();
        if (!sequence) throw new AppError('Quotation sequence not found', 500);

        const nextVal = sequence.current_value + 1;
        await trx('sequences').where('name', 'quotation').update({ current_value: nextVal });

        return `${sequence.prefix}${nextVal.toString().padStart(sequence.pad_length || 6, '0')}`;
    }

    /**
     * List quotations
     */
    async list(params) {
        const { page = 1, limit = 50, customer_id, status } = params;
        const offset = (page - 1) * limit;

        let query = this.db('quotations as q')
            .leftJoin('customers as c', 'q.customer_id', 'c.id')
            .select('q.*', 'c.name as customer_name')
            .where('q.is_deleted', false);

        if (customer_id) query = query.where('q.customer_id', customer_id);
        // Only apply status filter if it's not 'all'
        if (status && status !== 'all') query = query.where('q.status', status);

        const [{ count }] = await this.db('quotations').where('is_deleted', false).count();
        const quotations = await query.orderBy('q.quotation_date', 'desc').limit(limit).offset(offset);

        return {
            data: quotations,
            pagination: { page, limit, total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }
}

module.exports = QuotationService;

