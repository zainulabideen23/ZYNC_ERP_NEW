const { AppError } = require('../middleware/errorHandler');

class SupplierService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Create a new supplier and its GL account
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
            opening_balance = 0
        } = data;

        return await this.db.transaction(async (trx) => {
            // 1. Create GL Account for Supplier (under Trade Payables - Liability)
            // Account Group Code for Payables: 2000 or similar
            const group = await trx('account_groups').where('code', '2000').first();
            if (!group) throw new AppError('Payables account group (2000) not found', 500);

            // Generate Account Code: 2001, 2002, ...
            const lastAccount = await trx('accounts')
                .where('group_id', group.id)
                .orderBy('code', 'desc')
                .first();

            let nextCode = lastAccount
                ? (parseInt(lastAccount.code) + 1).toString()
                : '2001';

            // Ensure Uniqueness (Collision Resistant)
            while (await trx('accounts').where('code', nextCode).first()) {
                nextCode = (parseInt(nextCode) + 1).toString();
            }

            const [account] = await trx('accounts').insert({
                code: nextCode,
                name: `Payable - ${name}`,
                group_id: group.id,
                account_type: 'liability',
                opening_balance: opening_balance,
                current_balance: opening_balance,
                is_system: false,
                created_by: userId
            }).returning('*');

            // 2. Create Supplier Record
            const [supplier] = await trx('suppliers').insert({
                code: code || `SUPP-${nextCode}`,
                name,
                company_name,
                phone_number,
                email,
                cnic_number,
                address_line1,
                city,
                opening_balance,
                current_balance: opening_balance,
                account_id: account.id,
                created_by: userId
            }).returning('*');

            return supplier;
        });
    }

    /**
     * Update supplier
     */
    async update(id, data, userId) {
        const [supplier] = await this.db('suppliers')
            .where({ id, is_deleted: false })
            .update({
                ...data,
                updated_at: new Date(),
                updated_by: userId
            })
            .returning('*');

        if (!supplier) throw new AppError('Supplier not found', 404);

        // Update Account Name if supplier name changed
        if (data.name && supplier.account_id) {
            await this.db('accounts')
                .where('id', supplier.account_id)
                .update({ name: `Payable - ${data.name}` });
        }

        return supplier;
    }

    /**
     * List suppliers with pagination
     */
    async list(params) {
        const { page = 1, limit = 50, search, active_only = true } = params;
        const offset = (page - 1) * limit;

        let query = this.db('suppliers').where('is_deleted', false);

        if (active_only) query = query.where('is_active', true);

        if (search) {
            query = query.where((builder) => {
                builder
                    .whereILike('name', `%${search}%`)
                    .orWhereILike('phone_number', `%${search}%`)
                    .orWhereILike('code', `%${search}%`);
            });
        }

        const [{ count }] = await this.db('suppliers').where('is_deleted', false).count();
        const suppliers = await query.orderBy('name').limit(limit).offset(offset);

        return {
            data: suppliers,
            pagination: { page, limit, total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }
}

module.exports = SupplierService;
