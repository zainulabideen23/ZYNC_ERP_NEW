const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const ExpenseService = require('../services/expense.service');
const LedgerService = require('../services/ledger.service');

const ledgerService = new LedgerService(db);
const expenseService = new ExpenseService(db, ledgerService);

// Get all expenses
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await expenseService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Create expense
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const expense = await expenseService.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
});

// Get categories
router.get('/categories', authenticate, async (req, res, next) => {
    try {
        const categories = await db('expense_categories')
            .where('is_active', true)
            .orderBy('name');
        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
});

// Create category
router.post('/categories', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, account_id, description } = req.body;
        const [category] = await db('expense_categories')
            .insert({ name, account_id, description, created_by: req.user.id })
            .returning('*');
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

