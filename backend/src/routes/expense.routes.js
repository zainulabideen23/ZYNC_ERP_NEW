const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const ExpenseService = require('../services/expense.service');
const LedgerService = require('../services/ledger.service');
const audit = require('../utils/audit');

// Get all expenses
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const ledgerService = new LedgerService(db, req.tenantId);
        const expenseService = new ExpenseService(db, ledgerService, req.tenantId);
        const result = await expenseService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Create expense
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const ledgerService = new LedgerService(db, req.tenantId);
        const expenseService = new ExpenseService(db, ledgerService, req.tenantId);
        const expense = await expenseService.create(req.body, req.user.id);

        // Audit expense creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'expenses',
            recordId: expense.id,
            newValues: { id: expense.id, expense_number: expense.expense_number, category_id: expense.category_id, total_amount: expense.total_amount || expense.amount },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
});

// Get categories
router.get('/categories', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const categories = await db('expense_categories')
            .where('is_active', true)
            .where('tenant_id', req.tenantId)
            .orderBy('name');
        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
});

// Create category
router.post('/categories', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, account_id, description } = req.body;
        const [category] = await db('expense_categories')
            .insert({ name, account_id, description, created_by: req.user.id, tenant_id: req.tenantId })
            .returning('*');
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

// Delete expense (admin only)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
        // Fetch expense before deletion
        const oldExpense = await db('expenses')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        await db('expenses')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({ is_deleted: true, updated_at: new Date() });

        // Audit expense deletion
        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'expenses',
            recordId: req.params.id,
            oldValues: { id: oldExpense?.id, expense_number: oldExpense?.expense_number, total_amount: oldExpense?.total_amount || oldExpense?.amount },
            newValues: { is_deleted: true, deleted_at: new Date().toISOString() },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

