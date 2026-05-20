const { AppError } = require('../middleware/errorHandler');
const LedgerService = require('./ledger.service');
const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('../utils/accountResolver');
const {
    computeAccountOpeningBalanceForDate,
    getLedgerEntriesWithRunningBalance,
} = require('../utils/ledgerQuery');

const CURRENCY_TOLERANCE = 0.01;
const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'y'].includes(normalized);
};

const normalizeOptionalCreditLimit = (rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return null;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new AppError('credit_limit must be a valid non-negative number', 400);
    }

    return roundCurrency(numericValue);
};

class SupplierService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
    }

    async resolvePayablesGroup(trx) {
        let group = await trx('account_groups')
            .where({ tenant_id: this.tenantId, code: '2000' })
            .first();

        if (!group) {
            group = await trx('account_groups')
                .where({ tenant_id: this.tenantId, account_type: 'liability' })
                .whereILike('name', '%payable%')
                .first();
        }

        if (!group) {
            group = await trx('account_groups')
                .where({ tenant_id: this.tenantId, account_type: 'liability' })
                .whereILike('name', '%creditor%')
                .first();
        }

        if (!group) {
            throw new AppError('Payables account group not found', 500);
        }

        return group;
    }

    async createSupplierAccount(trx, { name, userId, group }) {
        const fallbackCodeStart = Number.isFinite(Number.parseInt(group.code, 10))
            ? Number.parseInt(group.code, 10) + 1
            : 2001;

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
                        name: `Payable - ${name}`,
                        group_id: group.id,
                        account_type: 'liability',
                        opening_balance: 0,
                        current_balance: 0,
                        is_system: false,
                        created_by: userId,
                        tenant_id: this.tenantId,
                    }).returning('*');

                    return account;
                } catch (error) {
                    if (error.code !== '23505') {
                        throw error;
                    }
                }
            }
        }

        throw new AppError('Failed to generate a unique supplier account code', 500);
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

    async postOpeningBalanceJournal(trx, { supplier, accountId, openingBalance, userId }) {
        const normalizedOpening = roundCurrency(Number(openingBalance || 0));
        if (!Number.isFinite(normalizedOpening) || normalizedOpening <= CURRENCY_TOLERANCE) {
            return;
        }

        const offsetAccountId = await this.resolveOpeningOffsetAccountId(trx);
        const ledgerService = new LedgerService(this.db, this.tenantId);

        await ledgerService.createJournalEntry({
            journal_date: new Date(),
            transaction_type: 'opening',
            reference_type: 'opening',
            reference_id: supplier.id,
            narration: `Opening Balance - Supplier ${supplier.code || supplier.name}`,
            entries: [
                {
                    account_id: offsetAccountId,
                    entry_type: 'debit',
                    amount: normalizedOpening,
                    narration: `Supplier opening offset ${supplier.name}`,
                },
                {
                    account_id: accountId,
                    entry_type: 'credit',
                    amount: normalizedOpening,
                    narration: `Supplier opening payable ${supplier.name}`,
                },
            ],
            created_by: userId,
        }, trx);

        // Update individual supplier GL account AND 2001 control account
        const systemAccounts = await resolveSystemAccounts(trx, this.tenantId, [SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES]);
        const controlAccountId = systemAccounts[SYSTEM_ACCOUNTS.SUPPLIER_PAYABLES];
        
        // Update individual supplier GL account
        await trx('accounts')
            .where({ id: accountId })
            .increment('current_balance', normalizedOpening);
        
        // Update 2001 control account
        await trx('accounts')
            .where({ id: controlAccountId })
            .increment('current_balance', normalizedOpening);
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
            credit_limit,
            opening_balance = 0
        } = data;

        return await this.db.transaction(async (trx) => {
            if (!name || String(name).trim() === '') {
                throw new AppError('Supplier name is required', 400);
            }

            const numericOpeningBalance = Number(opening_balance || 0);
            const normalizedCreditLimit = normalizeOptionalCreditLimit(credit_limit);
            if (!Number.isFinite(numericOpeningBalance) || numericOpeningBalance < 0) {
                throw new AppError('opening_balance must be a valid non-negative number', 400);
            }

            if (
                normalizedCreditLimit !== null
                && roundCurrency(numericOpeningBalance) > normalizedCreditLimit + CURRENCY_TOLERANCE
            ) {
                throw new AppError('opening_balance cannot exceed credit_limit', 400);
            }

            const group = await this.resolvePayablesGroup(trx);
            const account = await this.createSupplierAccount(trx, {
                name,
                userId,
                group,
            });

            // 2. Create Supplier Record
            const [supplier] = await trx('suppliers').insert({
                code: code || `SUPP-${account.code}`,
                name,
                company_name,
                phone_number,
                email,
                cnic_number,
                address_line1,
                city,
                credit_limit: normalizedCreditLimit,
                opening_balance: numericOpeningBalance,
                current_balance: 0,
                current_credit_used: 0,
                account_id: account.id,
                created_by: userId,
                tenant_id: this.tenantId
            }).returning('*');

            await this.postOpeningBalanceJournal(trx, {
                supplier,
                accountId: account.id,
                openingBalance: numericOpeningBalance,
                userId,
            });

            if (numericOpeningBalance > CURRENCY_TOLERANCE) {
                await trx('suppliers')
                    .where({ id: supplier.id, tenant_id: this.tenantId })
                    .update({
                        current_balance: numericOpeningBalance,
                        current_credit_used: numericOpeningBalance,
                        updated_at: trx.fn.now(),
                    });

                supplier.current_balance = numericOpeningBalance;
                supplier.current_credit_used = numericOpeningBalance;
            }

            return supplier;
        });
    }

    /**
     * Update supplier
     */
    async update(id, data, userId) {
        const existing = await this.db('suppliers')
            .where({ id, is_deleted: false, tenant_id: this.tenantId })
            .first();

        if (!existing) throw new AppError('Supplier not found', 404);

        const updatePayload = { ...data };

        if (data.account_id !== undefined) {
            throw new AppError('Cannot change supplier GL account. Contact administrator.', 400);
        }

        if (Object.prototype.hasOwnProperty.call(updatePayload, 'credit_limit')) {
            const normalizedCreditLimit = normalizeOptionalCreditLimit(updatePayload.credit_limit);
            const currentCreditUsed = roundCurrency(Number(existing.current_credit_used || 0));

            if (
                normalizedCreditLimit !== null
                && currentCreditUsed > normalizedCreditLimit + CURRENCY_TOLERANCE
            ) {
                throw new AppError(
                    `credit_limit cannot be set below current supplier exposure (${currentCreditUsed.toFixed(2)})`,
                    400
                );
            }

            updatePayload.credit_limit = normalizedCreditLimit;
        }

        const [supplier] = await this.db('suppliers')
            .where({ id, is_deleted: false, tenant_id: this.tenantId })
            .update({
                ...updatePayload,
                updated_at: new Date(),
                updated_by: userId
            })
            .returning('*');

        if (!supplier) throw new AppError('Supplier not found', 404);

        // Update Account Name if supplier name changed
        if (updatePayload.name && supplier.account_id) {
            await this.db('accounts')
                .where({ id: supplier.account_id, tenant_id: this.tenantId })
            .update({ name: `Payable - ${updatePayload.name}` });
        }

        return supplier;
    }

    /**
     * List suppliers with pagination
     */
    async list(params) {
        const { page = 1, limit = 50, search, active_only = true } = params;
        const offset = (page - 1) * limit;

        const applyFilters = (builder) => {
            builder.where('s.is_deleted', false).where('s.tenant_id', this.tenantId);

            if (active_only) builder.where('s.is_active', true);

            if (search) {
                builder.where((q) => {
                    q.whereILike('s.name', `%${search}%`)
                        .orWhereILike('s.phone_number', `%${search}%`)
                        .orWhereILike('s.code', `%${search}%`);
                });
            }
        };

        const query = this.db('suppliers as s')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 's.account_id').andOn('a.tenant_id', '=', 's.tenant_id');
            })
            .select('s.*', this.db.raw('COALESCE(a.current_balance, 0) as ledger_balance'));
        applyFilters(query);

        const countQuery = this.db('suppliers as s');
        applyFilters(countQuery);

        const [{ count }] = await countQuery.count('* as count');
        const suppliers = await query.orderBy('s.name').limit(limit).offset(offset);

        return {
            data: suppliers,
            pagination: { page, limit, total: parseInt(count), pages: Math.ceil(count / limit) }
        };
    }

    async reconcileBalances(params = {}) {
        const {
            page = 1,
            limit = 50,
            search,
            only_mismatched = true,
        } = params;

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 50;
        const offset = (pageNumber - 1) * pageLimit;
        const onlyMismatched = parseBoolean(only_mismatched, true);

        const applyFilters = (builder) => {
            builder
                .where('s.tenant_id', this.tenantId)
                .where('s.is_deleted', false);

            if (search) {
                builder.where((q) => {
                    q.whereILike('s.name', `%${search}%`)
                        .orWhereILike('s.code', `%${search}%`);
                });
            }

            if (onlyMismatched) {
                builder.whereRaw('ABS(COALESCE(s.current_balance, 0) - COALESCE(a.current_balance, 0)) > ?', [CURRENCY_TOLERANCE]);
            }
        };

        const baseQuery = this.db('suppliers as s')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 's.account_id').andOn('a.tenant_id', '=', 's.tenant_id');
            })
            .select(
                's.id as supplier_id',
                's.code as supplier_code',
                's.name as supplier_name',
                's.account_id',
                this.db.raw('COALESCE(s.current_balance, 0) as supplier_balance'),
                this.db.raw('COALESCE(a.current_balance, 0) as gl_balance')
            );

        applyFilters(baseQuery);

        const countQuery = this.db('suppliers as s')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 's.account_id').andOn('a.tenant_id', '=', 's.tenant_id');
            });
        applyFilters(countQuery);

        const summary = await this.db('suppliers as s')
            .leftJoin('accounts as a', function joinAccounts() {
                this.on('a.id', '=', 's.account_id').andOn('a.tenant_id', '=', 's.tenant_id');
            })
            .where('s.tenant_id', this.tenantId)
            .where('s.is_deleted', false)
            .first(
                this.db.raw('COUNT(*)::int as total_suppliers'),
                this.db.raw(`SUM(CASE WHEN ABS(COALESCE(s.current_balance, 0) - COALESCE(a.current_balance, 0)) > ${CURRENCY_TOLERANCE} THEN 1 ELSE 0 END)::int as mismatched_suppliers`),
                this.db.raw('COALESCE(SUM(ABS(COALESCE(s.current_balance, 0) - COALESCE(a.current_balance, 0))), 0) as total_absolute_difference')
            );

        const [{ count }] = await countQuery.count('* as count');
        const rows = await baseQuery
            .orderBy('s.name', 'asc')
            .limit(pageLimit)
            .offset(offset);

        const data = rows.map((row) => {
            const supplierBalance = roundCurrency(Number(row.supplier_balance || 0));
            const glBalance = roundCurrency(Number(row.gl_balance || 0));
            const difference = roundCurrency(supplierBalance - glBalance);

            return {
                supplier_id: row.supplier_id,
                supplier_code: row.supplier_code,
                supplier_name: row.supplier_name,
                account_id: row.account_id,
                supplier_balance: supplierBalance,
                gl_balance: glBalance,
                difference,
                is_reconciled: Math.abs(difference) <= CURRENCY_TOLERANCE,
            };
        });

        const total = Number(count || 0);
        const pages = Math.max(1, Math.ceil(total / pageLimit));

        return {
            data,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total,
                pages,
            },
            summary: {
                total_suppliers: Number(summary?.total_suppliers || 0),
                mismatched_suppliers: Number(summary?.mismatched_suppliers || 0),
                reconciled_suppliers: Math.max(0, Number(summary?.total_suppliers || 0) - Number(summary?.mismatched_suppliers || 0)),
                total_absolute_difference: roundCurrency(Number(summary?.total_absolute_difference || 0)),
            },
        };
    }

    async getPurchaseHistory(supplierId, params = {}) {
        const {
            page = 1,
            limit = 50,
            from_date,
            to_date,
            status,
            search,
        } = params;

        const supplier = await this.db('suppliers')
            .where({ id: supplierId, tenant_id: this.tenantId, is_deleted: false })
            .first('id', 'code', 'name', 'current_balance', 'current_credit_used', 'credit_limit');

        if (!supplier) {
            throw new AppError('Supplier not found', 404);
        }

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 50;
        const offset = (pageNumber - 1) * pageLimit;

        const applyFilters = (builder) => {
            builder
                .where('p.tenant_id', this.tenantId)
                .where('p.supplier_id', supplierId)
                .where('p.is_deleted', false)
                .where((q) => q.whereNull('p.is_return').orWhere('p.is_return', false));

            if (status) builder.where('p.status', status);
            if (from_date) builder.where('p.purchase_date', '>=', from_date);
            if (to_date) builder.where('p.purchase_date', '<=', to_date);

            if (search) {
                builder.where((q) => {
                    q.where('p.bill_number', 'ilike', `%${search}%`)
                        .orWhere('p.reference_number', 'ilike', `%${search}%`)
                        .orWhere('p.notes', 'ilike', `%${search}%`);
                });
            }
        };

        const rowsQuery = this.db('purchases as p')
            .select(
                'p.id',
                'p.bill_number',
                'p.purchase_date',
                'p.reference_number',
                'p.subtotal',
                'p.discount_amount',
                'p.tax_amount',
                'p.total_amount',
                'p.amount_paid',
                'p.amount_due',
                'p.payment_method',
                'p.status',
                'p.created_at',
                'p.updated_at'
            );

        applyFilters(rowsQuery);

        const countQuery = this.db('purchases as p');
        applyFilters(countQuery);

        const summaryQuery = this.db('purchases as p').first(
            this.db.raw('COUNT(*)::int as total_purchases'),
            this.db.raw('COALESCE(SUM(p.total_amount), 0) as total_amount'),
            this.db.raw('COALESCE(SUM(p.amount_paid), 0) as total_paid'),
            this.db.raw('COALESCE(SUM(p.amount_due), 0) as total_due')
        );
        applyFilters(summaryQuery);

        const [{ count }, summary] = await Promise.all([
            countQuery.count('* as count'),
            summaryQuery,
        ]);

        const data = await rowsQuery
            .orderBy('p.purchase_date', 'desc')
            .orderBy('p.created_at', 'desc')
            .limit(pageLimit)
            .offset(offset);

        const total = Number(count || 0);

        return {
            supplier,
            data,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total,
                pages: Math.max(1, Math.ceil(total / pageLimit)),
            },
            summary: {
                total_purchases: Number(summary?.total_purchases || 0),
                total_amount: roundCurrency(Number(summary?.total_amount || 0)),
                total_paid: roundCurrency(Number(summary?.total_paid || 0)),
                total_due: roundCurrency(Number(summary?.total_due || 0)),
            },
        };
    }

    async getAgingSummary(supplierId, asOfDate = null) {
        const supplier = await this.db('suppliers')
            .where({ id: supplierId, tenant_id: this.tenantId, is_deleted: false })
            .first('id', 'code', 'name', 'current_balance', 'current_credit_used', 'credit_limit');

        if (!supplier) {
            throw new AppError('Supplier not found', 404);
        }

        const normalizedAsOfDate = asOfDate ? new Date(asOfDate) : new Date();
        if (Number.isNaN(normalizedAsOfDate.getTime())) {
            throw new AppError('Invalid as_of_date', 400);
        }

        const invoices = await this.db('purchases as p')
            .select(
                'p.id',
                'p.bill_number',
                'p.purchase_date',
                'p.total_amount',
                'p.amount_paid',
                'p.amount_due',
                'p.status'
            )
            .where('p.tenant_id', this.tenantId)
            .where('p.supplier_id', supplierId)
            .where('p.is_deleted', false)
            .where((q) => q.whereNull('p.is_return').orWhere('p.is_return', false))
            .whereNot('p.status', 'cancelled')
            .where('p.amount_due', '>', 0)
            .orderBy('p.purchase_date', 'asc')
            .orderBy('p.created_at', 'asc');

        const bucketTemplate = {
            count: 0,
            amount: 0,
        };

        const buckets = {
            current_0_30: { ...bucketTemplate },
            overdue_31_60: { ...bucketTemplate },
            overdue_61_90: { ...bucketTemplate },
            overdue_90_plus: { ...bucketTemplate },
        };

        const invoiceRows = invoices.map((invoice) => {
            const dueAmount = roundCurrency(Number(invoice.amount_due || 0));
            const purchaseDate = invoice.purchase_date ? new Date(invoice.purchase_date) : normalizedAsOfDate;
            const ageInDays = Math.max(0, Math.floor((normalizedAsOfDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)));

            if (ageInDays <= 30) {
                buckets.current_0_30.count += 1;
                buckets.current_0_30.amount = roundCurrency(buckets.current_0_30.amount + dueAmount);
            } else if (ageInDays <= 60) {
                buckets.overdue_31_60.count += 1;
                buckets.overdue_31_60.amount = roundCurrency(buckets.overdue_31_60.amount + dueAmount);
            } else if (ageInDays <= 90) {
                buckets.overdue_61_90.count += 1;
                buckets.overdue_61_90.amount = roundCurrency(buckets.overdue_61_90.amount + dueAmount);
            } else {
                buckets.overdue_90_plus.count += 1;
                buckets.overdue_90_plus.amount = roundCurrency(buckets.overdue_90_plus.amount + dueAmount);
            }

            return {
                ...invoice,
                amount_due: dueAmount,
                age_in_days: ageInDays,
            };
        });

        const totalOutstanding = roundCurrency(invoiceRows.reduce((sum, row) => sum + Number(row.amount_due || 0), 0));

        return {
            supplier,
            as_of_date: normalizedAsOfDate.toISOString(),
            summary: {
                total_outstanding: totalOutstanding,
                total_invoices: invoiceRows.length,
                buckets,
            },
            invoices: invoiceRows,
        };
    }

    async getStatement(supplierId, params = {}) {
        const {
            from_date,
            to_date,
            page,
            limit,
        } = params;

        const supplier = await this.db('suppliers')
            .where({ id: supplierId, tenant_id: this.tenantId, is_deleted: false })
            .first('id', 'code', 'name', 'account_id', 'current_balance', 'current_credit_used', 'credit_limit');

        if (!supplier) {
            throw new AppError('Supplier not found', 404);
        }
        if (!supplier.account_id) {
            throw new AppError('Supplier account is not configured', 500);
        }

        const account = await this.db('accounts')
            .where({ id: supplier.account_id, tenant_id: this.tenantId })
            .first('id', 'code', 'name', 'account_type', 'opening_balance');

        if (!account) {
            throw new AppError('Supplier account not found', 404);
        }

        const openingBalance = await computeAccountOpeningBalanceForDate({
            trx: this.db,
            tenantId: this.tenantId,
            accountId: account.id,
            accountType: account.account_type,
            openingBalance: account.opening_balance,
            fromDate: from_date,
        });

        const ledger = await getLedgerEntriesWithRunningBalance({
            db: this.db,
            tenantId: this.tenantId,
            accountId: account.id,
            accountType: account.account_type,
            fromDate: from_date || null,
            toDate: to_date || null,
            openingBalance,
            page,
            limit,
        });

        return {
            supplier,
            account,
            from_date: from_date || null,
            to_date: to_date || null,
            opening_balance: roundCurrency(openingBalance),
            page_opening_balance: roundCurrency(ledger.pageOpeningBalance),
            closing_balance: roundCurrency(ledger.closingBalance),
            entries: ledger.entries,
            pagination: ledger.pagination,
        };
    }

    async getDashboard(supplierId, params = {}) {
        const { as_of_date = null } = params;

        const supplier = await this.db('suppliers')
            .where({ id: supplierId, tenant_id: this.tenantId, is_deleted: false })
            .first(
                'id',
                'code',
                'name',
                'company_name',
                'phone_number',
                'credit_limit',
                'current_balance',
                'current_credit_used',
                'created_at'
            );

        if (!supplier) {
            throw new AppError('Supplier not found', 404);
        }

        const aging = await this.getAgingSummary(supplierId, as_of_date);

        const [purchaseTotals, paymentTotals, recentPurchases, recentPayments] = await Promise.all([
            this.db('purchases as p')
                .where('p.tenant_id', this.tenantId)
                .where('p.supplier_id', supplierId)
                .where('p.is_deleted', false)
                .where((q) => q.whereNull('p.is_return').orWhere('p.is_return', false))
                .first(
                    this.db.raw('COUNT(*)::int as total_purchases'),
                    this.db.raw('COALESCE(SUM(p.total_amount), 0) as total_amount'),
                    this.db.raw('COALESCE(SUM(p.amount_paid), 0) as total_paid'),
                    this.db.raw('COALESCE(SUM(p.amount_due), 0) as outstanding_amount'),
                    this.db.raw('COUNT(*) FILTER (WHERE p.status = \'draft\')::int as draft_count'),
                    this.db.raw('COUNT(*) FILTER (WHERE p.status = \'cancelled\')::int as cancelled_count')
                ),
            this.db('payments as pay')
                .where('pay.tenant_id', this.tenantId)
                .where('pay.supplier_id', supplierId)
                .where('pay.is_deleted', false)
                .first(
                    this.db.raw('COALESCE(SUM(pay.payment_amount), 0) as total_payments'),
                    this.db.raw('COUNT(*)::int as payment_count'),
                    this.db.raw('MAX(pay.payment_date) as last_payment_date')
                ),
            this.db('purchases as p')
                .where('p.tenant_id', this.tenantId)
                .where('p.supplier_id', supplierId)
                .where('p.is_deleted', false)
                .where((q) => q.whereNull('p.is_return').orWhere('p.is_return', false))
                .select('p.id', 'p.bill_number', 'p.purchase_date', 'p.total_amount', 'p.amount_due', 'p.status')
                .orderBy('p.purchase_date', 'desc')
                .orderBy('p.created_at', 'desc')
                .limit(5),
            this.db('payments as pay')
                .where('pay.tenant_id', this.tenantId)
                .where('pay.supplier_id', supplierId)
                .where('pay.is_deleted', false)
                .select('pay.id', 'pay.payment_date', 'pay.payment_amount', 'pay.payment_method', 'pay.status', 'pay.notes')
                .orderBy('pay.payment_date', 'desc')
                .orderBy('pay.created_at', 'desc')
                .limit(5),
        ]);

        const creditLimit = supplier.credit_limit === null || supplier.credit_limit === undefined
            ? null
            : roundCurrency(Number(supplier.credit_limit || 0));
        const creditUsed = roundCurrency(Number(supplier.current_credit_used || 0));

        const creditUsagePercent = creditLimit && creditLimit > 0
            ? roundCurrency((creditUsed / creditLimit) * 100)
            : null;

        return {
            supplier,
            kpis: {
                total_purchases: Number(purchaseTotals?.total_purchases || 0),
                total_purchase_amount: roundCurrency(Number(purchaseTotals?.total_amount || 0)),
                total_paid: roundCurrency(Number(purchaseTotals?.total_paid || 0)),
                outstanding_amount: roundCurrency(Number(purchaseTotals?.outstanding_amount || 0)),
                payment_count: Number(paymentTotals?.payment_count || 0),
                total_payments: roundCurrency(Number(paymentTotals?.total_payments || 0)),
                last_payment_date: paymentTotals?.last_payment_date || null,
                draft_count: Number(purchaseTotals?.draft_count || 0),
                cancelled_count: Number(purchaseTotals?.cancelled_count || 0),
                credit_limit: creditLimit,
                credit_used: creditUsed,
                credit_usage_percent: creditUsagePercent,
            },
            aging: aging.summary,
            recent_purchases: recentPurchases,
            recent_payments: recentPayments,
        };
    }
}

module.exports = SupplierService;
