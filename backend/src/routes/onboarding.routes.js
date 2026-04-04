const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// All onboarding routes are admin-only
// authenticate + resolveTenant are applied at the app.use() level in index.js

// GET /api/onboarding/status
router.get('/status', authorize('admin'), async (req, res, next) => {
    try {
        const tenant = await db('tenants').where({ id: req.tenantId }).first();

        // Check what data each step has
        const [categories, companies, units, openingBalances] = await Promise.all([
            db('categories')
                .where({ tenant_id: req.tenantId, is_active: true })
                .count('* as count')
                .first(),
            db('brands')
                .where({ tenant_id: req.tenantId, is_active: true })
                .count('* as count')
                .first(),
            db('units')
                .where({ tenant_id: req.tenantId, is_active: true })
                .count('* as count')
                .first(),
            db('accounts')
                .where({ tenant_id: req.tenantId, is_active: true })
                .whereRaw('opening_balance != 0')
                .count('* as count')
                .first(),
        ]);

        const companyRow = await db('company_info').where({ tenant_id: req.tenantId }).first();
        const hasCompanyInfo = !!(companyRow && (companyRow.phone_number || companyRow.address_line1 || companyRow.tax_id || companyRow.city));

        res.json({
            success: true,
            data: {
                is_onboarded: tenant.is_onboarded,
                onboarding_step: tenant.onboarding_step,
                completed_steps: {
                    company_info: hasCompanyInfo,
                    categories: parseInt(categories.count) > 0,
                    brands: parseInt(companies.count) > 0,
                    units: parseInt(units.count) > 0,
                    opening_balances: parseInt(openingBalances.count) > 0,
                },
                counts: {
                    categories: parseInt(categories.count),
                    brands: parseInt(companies.count),
                    units: parseInt(units.count),
                    opening_balances: parseInt(openingBalances.count),
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/onboarding/step
router.patch('/step', authorize('admin'), async (req, res, next) => {
    try {
        const { step } = req.body;

        if (!step || step < 1 || step > 6) {
            throw new AppError('Invalid step number (must be 1-6)', 400);
        }

        await db('tenants')
            .where({ id: req.tenantId })
            .update({ onboarding_step: step });

        res.json({ success: true, onboarding_step: step });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/onboarding/complete
router.patch('/complete', authorize('admin'), async (req, res, next) => {
    try {
        await db('tenants')
            .where({ id: req.tenantId })
            .update({ is_onboarded: true, onboarding_step: 6 });

        res.json({ success: true, is_onboarded: true });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
