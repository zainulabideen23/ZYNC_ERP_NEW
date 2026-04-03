/**
 * System Account Codes — ZYNC ERP
 *
 * These codes identify GL accounts used by the system for automated
 * journal entry creation. Never hardcode these strings inline —
 * always import from this file.
 *
 * These accounts must exist for every tenant. They are seeded during
 * provisioning and protected by is_system = true.
 */

const SYSTEM_ACCOUNTS = {
    // Assets
    CASH_IN_HAND:          '1001',
    BANK_ACCOUNT:          '1002',
    INVENTORY:             '1004',
    CUSTOMER_RECEIVABLES:  '1201',

    // Liabilities
    SUPPLIER_PAYABLES:     '2001',
    TAX_PAYABLE:           '2002',

    // Equity
    OWNER_CAPITAL:         '3001',
    RETAINED_EARNINGS:     '3002',

    // Income
    SALES_INCOME:          '4001',
    SALES_DISCOUNT:        '4002',
    SALES_RETURNS:         '4003',

    // Cost of Goods Sold
    COGS:                  '5001',
    PURCHASE_RETURNS:      '5002',

    // Operating Expenses
    INVENTORY_LOSS:        '6004',
};

module.exports = { SYSTEM_ACCOUNTS };
