const { AppError } = require('../middleware/errorHandler');

class CustomerService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a new customer and its GL account
     */
    async create(data, userId) {
        const {
            name,
            code,
            company_name,
            phone_number,
            email,
            cnic_number,
            address_line1,
            city,
            credit_limit = 0,
            opening_balance = 0
        } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Create GL Account for Customer (under Trade Receivables - usually Asset)
            // Account Group Code for Receivables: 1200 or similar
            const group = await trx('account_groups').where('code', '1200').first();
            if (!group) throw new AppError('Receivables account group (1200) not found', 500);

            // Generate Account Code: 1201, 1202, ...
            const lastAccount = await trx('accounts')
                .where('group_id', group.id)
                .orderBy('code', 'desc')
                .first();

            let nextCode = lastAccount
                ? (parseInt(lastAccount.code) + 1).toString()
                : '1201';

            // Ensure Uniqueness (Collision Resistant)
            while (await trx('accounts').where('code', nextCode).first()) {
                nextCode = (parseInt(nextCode) + 1).toString();
            }

            const [account] = await trx('accounts').insert({
                code: nextCode,
                name: `Receivable - ${name}`,
                group_id: group.id,
                account_type: 'asset',
                opening_balance: opening_balance,
                current_balance: opening_balance,
                is_system: false,
                created_by: userId
            }).returning('*');

            // 2. Create Customer Record
            const [customer] = await trx('customers').insert({
                code: code || `CUST-${nextCode}`,
                name,
                company_name,
                phone_number,
                email,
                cnic_number,
                address_line1,
                city,
                credit_limit,
                opening_balance,
                current_balance: opening_balance,
                account_id: account.id,
                created_by: userId
            }).returning('*');

            return customer;
        });
    }

    /**
     * Update customer
     */
    async update(id, data, userId) {
        const [customer] = await this.db('customers')
            .where({ id, is_deleted: false })
            .update({
                ...data,
                updated_at: new Date(),
                updated_by: userId
            })
            .returning('*');

        if (!customer) throw new AppError('Customer not found', 404);

        // Update Account Name if customer name changed
        if (data.name && customer.account_id) {
            await this.db('accounts')
                .where('id', customer.account_id)
                .update({ name: `Receivable - ${data.name}` });
        }

        return customer;
    }

    /**
     * List customers with pagination
     */
    async list(params) {
        const { page = 1, limit = 50, search, active_only = true } = params;
        const offset = (page - 1) * limit;

        let query = this.db('customers').where('is_deleted', false);

        if (active_only) query = query.where('is_active', true);

        if (search) {
            query = query.where((builder) => {
                builder
                    .whereILike('name', `%${search}%`)
                    .orWhereILike('phone_number', `%${search}%`)
                    .orWhereILike('code', `%${search}%`);
            });
        }

        const [{ count }] = await this.db('customers').where('is_deleted', false).count();
        const customers = await query.orderBy('name').limit(limit).offset(offset);

        return {
            data: customers,
            pagination: { page, limit, total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }
}

module.exports = CustomerService;
