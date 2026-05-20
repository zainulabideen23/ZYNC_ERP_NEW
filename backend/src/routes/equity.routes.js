const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const EquityService = require('../services/equity.service');

// Get equity summary (balances of all equity accounts)
router.get('/summary', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const equityService = new EquityService(db, req.tenantId);
        const summary = await equityService.getEquitySummary();
        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
});

// Get equity transactions history
router.get('/transactions', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const equityService = new EquityService(db, req.tenantId);
        const result = await equityService.getEquityTransactions(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Record capital contribution
router.post('/capital', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const equityService = new EquityService(db, req.tenantId);
        const result = await equityService.recordCapitalContribution(req.body, req.user.id);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// Record owner drawing
router.post('/drawing', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const equityService = new EquityService(db, req.tenantId);
        const result = await equityService.recordOwnerDrawing(req.body, req.user.id);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// Year-end closing
router.post('/close-year', authorize('admin'), async (req, res, next) => {
    try {
        const { fiscal_year_end } = req.body;
        const equityService = new EquityService(db, req.tenantId);
        const result = await equityService.closeYear(fiscal_year_end, req.user.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;