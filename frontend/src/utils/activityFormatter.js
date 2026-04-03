/**
 * Activity Formatter Utility
 * Formats audit log entries for display in the Recent Activity section
 */

import {
    Receipt, ShoppingCart, Package, User, Truck, CreditCard,
    LogIn, Database, Activity, FileText, Settings, BarChart2,
    Shield, BookOpen, Tag, Ruler, Landmark, PackageCheck,
    KeyRound, Building2, UserCog
} from 'lucide-react'

const formatActivity = (log) => {
    const n = log.new_values || {};
    const o = log.old_values || {};

    const templates = {
        'create:sales': {
            text: `created Invoice ${n.invoice_number || ''}`,
            amount: n.total_amount,
            amountType: 'positive'
        },
        'delete:sales': {
            text: `cancelled Invoice ${o.invoice_number || ''}`,
            amount: null
        },
        'create:purchases': {
            text: `created Purchase ${n.bill_number || ''}`,
            amount: n.total_amount,
            amountType: 'negative'
        },
        'delete:purchases': {
            text: `cancelled Purchase ${o.bill_number || ''}`
        },
        'create:products': {
            text: `added Product "${n.name || ''}"`
        },
        'update:products': {
            text: `updated Product "${n.name || o.name || ''}"`
        },
        'delete:products': {
            text: `deleted Product "${o.name || ''}"`
        },
        'create:customers': {
            text: `registered Customer "${n.name || ''}"`
        },
        'update:customers': {
            text: `updated Customer "${n.name || ''}"`
        },
        'delete:customers': {
            text: `deleted Customer "${o.name || ''}"`
        },
        'create:suppliers': {
            text: `added Supplier "${n.name || ''}"`
        },
        'update:suppliers': {
            text: `updated Supplier "${n.name || ''}"`
        },
        'delete:suppliers': {
            text: `deleted Supplier "${o.name || ''}"`
        },
        'create:expenses': {
            text: `recorded Expense ${n.expense_number || ''}`,
            amount: n.total_amount,
            amountType: 'negative'
        },
        'delete:expenses': {
            text: `deleted Expense ${o.expense_number || ''}`
        },
        'create:quotations': {
            text: `created Quotation ${n.quotation_number || ''}`
        },
        'approve:quotations': {
            text: `converted Quotation ${o.quotation_number || ''} to Sale`
        },
        'update:quotations': {
            text: `updated Quotation status`
        },
        'approve:stock_adjustments': {
            text: `approved Stock Adjustment`
        },
        'reject:stock_adjustments': {
            text: `rejected Stock Adjustment`
        },
        'create:users': {
            text: `created User "${n.username || ''}"`
        },
        'update:users': {
            text: `updated User "${n.username || ''}"`
        },
        'delete:users': {
            text: `deactivated User "${o.username || ''}"`
        },
        'password_change:users': {
            text: `changed password`
        },
        'login:users': {
            text: `logged in`
        },
        'login_failed:users': {
            text: `failed login attempt on "${n.attempted_username || ''}"`
        },
        'create:backup': {
            text: `created system backup`
        },
        'update:company_info': {
            text: `updated company settings`
        },
        'create:company_info': {
            text: `updated company settings`
        },
        'create:categories': {
            text: `added Category "${n.name || ''}"`
        },
        'update:categories': {
            text: `updated Category "${n.name || ''}"`
        },
        'delete:categories': {
            text: `deleted Category "${o.name || ''}"`
        },
        'create:journals': {
            text: `posted Journal ${n.journal_number || ''}`
        },
        'create:units': {
            text: `added Unit "${n.name || ''}"`
        },
        'create:accounts': {
            text: `created Account "${n.name || ''}"`
        },
        'update:accounts': {
            text: `updated Account "${n.name || ''}"`
        },
    };

    const key = `${log.action}:${log.table_name}`;
    return templates[key] || { text: `${log.action} on ${log.table_name}` };
};

const getActionColor = (action) => {
    const colors = {
        create: 'bg-green-500',
        update: 'bg-blue-500',
        delete: 'bg-red-500',
        approve: 'bg-yellow-500',
        reject: 'bg-red-400',
        login: 'bg-slate-400',
        login_failed: 'bg-red-600',
        password_change: 'bg-purple-500',
        export: 'bg-indigo-500',
        impersonate: 'bg-orange-500',
    };
    return colors[action] || 'bg-slate-500';
};

/**
 * Returns the Lucide icon component for a given action/table pair.
 */
const getActivityIcon = (action, tableName) => {
    const iconMap = {
        'sales': Receipt,
        'purchases': ShoppingCart,
        'products': Package,
        'customers': User,
        'suppliers': Truck,
        'expenses': CreditCard,
        'backup': Database,
        'quotations': FileText,
        'company_info': Settings,
        'reports': BarChart2,
        'stock_adjustments': Shield,
        'journals': BookOpen,
        'categories': Tag,
        'units': Ruler,
        'accounts': Landmark,
        'users': UserCog,
    };

    if (action === 'login' || action === 'login_failed') return LogIn;
    if (action === 'password_change') return KeyRound;
    return iconMap[tableName] || Activity;
};

/**
 * Legacy helper: returns icon name as string (for backward compat)
 */
const getActionIcon = (action, tableName) => {
    if (tableName === 'sales') return 'Receipt';
    if (tableName === 'purchases') return 'ShoppingCart';
    if (tableName === 'products') return 'Package';
    if (tableName === 'customers') return 'User';
    if (tableName === 'suppliers') return 'Truck';
    if (tableName === 'expenses') return 'CreditCard';
    if (tableName === 'quotations') return 'FileText';
    if (tableName === 'journals') return 'BookOpen';
    if (tableName === 'categories') return 'Tag';
    if (tableName === 'units') return 'Ruler';
    if (tableName === 'accounts') return 'Landmark';
    if (tableName === 'stock_adjustments') return 'PackageCheck';
    if (action === 'login' || action === 'login_failed') return 'LogIn';
    if (action === 'password_change') return 'KeyRound';
    if (tableName === 'backup') return 'Database';
    if (tableName === 'company_info') return 'Building2';
    if (tableName === 'users') return 'UserCog';
    return 'Activity';
};

/**
 * Human-friendly relative time string
 */
const timeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) {
        const m = Math.floor(seconds / 60);
        return `${m} minute${m > 1 ? 's' : ''} ago`;
    }
    if (seconds < 86400) {
        const h = Math.floor(seconds / 3600);
        return `about ${h} hour${h > 1 ? 's' : ''} ago`;
    }
    const d = Math.floor(seconds / 86400);
    return `${d} day${d > 1 ? 's' : ''} ago`;
};

/**
 * Normalize IP addresses for display
 */
const formatIP = (ip) => {
    if (!ip) return '—';
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'localhost';
    return ip;
};

export { formatActivity, getActionColor, getActionIcon, getActivityIcon, timeAgo, formatIP };
