/**
 * Role-Based Permissions Utility
 * 
 * Centralized permission checker for the ZYNC ERP frontend.
 * Maps permissions to allowed roles.
 */

const PERMISSIONS = {
    // Products
    'products.create':          ['admin', 'manager'],
    'products.edit':            ['admin', 'manager'],
    'products.delete':          ['admin'],
    'products.view_cost_price': ['admin', 'manager'],

    // Customers
    'customers.create':         ['admin', 'manager', 'cashier'],
    'customers.edit':           ['admin', 'manager'],
    'customers.delete':         ['admin'],
    'customers.change_credit':  ['admin'],
    'customers.view_ledger':    ['admin', 'manager'],

    // Suppliers
    'suppliers.view':           ['admin', 'manager'],
    'suppliers.create':         ['admin', 'manager'],
    'suppliers.edit':           ['admin', 'manager'],

    // Sales
    'sales.create':             ['admin', 'manager', 'cashier'],
    'sales.cancel':             ['admin'],
    'sales.return':             ['admin', 'manager'],
    'sales.view_all':           ['admin', 'manager'],

    // Purchases
    'purchases.view':           ['admin', 'manager'],
    'purchases.create':         ['admin', 'manager'],

    // Quotations
    'quotations.create':        ['admin', 'manager', 'cashier'],
    'quotations.update_status': ['admin', 'manager'],

    // Accounting
    'journals.view':            ['admin', 'manager'],
    'journals.create_manual':   ['admin'],
    'accounts.manage':          ['admin'],
    'accounts.view':            ['admin', 'manager'],

    // Stock
    'stock.adjust':             ['admin', 'manager'],
    'stock.approve':            ['admin'],

    // Expenses
    'expenses.view':            ['admin', 'manager'],
    'expenses.create':          ['admin', 'manager'],
    'expenses.delete':          ['admin'],

    // Reports
    'reports.view_all':         ['admin', 'manager'],
    'reports.view_today':       ['admin', 'manager', 'cashier'],

    // System
    'users.manage':             ['admin'],
    'backups.manage':           ['admin'],
    'settings.manage':          ['admin'],
    'audit_logs.view':          ['admin'],
};

/**
 * Check if a user role has a specific permission
 * 
 * @param {string} userRole - The user's role (admin, manager, cashier)
 * @param {string} permission - The permission key (e.g. 'products.create')
 * @returns {boolean} Whether the role has the permission
 */
export const can = (userRole, permission) => {
    const allowed = PERMISSIONS[permission];
    if (!allowed) return false;
    return allowed.includes(userRole);
};

/**
 * Check if a user role has any of the specified permissions
 * 
 * @param {string} userRole - The user's role
 * @param {string[]} permissions - Array of permission keys
 * @returns {boolean}
 */
export const canAny = (userRole, permissions) => {
    return permissions.some(p => can(userRole, p));
};

export default PERMISSIONS;
