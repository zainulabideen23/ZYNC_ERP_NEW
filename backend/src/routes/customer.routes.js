const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Get all customers
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 50, search, active_only = true } = req.query;
        const offset = (page - 1) * limit;

        let query = db('customers').select('*');

        if (active_only === 'true') {
            query = query.where('is_active', true);
        }

        if (search) {
            query = query.where((builder) => {
                builder
                    .whereILike('name', `%${search}%`)
                    .orWhereILike('phone', `%${search}%`)
                    .orWhereILike('code', `%${search}%`);
            });
        }

        const [{ count }] = await db('customers').where(active_only === 'true' ? { is_active: true } : {}).count();
        const customers = await query.orderBy('name').limit(limit).offset(offset);

        res.json({
            success: true,
            data: customers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(count),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Search by phone (for quick lookup)
router.get('/search/phone/:phone', authenticate, async (req, res, next) => {
    try {
        const customers = await db('customers')
            .whereILike('phone', `%${req.params.phone}%`)
            .orWhereILike('phone_alt', `%${req.params.phone}%`)
            .where('is_active', true)
            .limit(10);

        res.json({ success: true, data: customers });
    } catch (error) {
        next(error);
    }
});

// Get single customer with balance
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const customer = await db('customers')
            .where('id', req.params.id)
            .first();

        if (!customer) {
            throw new AppError('Customer not found', 404);
        }

        // Calculate current balance from ledger
        if (customer.account_id) {
            const balance = await db('ledger_entries')
                .where('account_id', customer.account_id)
                .select(
                    db.raw('SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END) as debits'),
                    db.raw('SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END) as credits')
                )
                .first();

            customer.current_balance = (parseFloat(balance.debits) || 0) - (parseFloat(balance.credits) || 0);
        } else {
            customer.current_balance = customer.opening_balance;
        }

        res.json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
});

const SequenceService = require('../services/sequence.service');
const sequenceService = new SequenceService(db);

// Create customer
router.post('/', authenticate, authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const { code, name, phone, phone_alt, email, address, city, cnic, credit_limit, opening_balance } = req.body;

        if (!name) {
            throw new AppError('Name is required', 400);
        }

        // Generate code if not provided
        let customerCode = code;
        if (!customerCode) {
            customerCode = await db.transaction(async (trx) => {
                return await sequenceService.getNextSequenceValue('customer', trx);
            });
        }

        const [customer] = await db('customers')
            .insert({
                code: customerCode,
                name, phone, phone_alt, email, address, city, cnic,
                credit_limit: credit_limit || 0,
                opening_balance: opening_balance || 0
            })
            .returning('*');

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
        const { code, name, phone, phone_alt, email, address, city, cnic, credit_limit, is_active } = req.body;

        const [customer] = await db('customers')
            .where({ id: req.params.id })
            .update({
                code, name, phone, phone_alt, email, address, city, cnic,
                credit_limit, is_active, updated_at: new Date()
            })
            .returning('*');

        if (!customer) {
            throw new AppError('Customer not found', 404);
        }

        res.json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
});

// Get customer ledger (Khata)
router.get('/:id/ledger', authenticate, async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        const customer = await db('customers').where('id', req.params.id).first();

        if (!customer) {
            throw new AppError('Customer not found', 404);
        }

        let query = db('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .where('a.id', customer.account_id)
            .select(
                'le.id',
                'le.entry_date',
                'le.entry_type',
                'le.amount',
                'le.reference_type',
                'le.reference_id',
                'le.narration',
                'le.created_at'
            )
            .orderBy('le.entry_date', 'asc')
            .orderBy('le.created_at', 'asc');

        if (from_date) {
            query = query.where('le.entry_date', '>=', from_date);
        }
        if (to_date) {
            query = query.where('le.entry_date', '<=', to_date);
        }

        const entries = await query;

        // Calculate running balance
        let balance = customer.opening_balance;
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
