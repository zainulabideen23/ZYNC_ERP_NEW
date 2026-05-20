const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const ReportService = require('../services/report.service');

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const buildLedgerMovementSubquery = (tenantId, asOfDate = null) => {
    const movement = db('ledger_entries as le')
        .join('journals as j', 'le.journal_id', 'j.id')
        .where('le.tenant_id', tenantId)
        .where('j.tenant_id', tenantId)
        .modify((q) => {
            if (asOfDate) q.where('j.journal_date', '<=', asOfDate);
        })
        .groupBy('le.account_id')
        .select(
            'le.account_id',
            db.raw('COALESCE(SUM(CASE WHEN le.entry_type = ? THEN le.amount ELSE 0 END), 0) as debit_total', ['debit']),
            db.raw('COALESCE(SUM(CASE WHEN le.entry_type = ? THEN le.amount ELSE 0 END), 0) as credit_total', ['credit'])
        );

    return movement;
};

const computeAccountBalance = (accountType, openingBalance, debitTotal, creditTotal) => {
    const opening = Number(openingBalance || 0);
    const debits = Number(debitTotal || 0);
    const credits = Number(creditTotal || 0);

    if (['asset', 'expense'].includes(accountType)) {
        return opening + debits - credits;
    }
    return opening + credits - debits;
};

const formatDateOnly = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

const getFiscalPeriodStart = async (tenantId, asOfDate) => {
    const asOf = new Date(asOfDate || new Date());
    if (Number.isNaN(asOf.getTime())) {
        throw new Error('Invalid as_of_date');
    }

    const companyInfo = await db('company_info')
        .where('tenant_id', tenantId)
        .select('financial_year_start')
        .first();

    const configuredStartMonth = Number(companyInfo?.financial_year_start || 1);
    const fiscalStartMonth = Math.min(Math.max(configuredStartMonth, 1), 12) - 1;

    const fiscalYear = asOf.getMonth() >= fiscalStartMonth
        ? asOf.getFullYear()
        : asOf.getFullYear() - 1;

    return formatDateOnly(new Date(Date.UTC(fiscalYear, fiscalStartMonth, 1)));
};

// Dashboard summary
router.get('/dashboard', async (req, res, next) => {
    try {
        const reportService = new ReportService(db, req.tenantId);
        const data = await reportService.getDashboardStats();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Stock report
router.get('/stock', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const reportService = new ReportService(db, req.tenantId);
        const data = await reportService.getStockReport(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Profit and Loss
router.get('/profit-loss', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const reportService = new ReportService(db, req.tenantId);
        const { from_date, to_date } = req.query;
        const data = await reportService.getProfitAndLoss(from_date, to_date);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Sales summary by date
router.get('/sales/by-date', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        let query = db('sales')
            .where('is_deleted', false)
            .where('tenant_id', req.tenantId)
            .select(
                'sale_date as invoice_date',
                db.raw('COUNT(*) as invoices'),
                db.raw('SUM(total_amount) as total'),
                db.raw('SUM(amount_paid) as received'),
                db.raw('SUM(amount_due) as credit')
            )
            .groupBy('sale_date')
            .orderBy('sale_date', 'desc');

        if (from_date) query = query.where('sale_date', '>=', from_date);
        if (to_date) query = query.where('sale_date', '<=', to_date);

        const report = await query;
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
});

// Trial Balance
router.get('/trial-balance', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { as_of_date } = req.query;

        const movements = buildLedgerMovementSubquery(req.tenantId, as_of_date);

        const rows = await db('accounts as a')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .leftJoin(movements.as('m'), 'm.account_id', 'a.id')
            .where('a.tenant_id', req.tenantId)
            .where('a.is_active', true)
            .select(
                'a.id',
                'a.code',
                'a.name',
                'a.account_type',
                'a.opening_balance',
                'g.name as group_name',
                db.raw('COALESCE(m.debit_total, 0) as debit_total'),
                db.raw('COALESCE(m.credit_total, 0) as credit_total')
            )
            .orderBy('a.code');

        let totalDebits = 0;
        let totalCredits = 0;
        const accounts = rows.map((row) => {
            const balance = computeAccountBalance(
                row.account_type,
                row.opening_balance,
                row.debit_total,
                row.credit_total
            );

            let debit = 0;
            let credit = 0;
            if (['asset', 'expense'].includes(row.account_type)) {
                if (balance >= 0) debit = balance;
                else credit = Math.abs(balance);
            } else {
                if (balance >= 0) credit = balance;
                else debit = Math.abs(balance);
            }

            totalDebits += debit;
            totalCredits += credit;

            return {
                id: row.id,
                code: row.code,
                name: row.name,
                group_name: row.group_name,
                account_type: row.account_type,
                opening_balance: Number(row.opening_balance || 0),
                balance: round2(balance),
                debits: round2(debit),
                credits: round2(credit),
            };
        });

        res.json({
            success: true,
            data: {
                accounts,
                totals: {
                    debits: round2(totalDebits),
                    credits: round2(totalCredits),
                },
                is_balanced: Math.abs(totalDebits - totalCredits) < 0.01,
            }
        });
    } catch (error) {
        next(error);
    }
});

// Balance Sheet
router.get('/balance-sheet', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { as_of_date } = req.query;
        const asOfDate = as_of_date || formatDateOnly(new Date());

        if (Number.isNaN(new Date(asOfDate).getTime())) {
            return res.status(400).json({ error: 'Invalid as_of_date' });
        }

        const movements = buildLedgerMovementSubquery(req.tenantId, asOfDate);

        const accounts = await db('accounts as a')
            .leftJoin('account_groups as g', 'a.group_id', 'g.id')
            .leftJoin(movements.as('m'), 'm.account_id', 'a.id')
            .where('a.tenant_id', req.tenantId)
            .where('a.is_active', true)
            .whereIn('a.account_type', ['asset', 'liability', 'equity'])
            .select(
                'a.id',
                'a.code',
                'a.name',
                'a.account_type',
                'a.opening_balance',
                'g.name as group_name',
                db.raw('COALESCE(m.debit_total, 0) as debit_total'),
                db.raw('COALESCE(m.credit_total, 0) as credit_total')
            )
            .orderBy('a.code');

        const assets = [];
        const liabilities = [];
        const equity = [];
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        accounts.forEach((acc) => {
            const balance = computeAccountBalance(
                acc.account_type,
                acc.opening_balance,
                acc.debit_total,
                acc.credit_total
            );

            const item = {
                ...acc,
                amount: round2(Math.abs(balance)),
                balance: round2(balance),
            };

            if (acc.account_type === 'asset') {
                assets.push(item);
                totalAssets += balance;
            } else if (acc.account_type === 'liability') {
                liabilities.push(item);
                totalLiabilities += balance;
            } else {
                equity.push(item);
                totalEquity += balance;
            }
        });

        // Add fiscal-period net income to equity instead of cumulative inception-to-date profit.
        const netIncomePeriodStart = await getFiscalPeriodStart(req.tenantId, asOfDate);
        const netIncome = await new ReportService(db, req.tenantId).getProfitAndLoss(netIncomePeriodStart, asOfDate);
        if (Math.abs(netIncome.net_profit) >= 0.01) {
            equity.push({ name: 'Retained Earnings (Current Period)', amount: round2(netIncome.net_profit) });
            totalEquity += netIncome.net_profit;
        }

        res.json({
            success: true,
            data: {
                assets, liabilities, equity,
                total_assets: round2(totalAssets),
                total_liabilities: round2(totalLiabilities),
                total_equity: round2(totalEquity),
                net_income_period_start: netIncomePeriodStart,
            }
        });
    } catch (error) {
        next(error);
    }
});

// Sales by Product
router.get('/sales-by-product', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('sale_items as si')
            .join('sales as s', 'si.sale_id', 's.id')
            .join('products as p', 'si.product_id', 'p.id')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .where('s.is_deleted', false)
            .where('s.tenant_id', req.tenantId)
            .select(
                'p.name as product_name',
                'p.code as product_code',
                'c.name as category',
                db.raw('SUM(si.quantity) as total_quantity'),
                db.raw('SUM(si.line_total) as total_revenue')
            )
            .groupBy('p.id', 'p.name', 'p.code', 'c.name');

        if (from_date) query = query.where('s.sale_date', '>=', from_date);
        if (to_date) query = query.where('s.sale_date', '<=', to_date);

        const report = await query.orderBy('total_revenue', 'desc');
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
});

// Sales by Customer
router.get('/sales-by-customer', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .where('s.is_deleted', false)
            .where('s.tenant_id', req.tenantId)
            .select(
                db.raw('COALESCE(c.name, \'Walk-in Customer\') as customer_name'),
                'c.phone_number as phone',
                db.raw('COUNT(s.id) as total_invoices'),
                db.raw('SUM(s.total_amount) as total_spent'),
                db.raw('SUM(s.amount_due) as outstanding_balance')
            )
            .groupBy('c.id', 'c.name', 'c.phone_number');

        if (from_date) query = query.where('s.sale_date', '>=', from_date);
        if (to_date) query = query.where('s.sale_date', '<=', to_date);

        const report = await query.orderBy('total_spent', 'desc');
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
});

// Purchase by Supplier
router.get('/purchase-by-supplier', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .where('p.is_deleted', false)
            .where('p.tenant_id', req.tenantId)
            .select(
                db.raw('COALESCE(s.name, \'Unknown Supplier\') as supplier_name'),
                's.contact_person',
                db.raw('COUNT(p.id) as total_bills'),
                db.raw('SUM(p.total_amount) as total_purchased'),
                db.raw('SUM(p.amount_due) as outstanding_balance')
            )
            .groupBy('s.id', 's.name', 's.contact_person');

        if (from_date) query = query.where('p.purchase_date', '>=', from_date);
        if (to_date) query = query.where('p.purchase_date', '<=', to_date);

        const report = await query.orderBy('total_purchased', 'desc');
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
});

// Purchase report (transaction-level with summary + pagination)
router.get('/purchases', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const {
            from_date,
            to_date,
            supplier_id,
            status,
            search,
            page = 1,
            limit = 50,
        } = req.query;

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 50;
        const offset = (pageNumber - 1) * pageLimit;

        const statusList = String(status || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        const applyFilters = (builder) => {
            builder
                .where('p.tenant_id', req.tenantId)
                .where('p.is_deleted', false)
                .where((q) => q.whereNull('p.is_return').orWhere('p.is_return', false));

            if (from_date) builder.where('p.purchase_date', '>=', from_date);
            if (to_date) builder.where('p.purchase_date', '<=', to_date);
            if (supplier_id) builder.where('p.supplier_id', supplier_id);
            if (statusList.length > 0) builder.whereIn('p.status', statusList);

            if (search) {
                builder.where((q) => {
                    q.whereILike('p.bill_number', `%${search}%`)
                        .orWhereILike('p.reference_number', `%${search}%`)
                        .orWhereILike('s.name', `%${search}%`);
                });
            }
        };

        const rowsQuery = db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select(
                'p.id',
                'p.bill_number',
                'p.purchase_date',
                'p.reference_number',
                'p.status',
                'p.subtotal',
                'p.discount_amount',
                'p.tax_amount',
                'p.total_amount',
                'p.amount_paid',
                'p.amount_due',
                's.id as supplier_id',
                's.name as supplier_name'
            );
        applyFilters(rowsQuery);

        const countQuery = db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id');
        applyFilters(countQuery);

        const summaryQuery = db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .first(
                db.raw('COUNT(DISTINCT p.id)::int as total_bills'),
                db.raw('COALESCE(SUM(p.total_amount), 0) as total_amount'),
                db.raw('COALESCE(SUM(p.amount_paid), 0) as total_paid'),
                db.raw('COALESCE(SUM(p.amount_due), 0) as total_due')
            );
        applyFilters(summaryQuery);

        const [{ count }, summary] = await Promise.all([
            countQuery.countDistinct('p.id as count'),
            summaryQuery,
        ]);

        const rows = await rowsQuery
            .orderBy('p.purchase_date', 'desc')
            .orderBy('p.created_at', 'desc')
            .limit(pageLimit)
            .offset(offset);

        const total = Number(count || 0);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total,
                pages: Math.max(1, Math.ceil(total / pageLimit)),
            },
            summary: {
                total_bills: Number(summary?.total_bills || 0),
                total_amount: round2(summary?.total_amount || 0),
                total_paid: round2(summary?.total_paid || 0),
                total_due: round2(summary?.total_due || 0),
            },
        });
    } catch (error) {
        next(error);
    }
});

// Supplier aging report (all suppliers)
router.get('/suppliers/aging', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { as_of_date } = req.query;
        const asOfDate = as_of_date || formatDateOnly(new Date());

        if (Number.isNaN(new Date(asOfDate).getTime())) {
            return res.status(400).json({ error: 'Invalid as_of_date' });
        }

        const rows = await db('purchases as p')
            .join('suppliers as s', 'p.supplier_id', 's.id')
            .where('p.tenant_id', req.tenantId)
            .where('p.is_deleted', false)
            .where((q) => q.whereNull('p.is_return').orWhere('p.is_return', false))
            .whereNot('p.status', 'cancelled')
            .where('p.amount_due', '>', 0)
            .select(
                's.id as supplier_id',
                's.code as supplier_code',
                's.name as supplier_name',
                db.raw('COUNT(*)::int as open_invoices'),
                db.raw("COALESCE(SUM(CASE WHEN GREATEST(DATE_PART('day', ?::timestamp - p.purchase_date::timestamp), 0) <= 30 THEN p.amount_due ELSE 0 END), 0) as current_0_30", [asOfDate]),
                db.raw("COALESCE(SUM(CASE WHEN GREATEST(DATE_PART('day', ?::timestamp - p.purchase_date::timestamp), 0) BETWEEN 31 AND 60 THEN p.amount_due ELSE 0 END), 0) as overdue_31_60", [asOfDate]),
                db.raw("COALESCE(SUM(CASE WHEN GREATEST(DATE_PART('day', ?::timestamp - p.purchase_date::timestamp), 0) BETWEEN 61 AND 90 THEN p.amount_due ELSE 0 END), 0) as overdue_61_90", [asOfDate]),
                db.raw("COALESCE(SUM(CASE WHEN GREATEST(DATE_PART('day', ?::timestamp - p.purchase_date::timestamp), 0) > 90 THEN p.amount_due ELSE 0 END), 0) as overdue_90_plus", [asOfDate]),
                db.raw('COALESCE(SUM(p.amount_due), 0) as total_due')
            )
            .groupBy('s.id', 's.code', 's.name')
            .orderBy('total_due', 'desc');

        const totals = rows.reduce((acc, row) => {
            acc.open_invoices += Number(row.open_invoices || 0);
            acc.current_0_30 += Number(row.current_0_30 || 0);
            acc.overdue_31_60 += Number(row.overdue_31_60 || 0);
            acc.overdue_61_90 += Number(row.overdue_61_90 || 0);
            acc.overdue_90_plus += Number(row.overdue_90_plus || 0);
            acc.total_due += Number(row.total_due || 0);
            return acc;
        }, {
            open_invoices: 0,
            current_0_30: 0,
            overdue_31_60: 0,
            overdue_61_90: 0,
            overdue_90_plus: 0,
            total_due: 0,
        });

        res.json({
            success: true,
            data: rows,
            summary: {
                supplier_count: rows.length,
                open_invoices: totals.open_invoices,
                current_0_30: round2(totals.current_0_30),
                overdue_31_60: round2(totals.overdue_31_60),
                overdue_61_90: round2(totals.overdue_61_90),
                overdue_90_plus: round2(totals.overdue_90_plus),
                total_due: round2(totals.total_due),
            },
            as_of_date: asOfDate,
        });
    } catch (error) {
        next(error);
    }
});

// Stock movement report
router.get('/stock-movements', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const {
            from_date,
            to_date,
            product_id,
            movement_type,
            reference_type,
            search,
            page = 1,
            limit = 100,
        } = req.query;

        const pageNumber = Number(page) > 0 ? Number(page) : 1;
        const pageLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 100;
        const offset = (pageNumber - 1) * pageLimit;

        const applyFilters = (builder) => {
            builder
                .where('sm.tenant_id', req.tenantId)
                .where('p.tenant_id', req.tenantId)
                .where('p.is_deleted', false);

            if (from_date) builder.where('sm.created_at', '>=', from_date);
            if (to_date) builder.where('sm.created_at', '<=', `${to_date} 23:59:59`);
            if (product_id) builder.where('sm.product_id', product_id);
            if (movement_type) builder.where('sm.movement_type', movement_type);
            if (reference_type) builder.where('sm.reference_type', reference_type);

            if (search) {
                builder.where((q) => {
                    q.whereILike('p.name', `%${search}%`)
                        .orWhereILike('p.code', `%${search}%`)
                        .orWhereILike('sm.notes', `%${search}%`)
                        .orWhereRaw('CAST(sm.reference_id AS text) ILIKE ?', [`%${search}%`]);
                });
            }
        };

        const rowsQuery = db('stock_movements as sm')
            .join('products as p', 'sm.product_id', 'p.id')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .select(
                'sm.id',
                'sm.created_at',
                'sm.product_id',
                'p.code as product_code',
                'p.name as product_name',
                'c.name as category_name',
                'sm.movement_type',
                'sm.reference_type',
                'sm.reference_id',
                'sm.quantity',
                'sm.unit_cost',
                'sm.notes',
                db.raw('COALESCE(sm.quantity * sm.unit_cost, 0) as movement_value')
            );
        applyFilters(rowsQuery);

        const countQuery = db('stock_movements as sm')
            .join('products as p', 'sm.product_id', 'p.id');
        applyFilters(countQuery);

        const summaryQuery = db('stock_movements as sm')
            .join('products as p', 'sm.product_id', 'p.id')
            .first(
                db.raw('COUNT(*)::int as total_movements'),
                db.raw("COALESCE(SUM(CASE WHEN sm.movement_type IN ('IN', 'RETURN') THEN sm.quantity ELSE 0 END), 0) as total_in_qty"),
                db.raw("COALESCE(SUM(CASE WHEN sm.movement_type IN ('OUT', 'DAMAGE') THEN sm.quantity ELSE 0 END), 0) as total_out_qty"),
                db.raw("COALESCE(SUM(CASE WHEN sm.movement_type = 'ADJUSTMENT' THEN sm.quantity ELSE 0 END), 0) as total_adjustment_qty"),
                db.raw('COALESCE(SUM(sm.quantity * sm.unit_cost), 0) as total_movement_value')
            );
        applyFilters(summaryQuery);

        const [{ count }, summary] = await Promise.all([
            countQuery.count('sm.id as count'),
            summaryQuery,
        ]);

        const rows = await rowsQuery
            .orderBy('sm.created_at', 'desc')
            .limit(pageLimit)
            .offset(offset);

        const total = Number(count || 0);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageNumber,
                limit: pageLimit,
                total,
                pages: Math.max(1, Math.ceil(total / pageLimit)),
            },
            summary: {
                total_movements: Number(summary?.total_movements || 0),
                total_in_qty: round2(summary?.total_in_qty || 0),
                total_out_qty: round2(summary?.total_out_qty || 0),
                total_adjustment_qty: round2(summary?.total_adjustment_qty || 0),
                total_movement_value: round2(summary?.total_movement_value || 0),
            },
        });
    } catch (error) {
        next(error);
    }
});

// Expense Summary
router.get('/expense-summary', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('expenses as e')
            .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
            .where('e.is_deleted', false)
            .where('e.tenant_id', req.tenantId)
            .select(
                db.raw('COALESCE(ec.name, \'Uncategorized\') as category'),
                db.raw('COUNT(e.id) as count'),
                db.raw('SUM(e.amount) as total_amount')
            )
            .groupBy('ec.id', 'ec.name');

        if (from_date) query = query.where('e.expense_date', '>=', from_date);
        if (to_date) query = query.where('e.expense_date', '<=', to_date);

        const report = await query.orderBy('total_amount', 'desc');
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

