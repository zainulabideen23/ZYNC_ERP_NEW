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

// Sales by date
router.get('/sales/by-date', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        let query = db('sales')
            .where('status', 'completed')
            .select(
                'invoice_date',
                db.raw('COUNT(*) as invoices'),
                db.raw('SUM(total_amount) as total'),
                db.raw('SUM(paid_amount) as received'),
                db.raw('SUM(balance_amount) as credit')
            )
            .groupBy('invoice_date')
            .orderBy('invoice_date', 'desc');

        if (from_date) query = query.where('invoice_date', '>=', from_date);
        if (to_date) query = query.where('invoice_date', '<=', to_date);

        const report = await query;
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
});

// Trial Balance
router.get('/trial-balance', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getTrialBalance(req.query.as_of_date);
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

// Balance Sheet
router.get('/balance-sheet', authenticate, async (req, res, next) => {
    try {
        const { as_of_date } = req.query;
        const data = await reportService.getBalanceSheet(as_of_date);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Breakdown Reports
router.get('/sales-by-product', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getSalesByProduct(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

router.get('/sales-by-customer', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getSalesByCustomer(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

router.get('/purchase-by-supplier', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getPurchaseBySupplier(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

router.get('/expense-summary', authenticate, async (req, res, next) => {
    try {
        const data = await reportService.getExpenseSummary(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

module.exports = router;
