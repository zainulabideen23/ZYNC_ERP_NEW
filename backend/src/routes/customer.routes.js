const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const CustomerService = require('../services/customer.service');
const audit = require('../utils/audit');

// Get all customers
router.get('/', authenticate, async (req, res, next) => {
    try {
        const customerService = new CustomerService(db, req.tenantId);
        const result = await customerService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single customer
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const customer = await db('customers')
            .where({ id: req.params.id, is_deleted: false, tenant_id: req.tenantId })
            .first();

        if (!customer) throw new AppError('Customer not found', 404);

        res.json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
});

// Create customer
router.post('/', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const customerService = new CustomerService(db, req.tenantId);
        const customer = await customerService.create(req.body, req.user.id);

        // Audit customer creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'customers',
            recordId: customer.id,
            newValues: { id: customer.id, code: customer.code, name: customer.name, phone_number: customer.phone_number, credit_limit: customer.credit_limit },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: customer });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Customer code already exists', 409));
        }
        next(error);
    }
});

// Update customer
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        // Only admin can change credit_limit
        const updateData = { ...req.body };
        if (req.user.role !== 'admin' && 'credit_limit' in updateData) {
            delete updateData.credit_limit;
        }

        // Fetch old values before update
        const oldCustomer = await db('customers')
            .where({ id: req.params.id, is_deleted: false, tenant_id: req.tenantId })
            .first();

        const customerService = new CustomerService(db, req.tenantId);
        const customer = await customerService.update(req.params.id, updateData, req.user.id);

        // Audit customer update
        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'customers',
            recordId: req.params.id,
            oldValues: { name: oldCustomer?.name, phone_number: oldCustomer?.phone_number, credit_limit: oldCustomer?.credit_limit, is_active: oldCustomer?.is_active },
            newValues: { name: customer.name, phone_number: customer.phone_number, credit_limit: customer.credit_limit, is_active: customer.is_active },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
});

// Delete customer (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        // Fetch customer before deletion
        const oldCustomer = await db('customers')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        await db('customers')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({ is_deleted: true, updated_at: new Date() });

        // Audit customer deletion
        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'customers',
            recordId: req.params.id,
            oldValues: { id: oldCustomer?.id, code: oldCustomer?.code, name: oldCustomer?.name },
            newValues: { is_deleted: true, deleted_at: new Date().toISOString() },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Get customer ledger
router.get('/:id/ledger', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const customer = await db('customers').where('id', req.params.id).where('tenant_id', req.tenantId).first();

        if (!customer) throw new AppError('Customer not found', 404);

        let query = db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .select(
                'le.*',
                'j.journal_date as entry_date',
                'j.journal_number',
                'j.reference_type',
                'j.reference_id',
                'j.description as narration'
            )
            .where('le.account_id', customer.account_id)
            .orderBy('j.journal_date', 'asc')
            .orderBy('le.created_at', 'asc');

        if (from_date) query = query.where('j.journal_date', '>=', from_date);
        if (to_date) query = query.where('j.journal_date', '<=', to_date);

        const entries = await query;

        let balance = parseFloat(customer.opening_balance) || 0;
        const ledger = entries.map(entry => {
            if (entry.entry_type === 'debit') {
                balance += parseFloat(entry.amount);
            } else {
                balance -= parseFloat(entry.amount);
            }
            return { ...entry, running_balance: balance };
        });

        res.json({
            success: true,
            data: {
                customer,
                opening_balance: customer.opening_balance,
                closing_balance: balance,
                entries: ledger
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
