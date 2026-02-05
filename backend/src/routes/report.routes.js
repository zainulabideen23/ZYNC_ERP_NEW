const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const ReportService = require('../services/report.service');

const reportService = new ReportService(db);

// Dashboard summary
router.get('/dashboard', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getDashboardStats();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Stock report
router.get('/stock', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getStockReport(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Profit and Loss
router.get('/profit-loss', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const data = await reportService.getProfitAndLoss(from_date, to_date);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Sales summary by date
router.get('/sales/by-date', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        let query = db('sales')
            .where('is_deleted', false)
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
router.get('/trial-balance', authenticate, async (req, res, next) => {
    try {
        const { as_of_date } = req.query;
        
        let query = db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .select(
                'a.id', 'a.code', 'a.name', 'g.name as group_name',
                db.raw('SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) as debits'),
                db.raw('SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) as credits')
            )
            .groupBy('a.id', 'a.code', 'a.name', 'g.name');

        if (as_of_date) query = query.where('j.journal_date', '<=', as_of_date);

        const accounts = await query.orderBy('a.code');

        let totalDebits = 0;
        let totalCredits = 0;
        accounts.forEach(acc => {
            acc.debits = parseFloat(acc.debits) || 0;
            acc.credits = parseFloat(acc.credits) || 0;
            totalDebits += acc.debits;
            totalCredits += acc.credits;
        });

        res.json({
            success: true,
            data: {
                accounts,
                totals: { debits: totalDebits, credits: totalCredits },
                is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
            }
        });
    } catch (error) {
        next(error);
    }
});

// Balance Sheet
router.get('/balance-sheet', authenticate, async (req, res, next) => {
    try {
        const { as_of_date } = req.query;
        
        let query = db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .whereIn('a.account_type', ['asset', 'liability', 'equity'])
            .select(
                'a.id', 'a.code', 'a.name', 'a.account_type', 'g.name as group_name',
                db.raw('SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) - SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) as net_balance')
            )
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'g.name');

        if (as_of_date) query = query.where('j.journal_date', '<=', as_of_date);

        const accounts = await query.orderBy('a.code');

        const assets = [];
        const liabilities = [];
        const equity = [];
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        accounts.forEach(acc => {
            const balance = parseFloat(acc.net_balance) || 0;
            const item = { ...acc, amount: Math.abs(balance) };

            if (acc.account_type === 'asset') {
                assets.push(item);
                totalAssets += balance; // Assets have debit balances
            } else if (acc.account_type === 'liability') {
                liabilities.push(item);
                totalLiabilities += Math.abs(balance); // Liabilities have credit balances
            } else {
                equity.push(item);
                totalEquity += Math.abs(balance);
            }
        });

        // Add net income to equity
        const netIncome = await reportService.getProfitAndLoss(null, as_of_date);
        if (netIncome.net_profit !== 0) {
            equity.push({ name: 'Retained Earnings (Current Period)', amount: netIncome.net_profit });
            totalEquity += netIncome.net_profit;
        }

        res.json({
            success: true,
            data: {
                assets, liabilities, equity,
                total_assets: totalAssets,
                total_liabilities: totalLiabilities,
                total_equity: totalEquity
            }
        });
    } catch (error) {
        next(error);
    }
});

// Sales by Product
router.get('/sales-by-product', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('sale_items as si')
            .join('sales as s', 'si.sale_id', 's.id')
            .join('products as p', 'si.product_id', 'p.id')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .where('s.is_deleted', false)
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
router.get('/sales-by-customer', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .where('s.is_deleted', false)
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
router.get('/purchase-by-supplier', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .where('p.is_deleted', false)
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

// Expense Summary
router.get('/expense-summary', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let query = db('expenses as e')
            .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
            .where('e.is_deleted', false)
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

