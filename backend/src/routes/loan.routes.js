const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const LoanService = require('../services/loan.service');

// List loans
router.get('/', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get loan summary
router.get('/summary', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const summary = await loanService.getSummary();
        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
});

// EMI Calculator (without creating loan) - MUST come before /:id
router.get('/emi-calculator', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { principal, rate, tenure_months, start_date } = req.query;
        
        if (!principal || !rate) {
            return res.status(400).json({ error: 'Principal and rate are required' });
        }

        const loanService = new LoanService(db, req.tenantId);
        
        // Calculate tenure if not provided
        let months = parseInt(tenure_months) || 12;
        if (!tenure_months && start_date) {
            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);
            months = Math.ceil((endDate - new Date(start_date)) / (30 * 24 * 60 * 60 * 1000));
        }

        const emi = loanService.calculateEMI(
            parseFloat(principal),
            parseFloat(rate),
            months
        );

        // Generate sample amortization (first 3 months)
        const sampleLoan = {
            principal_amount: parseFloat(principal),
            interest_rate: parseFloat(rate),
            start_date: start_date || new Date().toISOString().split('T')[0],
            end_date: new Date(new Date().setFullYear(new Date().getFullYear() + Math.ceil(months/12))).toISOString().split('T')[0],
            tenure_months: months
        };
        
        const schedule = loanService.generateAmortizationSchedule(sampleLoan);

        res.json({
            success: true,
            data: {
                principal: parseFloat(principal),
                annual_rate: parseFloat(rate),
                tenure_months: months,
                emi,
                total_interest: schedule.reduce((sum, m) => sum + m.interest, 0),
                total_payment: schedule.reduce((sum, m) => sum + m.emi, 0),
                sample_schedule: schedule.slice(0, 6) // First 6 months
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get single loan - AFTER specific routes
router.get('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const loan = await loanService.getById(req.params.id);
        res.json({ success: true, data: loan });
    } catch (error) {
        next(error);
    }
});

// Get loan payments
router.get('/:id/payments', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.getPayments(req.params.id);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Create new loan
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const loan = await loanService.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: loan });
    } catch (error) {
        next(error);
    }
});

// Record loan payment
router.post('/:id/payments', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const payment = await loanService.recordPayment(req.params.id, req.body, req.user.id);
        res.status(201).json({ success: true, data: payment });
    } catch (error) {
        next(error);
    }
});

// Update loan
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const loan = await loanService.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: loan });
    } catch (error) {
        next(error);
    }
});

// Delete loan (soft delete)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.delete(req.params.id, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get amortization schedule
router.get('/:id/amortization', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const amortization = await loanService.getAmortization(req.params.id);
        res.json({ success: true, data: amortization });
    } catch (error) {
        next(error);
    }
});

// Calculate early settlement
router.get('/:id/settlement', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const settlement = await loanService.calculateEarlySettlement(req.params.id);
        res.json({ success: true, data: settlement });
    } catch (error) {
        next(error);
    }
});

// Check overdue status
router.get('/:id/overdue', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const overdue = await loanService.calculateOverdue(req.params.id);
        res.json({ success: true, data: overdue });
    } catch (error) {
        next(error);
    }
});

// Record rate change (for floating rate loans)
router.post('/:id/rate-change', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.recordRateChange(req.params.id, req.body, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get rate history
router.get('/:id/rate-history', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const history = await loanService.getRateHistory(req.params.id);
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
});

// Record partial prepayment
router.post('/:id/prepayment', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.recordPrepayment(req.params.id, req.body, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Restructure loan
router.post('/:id/restructure', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.restructureLoan(req.params.id, req.body, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Settle loan (full payoff)
router.post('/:id/settle', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const loanService = new LoanService(db, req.tenantId);
        const result = await loanService.settleLoan(req.params.id, req.body, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

module.exports = router;