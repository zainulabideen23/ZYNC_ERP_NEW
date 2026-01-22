const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const ExpenseService = require('../services/expense.service');

const expenseService = new ExpenseService(db);

// Get all expenses
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await expenseService.getExpenses(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Create expense
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const expense = await expenseService.createExpense({
            ...req.body,
            created_by: req.user.id
        });
        res.status(201).json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
});

// Get categories
router.get('/categories', authenticate, async (req, res, next) => {
    try {
        const categories = await expenseService.getCategories();
        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
});

// Create category
router.post('/categories', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const category = await expenseService.createCategory(req.body);
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
