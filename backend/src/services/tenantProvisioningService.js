/**
 * Tenant Provisioning Service
 * 
 * Handles onboarding of new tenants — creates the tenant row and seeds
 * all default data (account groups, accounts, units, sequences, admin user,
 * company info skeleton) in a single database transaction.
 * 
 * Idempotent: running twice for the same slug fails gracefully.
 */

const bcrypt = require('bcrypt');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Provision a new tenant with all default data.
 * 
 * @param {object} params
 * @param {string} params.tenantName - Display name (e.g. "Ahmed Traders")
 * @param {string} params.tenantSlug - URL-safe identifier (e.g. "ahmed-traders")
 * @param {string} params.adminUsername - First admin's username
 * @param {string} params.adminPassword - First admin's password (plain text, will be hashed)
 * @param {string} params.adminEmail - First admin's email
 * @param {string} params.adminFullName - First admin's display name
 * @param {string} [params.plan='basic'] - Subscription plan
 * @param {number} [params.maxUsers=5] - Max users allowed
 * @returns {Promise<object>} Created tenant with admin user info
 */
async function provisionTenant({
    tenantName,
    tenantSlug,
    adminUsername,
    adminPassword,
    adminEmail,
    adminFullName,
    plan = 'basic',
    maxUsers = 5
}) {
    // Validate required fields
    if (!tenantName || !tenantSlug || !adminUsername || !adminPassword || !adminEmail || !adminFullName) {
        throw new AppError('All fields are required: tenantName, tenantSlug, adminUsername, adminPassword, adminEmail, adminFullName', 400);
    }

    // Validate slug format
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(tenantSlug) && tenantSlug.length > 1) {
        throw new AppError('Tenant slug must be lowercase alphanumeric with hyphens only, cannot start/end with hyphen', 400);
    }

    // Check for duplicate slug (idempotent guard)
    const existing = await db('tenants').where('slug', tenantSlug).first();
    if (existing) {
        throw new AppError(`Tenant with slug '${tenantSlug}' already exists`, 409);
    }

    return await db.transaction(async (trx) => {
        logger.info(`[Provisioning] Starting tenant provisioning: ${tenantName} (${tenantSlug})`);

        // =====================================================
        // a) Create tenant row
        // =====================================================
        const [tenant] = await trx('tenants').insert({
            name: tenantName,
            slug: tenantSlug,
            is_active: true,
            plan,
            max_users: maxUsers
        }).returning('*');

        const tenantId = tenant.id;
        logger.info(`[Provisioning] Tenant created: ${tenantId}`);

        // =====================================================
        // b) Seed default account_groups (11 standard groups)
        // =====================================================
        const groupInserts = [
            { account_type: 'asset', name: 'Cash', code: '1000', description: 'Physical cash and cash equivalents', sequence_order: 10, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'asset', name: 'Bank Accounts', code: '1100', description: 'Bank and financial institution accounts', sequence_order: 20, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'asset', name: 'Receivables', code: '1200', description: 'Amounts owed to the business by customers', sequence_order: 40, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'asset', name: 'Inventory', code: '1400', description: 'Stock and merchandise held for sale', sequence_order: 30, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'liability', name: 'Payables', code: '2000', description: 'Amounts the business owes to suppliers', sequence_order: 50, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'liability', name: 'Bank Loans', code: '2100', description: 'Long-term bank loans and credit facilities', sequence_order: 60, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'liability', name: 'Tax Liabilities', code: '2200', description: 'GST and other tax obligations', sequence_order: 55, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'equity', name: 'Equity', code: '3000', description: 'Owner investment and retained earnings', sequence_order: 70, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'income', name: 'Sales Revenue', code: '4000', description: 'Revenue generated from sales of goods', sequence_order: 80, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'expense', name: 'Cost of Goods Sold', code: '5000', description: 'Direct cost of goods sold to customers', sequence_order: 90, is_system: true, is_active: true, tenant_id: tenantId },
            { account_type: 'expense', name: 'Operating Expenses', code: '6000', description: 'Day-to-day operational business expenses', sequence_order: 100, is_system: true, is_active: true, tenant_id: tenantId },
        ];

        const groupResults = await trx('account_groups').insert(groupInserts).returning('id');
        const groupIds = groupResults.map(r => r.id || r);
        logger.info(`[Provisioning] ${groupIds.length} account groups created`);

        // Map group names to IDs for account creation
        // Order matches groupInserts: Cash, Bank, Receivables, Inventory, Payables, BankLoans, TaxLiabilities, Equity, Sales, COGS, OpEx
        const groups = {
            cash: groupIds[0],
            bank: groupIds[1],
            receivables: groupIds[2],
            inventory: groupIds[3],
            payables: groupIds[4],
            bankLoans: groupIds[5],
            taxLiabilities: groupIds[6],
            equity: groupIds[7],
            sales: groupIds[8],
            cogs: groupIds[9],
            opex: groupIds[10]
        };

        // =====================================================
        // c) Seed default accounts
        // =====================================================
        const accountInserts = [
            { code: '1001', name: 'Cash in Hand', account_type: 'asset', group_id: groups.cash, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '1002', name: 'Bank Account', account_type: 'asset', group_id: groups.bank, opening_balance: 0, current_balance: 0, is_bank_account: true, bank_name: 'Primary Bank', is_system: true, is_active: true, tenant_id: tenantId },
            { code: '1004', name: 'Inventory', account_type: 'asset', group_id: groups.inventory, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '1201', name: 'Customer Receivables', account_type: 'asset', group_id: groups.receivables, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '1202', name: 'Supplier Advances', account_type: 'asset', group_id: groups.receivables, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '1203', name: 'GST Receivable', account_type: 'asset', group_id: groups.receivables, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '2001', name: 'Supplier Payables', account_type: 'liability', group_id: groups.payables, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '2002', name: 'GST Payable', account_type: 'liability', group_id: groups.taxLiabilities, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '2003', name: 'Customer Advances', account_type: 'liability', group_id: groups.payables, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '2100', name: 'Bank Loans', account_type: 'liability', group_id: groups.bankLoans, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '3001', name: 'Owner Capital', account_type: 'equity', group_id: groups.equity, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '3002', name: 'Retained Earnings', account_type: 'equity', group_id: groups.equity, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '3003', name: 'Owner Drawings', account_type: 'equity', group_id: groups.equity, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '4001', name: 'Sales Income', account_type: 'income', group_id: groups.sales, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '4002', name: 'Sales Discount', account_type: 'income', group_id: groups.sales, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '4003', name: 'Sales Returns', account_type: 'income', group_id: groups.sales, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '5001', name: 'Cost of Goods Sold', account_type: 'expense', group_id: groups.cogs, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '5002', name: 'Purchase Returns', account_type: 'expense', group_id: groups.cogs, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '6001', name: 'Salaries & Wages', account_type: 'expense', group_id: groups.opex, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '6002', name: 'Rent & Utilities', account_type: 'expense', group_id: groups.opex, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '6003', name: 'Interest Expense', account_type: 'expense', group_id: groups.opex, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '6004', name: 'Inventory Loss', account_type: 'expense', group_id: groups.opex, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '6005', name: 'Office Supplies', account_type: 'expense', group_id: groups.opex, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
            { code: '6200', name: 'Late Payment Penalty', account_type: 'expense', group_id: groups.opex, opening_balance: 0, current_balance: 0, is_system: true, is_active: true, tenant_id: tenantId },
        ];

        await trx('accounts').insert(accountInserts);
        logger.info(`[Provisioning] ${accountInserts.length} accounts created`);

        // =====================================================
        // d) Seed default units (8 standard units)
        // =====================================================
        const unitInserts = [
            { name: 'Piece', abbreviation: 'pcs', tenant_id: tenantId },
            { name: 'Kilogram', abbreviation: 'kg', tenant_id: tenantId },
            { name: 'Liter', abbreviation: 'ltr', tenant_id: tenantId },
            { name: 'Box', abbreviation: 'box', tenant_id: tenantId },
            { name: 'Pack', abbreviation: 'pack', tenant_id: tenantId },
            { name: 'Dozen', abbreviation: 'dz', tenant_id: tenantId },
            { name: 'Meter', abbreviation: 'm', tenant_id: tenantId },
            { name: 'Square Meter', abbreviation: 'sqm', tenant_id: tenantId },
        ];

        await trx('units').insert(unitInserts);
        logger.info(`[Provisioning] ${unitInserts.length} units created`);

        // =====================================================
        // e) Seed default sequences (11 sequences)
        // =====================================================
        const sequenceInserts = [
            { name: 'invoice', tenant_id: tenantId, prefix: 'INV-', current_value: 0, pad_length: 6, is_active: true, description: 'Sale Invoice Numbering' },
            { name: 'purchase', tenant_id: tenantId, prefix: 'PUR-', current_value: 0, pad_length: 6, is_active: true, description: 'Purchase Bill Numbering' },
            { name: 'journal', tenant_id: tenantId, prefix: 'JRN-', current_value: 0, pad_length: 6, is_active: true, description: 'Journal Voucher Numbering' },
            { name: 'quotation', tenant_id: tenantId, prefix: 'QT-', current_value: 0, pad_length: 6, is_active: true, description: 'Quotation Numbering' },
            { name: 'expense', tenant_id: tenantId, prefix: 'EXP-', current_value: 0, pad_length: 6, is_active: true, description: 'Expense Numbering' },
            { name: 'payment', tenant_id: tenantId, prefix: 'PAY-', current_value: 0, pad_length: 6, is_active: true, description: 'Payment Numbering' },
            { name: 'customer', tenant_id: tenantId, prefix: 'CUST-', current_value: 0, pad_length: 6, is_active: true, description: 'Customer Code Numbering' },
            { name: 'supplier', tenant_id: tenantId, prefix: 'SUP-', current_value: 0, pad_length: 6, is_active: true, description: 'Supplier Code Numbering' },
            { name: 'stock_adjustment', tenant_id: tenantId, prefix: 'ADJ-', current_value: 0, pad_length: 6, is_active: true, description: 'Stock Adjustment Numbering' },
            { name: 'sale_return', tenant_id: tenantId, prefix: 'SRN-', current_value: 0, pad_length: 6, is_active: true, description: 'Sale Return Numbering' },
            { name: 'purchase_return', tenant_id: tenantId, prefix: 'PRN-', current_value: 0, pad_length: 6, is_active: true, description: 'Purchase Return Numbering' },
        ];

        await trx('sequences').insert(sequenceInserts);
        logger.info(`[Provisioning] ${sequenceInserts.length} sequences created`);

        // =====================================================
        // f) Create the first admin user
        // =====================================================
        const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

        const [adminUser] = await trx('users').insert({
            username: adminUsername,
            password_hash: passwordHash,
            full_name: adminFullName,
            email: adminEmail,
            phone_number: '0000-0000000',
            role: 'admin',
            is_active: true,
            tenant_id: tenantId
        }).returning('*');

        logger.info(`[Provisioning] Admin user created: ${adminUser.username}`);

        // =====================================================
        // g) Create empty company_info row for this tenant
        //    The tenant admin will fill in their business details
        //    via the Setup Wizard (Step 1) or Settings page.
        // =====================================================
        await trx('company_info').insert({
            company_name: tenantName,
            registration_number: '',
            tax_id: '',
            email: adminEmail || '',
            phone_number: '',
            website: '',
            address_line1: '',
            address_line2: '',
            city: '',
            province_state: '',
            postal_code: '',
            country: 'Pakistan',
            financial_year_start: 7,
            financial_year_end: 6,
            default_currency: 'PKR',
            default_tax_rate: 0,
            tenant_id: tenantId,
        });

        logger.info(`[Provisioning] Empty company_info row created — tenant admin will fill details`);
        logger.info(`[Provisioning] ✓ Tenant '${tenantSlug}' fully provisioned`);

        return {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                plan: tenant.plan
            },
            admin: {
                id: adminUser.id,
                username: adminUser.username,
                email: adminUser.email
            },
            seeded: {
                accountGroups: groupIds.length,
                accounts: accountInserts.length,
                units: unitInserts.length,
                sequences: sequenceInserts.length
            }
        };
    });
}

module.exports = { provisionTenant };
