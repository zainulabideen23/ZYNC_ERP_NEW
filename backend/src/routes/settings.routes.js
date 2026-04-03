const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');

// authenticate + resolveTenant are applied at the app.use() level in index.js

// Columns we expose to the frontend (mapped to friendly keys)
const FIELD_MAP = {
    company_name: 'company_name',
    ntn_number: 'tax_id',           // frontend says ntn_number → DB column is tax_id
    strn_number: 'strn_number',
    default_tax_rate: 'default_tax_rate',
    phone: 'phone_number',          // frontend says phone → DB column is phone_number
    email: 'email',
    website: 'website',
    city: 'city',
    address: 'address_line1',       // frontend says address → DB column is address_line1
    address_line2: 'address_line2',
    province_state: 'province_state',
    postal_code: 'postal_code',
    country: 'country',
    financial_year_start: 'financial_year_start',
    financial_year_end: 'financial_year_end',
    default_currency: 'default_currency',
    registration_number: 'registration_number',
    logo_url: 'logo_url',
    bank_name: 'bank_name',
    bank_account_number: 'bank_account_number',
    bank_iban: 'bank_iban',
    bank_branch_code: 'bank_branch_code',
};

// GET /api/settings/company-info
router.get('/company-info', async (req, res, next) => {
    try {
        const row = await db('company_info')
            .where({ tenant_id: req.tenantId })
            .first();

        if (!row) {
            return res.json({ success: true, data: {} });
        }

        // Map DB columns → frontend-friendly keys
        const data = {
            name: row.company_name,
            ntn_number: row.tax_id,
            strn_number: row.strn_number,
            default_tax_rate: row.default_tax_rate,
            phone: row.phone_number,
            email: row.email,
            website: row.website,
            city: row.city,
            address: row.address_line1,
            address_line2: row.address_line2,
            province_state: row.province_state,
            postal_code: row.postal_code,
            country: row.country,
            financial_year_start: row.financial_year_start,
            financial_year_end: row.financial_year_end,
            default_currency: row.default_currency,
            registration_number: row.registration_number,
            logo_url: row.logo_url || '',
            bank_name: row.bank_name || '',
            bank_account_number: row.bank_account_number || '',
            bank_iban: row.bank_iban || '',
            bank_branch_code: row.bank_branch_code || '',
        };

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// PUT /api/settings/company-info
router.put('/company-info', authorize('admin'), async (req, res, next) => {
    try {
        const {
            name, ntn_number, strn_number, default_tax_rate,
            phone, email, website,
            city, address, address_line2, province_state, postal_code, country,
            financial_year_start, financial_year_end, default_currency,
            registration_number,
            logo_url, bank_name, bank_account_number, bank_iban, bank_branch_code
        } = req.body;

        // Validation
        if (ntn_number !== undefined && ntn_number !== '' && !/^\d{7}$/.test(ntn_number)) {
            throw new AppError('NTN must be exactly 7 digits', 400);
        }
        if (strn_number !== undefined && strn_number !== '' && !/^\d{13}$/.test(strn_number)) {
            throw new AppError('STRN must be exactly 13 digits', 400);
        }
        if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new AppError('Invalid email format', 400);
        }

        // Build DB update object (frontend key → DB column)
        const updateData = {};
        if (name !== undefined) updateData.company_name = name;
        if (ntn_number !== undefined) updateData.tax_id = ntn_number;
        if (strn_number !== undefined) updateData.strn_number = strn_number;
        if (default_tax_rate !== undefined) updateData.default_tax_rate = default_tax_rate;
        if (phone !== undefined) updateData.phone_number = phone;
        if (email !== undefined) updateData.email = email;
        if (website !== undefined) updateData.website = website;
        if (city !== undefined) updateData.city = city;
        if (address !== undefined) updateData.address_line1 = address;
        if (address_line2 !== undefined) updateData.address_line2 = address_line2;
        if (province_state !== undefined) updateData.province_state = province_state;
        if (postal_code !== undefined) updateData.postal_code = postal_code;
        if (country !== undefined) updateData.country = country;
        if (financial_year_start !== undefined) updateData.financial_year_start = financial_year_start;
        if (financial_year_end !== undefined) updateData.financial_year_end = financial_year_end;
        if (default_currency !== undefined) updateData.default_currency = default_currency;
        if (registration_number !== undefined) updateData.registration_number = registration_number;
        if (logo_url !== undefined) updateData.logo_url = logo_url;
        if (bank_name !== undefined) updateData.bank_name = bank_name;
        if (bank_account_number !== undefined) updateData.bank_account_number = bank_account_number;
        if (bank_iban !== undefined) updateData.bank_iban = bank_iban;
        if (bank_branch_code !== undefined) updateData.bank_branch_code = bank_branch_code;

        if (Object.keys(updateData).length === 0) {
            throw new AppError('No valid fields to update', 400);
        }

        updateData.updated_at = db.fn.now();

        // Get old values for audit
        const oldRow = await db('company_info').where({ tenant_id: req.tenantId }).first();

        if (!oldRow) {
            // Create row if it doesn't exist yet (shouldn't happen, but safety)
            updateData.tenant_id = req.tenantId;
            if (!updateData.company_name) updateData.company_name = 'My Company';
            if (!updateData.tax_id) updateData.tax_id = '';
            if (!updateData.address_line1) updateData.address_line1 = '';
            if (!updateData.city) updateData.city = '';
            await db('company_info').insert(updateData);
        } else {
            await db('company_info').where({ tenant_id: req.tenantId }).update(updateData);
        }

        // Read back updated row
        const updatedRow = await db('company_info').where({ tenant_id: req.tenantId }).first();
        const data = {
            name: updatedRow.company_name,
            ntn_number: updatedRow.tax_id,
            strn_number: updatedRow.strn_number,
            default_tax_rate: updatedRow.default_tax_rate,
            phone: updatedRow.phone_number,
            email: updatedRow.email,
            website: updatedRow.website,
            city: updatedRow.city,
            address: updatedRow.address_line1,
            address_line2: updatedRow.address_line2,
            province_state: updatedRow.province_state,
            postal_code: updatedRow.postal_code,
            country: updatedRow.country,
            financial_year_start: updatedRow.financial_year_start,
            financial_year_end: updatedRow.financial_year_end,
            default_currency: updatedRow.default_currency,
            registration_number: updatedRow.registration_number,
            logo_url: updatedRow.logo_url || '',
            bank_name: updatedRow.bank_name || '',
            bank_account_number: updatedRow.bank_account_number || '',
            bank_iban: updatedRow.bank_iban || '',
            bank_branch_code: updatedRow.bank_branch_code || '',
        };

        // Also update tenant name if company name changed
        if (name !== undefined) {
            await db('tenants').where({ id: req.tenantId }).update({ name, updated_at: db.fn.now() });
        }

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'company_info',
            recordId: req.tenantId,
            oldValues: oldRow ? { name: oldRow.company_name, phone: oldRow.phone_number, city: oldRow.city } : {},
            newValues: { name: data.name, phone: data.phone, city: data.city },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
