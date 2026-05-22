const { AppError } = require('../middleware/errorHandler');
const LedgerService = require('./ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');

const CURRENCY_TOLERANCE = 0.01;
const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

class CustomerService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
    }

    async resolveReceivablesGroup(trx) {
        let group = await trx('account_groups')
            .where({ tenant_id: this.tenantId, code: '1200' })
            .first();

        if (!group) {
            group = await trx('account_groups')
                .where({ tenant_id: this.tenantId, account_type: 'asset' })
                .whereILike('name', '%receivable%')
                .first();
        }

        if (!group) {
            group = await trx('account_groups')
                .where({ tenant_id: this.tenantId, account_type: 'asset' })
                .whereILike('name', '%debtor%')
                .first();
        }

        if (!group) {
            throw new AppError('Receivables account group not found', 500);
        }

        return group;
    }

    async createCustomerAccount(trx, { name, userId, group }) {
        const fallbackCodeStart = Number.isFinite(Number.parseInt(group.code, 10))
            ? Number.parseInt(group.code, 10) + 1
            : 1201;

        for (let attempt = 0; attempt < 8; attempt++) {
            const lastAccount = await trx('accounts')
                .where('group_id', group.id)
                .where('tenant_id', this.tenantId)
                .whereRaw("code ~ '^[0-9]+$'")
                .orderByRaw('CAST(code AS INTEGER) DESC')
                .forUpdate()
                .first();

            const nextNumericCode = (
                lastAccount?.code
                    ? Number.parseInt(lastAccount.code, 10) + 1
                    : fallbackCodeStart
            );

            for (let offset = 0; offset < 25; offset++) {
                const nextCode = String(nextNumericCode + offset);
                const existingCode = await trx('accounts')
                    .where({ tenant_id: this.tenantId, code: nextCode })
                    .first('id');

                if (existingCode) {
                    continue;
                }

                try {
                    const [account] = await trx('accounts').insert({
                        code: nextCode,
                        name: `Receivable - ${name}`,
                        group_id: group.id,
                        account_type: 'asset',
                        opening_balance: 0,
                        current_balance: 0,
                        is_system: false,
                        created_by: userId,
                        tenant_id: this.tenantId,
                    }).returning('*');

                    // Update 1201 control account to include new customer account
                    const controlAccount = await trx('accounts')
                        .where({ tenant_id: this.tenantId, code: '1201' })
                        .first();
                    
                    if (controlAccount) {
                        await trx('accounts')
                            .where({ id: controlAccount.id })
                            .increment('current_balance', 0); // Will be updated on transactions
                    }

                    return account;
                } catch (error) {
                    if (error.code !== '23505') {
                        throw error;
                    }
                }
            }
        }

        throw new AppError('Failed to generate a unique customer account code', 500);
    }

    async resolveOpeningOffsetAccountId(trx) {
        try {
            const ownerCapitalMap = await resolveSystemAccounts(trx, this.tenantId, [SYSTEM_ACCOUNTS.OWNER_CAPITAL]);
            return ownerCapitalMap[SYSTEM_ACCOUNTS.OWNER_CAPITAL];
        } catch (_) {
            const retainedEarningsMap = await resolveSystemAccounts(trx, this.tenantId, [SYSTEM_ACCOUNTS.RETAINED_EARNINGS]);
            return retainedEarningsMap[SYSTEM_ACCOUNTS.RETAINED_EARNINGS];
        }
    }

    async postOpeningBalanceJournal(trx, { customer, accountId, openingBalance, userId }) {
        const normalizedOpening = roundCurrency(Number(openingBalance || 0));
        if (!Number.isFinite(normalizedOpening) || normalizedOpening <= CURRENCY_TOLERANCE) {
            return;
        }

        const offsetAccountId = await this.resolveOpeningOffsetAccountId(trx);
        const ledgerService = new LedgerService(this.db, this.tenantId);

        // Create journal entry for customer's opening balance
        await ledgerService.createJournalEntry({
            journal_date: new Date(),
            transaction_type: 'opening',
            reference_type: 'opening',
            reference_id: customer.id,
            narration: `Opening Balance - Customer ${customer.code || customer.name}`,
            entries: [
                {
                    account_id: accountId,
                    entry_type: 'debit',
                    amount: normalizedOpening,
                    narration: `Customer opening receivable ${customer.name}`,
                },
                {
                    account_id: offsetAccountId,
                    entry_type: 'credit',
                    amount: normalizedOpening,
                    narration: `Customer opening offset ${customer.name}`,
                },
            ],
            created_by: userId,
        }, trx);

        // Also update individual GL account AND 1201 control account
        const systemAccounts = await resolveSystemAccounts(trx, this.tenantId, [SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES]);
        const controlAccountId = systemAccounts[SYSTEM_ACCOUNTS.CUSTOMER_RECEIVABLES];
        
        // Update individual customer GL account
        await trx('accounts')
            .where({ id: accountId })
            .increment('current_balance', normalizedOpening);
        
        // Update 1201 control account
        await trx('accounts')
            .where({ id: controlAccountId })
            .increment('current_balance', normalizedOpening);
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
            phone_number_alt,
            email,
            cnic_number,
            address_line1,
            address_line2,
            city,
            province_state,
            postal_code,
            country = 'Pakistan',
            credit_limit = 0,
            opening_balance = 0
        } = data;

        return await this.db.transaction(async (trx) => {
            if (!name || String(name).trim() === '') {
                throw new AppError('Customer name is required', 400);
            }

            const numericOpeningBalance = Number(opening_balance || 0);
            const numericCreditLimit = Number(credit_limit || 0);

            if (!Number.isFinite(numericOpeningBalance) || numericOpeningBalance < 0) {
                throw new AppError('opening_balance must be a valid non-negative number', 400);
            }
            if (!Number.isFinite(numericCreditLimit) || numericCreditLimit < 0) {
                throw new AppError('credit_limit must be a valid non-negative number', 400);
            }

            const group = await this.resolveReceivablesGroup(trx);
            const account = await this.createCustomerAccount(trx, {
                name,
                userId,
                group,
            });

            // 2. Create Customer Record
            const [customer] = await trx('customers').insert({
                code: code || `CUST-${account.code}`,
                name,
                company_name,
                phone_number,
                phone_number_alt,
                email,
                cnic_number,
                address_line1,
                address_line2,
                city,
                province_state,
                postal_code,
                country,
                credit_limit: numericCreditLimit,
                opening_balance: numericOpeningBalance,
                current_balance: 0,
                current_credit_used: 0,
                account_id: account.id,
                created_by: userId,
                tenant_id: this.tenantId
            }).returning('*');

            await this.postOpeningBalanceJournal(trx, {
                customer,
                accountId: account.id,
                openingBalance: numericOpeningBalance,
                userId,
            });

            if (numericOpeningBalance > CURRENCY_TOLERANCE) {
                await trx('customers')
                    .where({ id: customer.id, tenant_id: this.tenantId })
                    .update({
                        current_balance: numericOpeningBalance,
                        current_credit_used: numericOpeningBalance,
                        updated_at: trx.fn.now(),
                    });

                customer.current_balance = numericOpeningBalance;
                customer.current_credit_used = numericOpeningBalance;
            }

            return customer;
        });
    }

/**
     * Update customer
     */
    async update(id, data, userId) {
        if (Object.prototype.hasOwnProperty.call(data, 'credit_limit')) {
            const numericCreditLimit = Number(data.credit_limit);
            if (!Number.isFinite(numericCreditLimit) || numericCreditLimit < 0) {
                throw new AppError('Credit limit must be a valid non-negative number', 400);
            }
            data.credit_limit = numericCreditLimit;
        }

        if (data.account_id !== undefined) {
            throw new AppError('Cannot change customer GL account. Contact administrator.', 400);
        }

        const [customer] = await this.db('customers')
            .where({ id, is_deleted: false, tenant_id: this.tenantId })
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
                .where({ id: customer.account_id, tenant_id: this.tenantId })
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

        let query = this.db('customers as c')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 'c.account_id').andOn('a.tenant_id', '=', 'c.tenant_id');
            })
            .where('c.is_deleted', false)
            .where('c.tenant_id', this.tenantId)
            .select('c.*', this.db.raw('COALESCE(a.current_balance, 0) as ledger_balance'));

        if (active_only) query = query.where('c.is_active', true);

        if (search) {
            query = query.where((builder) => {
                builder
                    .whereILike('c.name', `%${search}%`)
                    .orWhereILike('c.phone_number', `%${search}%`)
                    .orWhereILike('c.code', `%${search}%`);
            });
        }

        const countQuery = this.db('customers as c')
            .where('c.is_deleted', false)
            .where('c.tenant_id', this.tenantId);

        if (active_only) countQuery.where('c.is_active', true);
        if (search) {
            countQuery.where((builder) => {
                builder
                    .whereILike('c.name', `%${search}%`)
                    .orWhereILike('c.phone_number', `%${search}%`)
                    .orWhereILike('c.code', `%${search}%`);
            });
        }

        const [{ count }] = await countQuery.count('* as count');
        const customers = await query.orderBy('c.name').limit(limit).offset(offset);

        return {
            data: customers,
            pagination: { page, limit, total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }

    /**
     * Get customer's total outstanding from previous invoices.
     *
     * Outstanding is based on invoice total less amount paid and excludes:
     * - the currently processed sale (excludeSaleId)
     * - return invoices
     * - deleted invoices
     */
    async getCustomerTotalOutstanding(customerId, excludeSaleId = null, query = null) {
        if (!customerId) return 0;

        const executor = query || this.db;
        let outstandingQuery = executor('sales')
            .where({
                tenant_id: this.tenantId,
                customer_id: customerId,
                is_deleted: false,
            })
            .where((builder) => {
                builder.whereNull('is_return').orWhere('is_return', false);
            })
            .whereNotIn(executor.raw('status::text'), ['cancelled', 'returned', 'draft'])
            .whereRaw('GREATEST(total_amount - COALESCE(amount_paid, 0), 0) > ?', [CURRENCY_TOLERANCE]);

        if (excludeSaleId) {
            outstandingQuery = outstandingQuery.whereNot('id', excludeSaleId);
        }

        const [{ total_outstanding = 0 }] = await outstandingQuery.sum({
            total_outstanding: executor.raw('GREATEST(total_amount - COALESCE(amount_paid, 0), 0)'),
        });

        const normalized = Number(total_outstanding || 0);
        if (!Number.isFinite(normalized) || normalized <= CURRENCY_TOLERANCE) return 0;
        return roundCurrency(normalized);
    }
}

module.exports = CustomerService;
