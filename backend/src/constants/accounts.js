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
    SUPPLIER_ADVANCES:     '1202',
    INPUT_TAX_RECEIVABLE:  '1203',

    // Liabilities
    SUPPLIER_PAYABLES:     '2001',
    TAX_PAYABLE:           '2002',
    CUSTOMER_ADVANCES:     '2003',
    BANK_LOANS:            '2100',
    PAYABLES_SUMMARY:      '2200',

    // Summary/Offset accounts
    RECEIVABLES_SUMMARY:   '1200',

    // Equity
    OWNER_CAPITAL:         '3001',
    RETAINED_EARNINGS:     '3002',
    OWNER_DRAWINGS:        '3003',

    // Income
    SALES_INCOME:          '4001',
    SALES_DISCOUNT:        '4002',
    SALES_RETURNS:         '4003',

    // Cost of Goods Sold
    COGS:                  '5001',
    PURCHASE_RETURNS:      '5002',
    PURCHASE_DISCOUNT:     '5003',

    // Operating Expenses
    INTEREST_EXPENSE:      '6003',
    INVENTORY_LOSS:        '6004',
    OFFICE_SUPPLIES:       '6005',

    // Late Payment Penalty (SBP guideline - income for bank)
    LATE_PENALTY_EXPENSE:  '6200',
};

module.exports = { SYSTEM_ACCOUNTS };
