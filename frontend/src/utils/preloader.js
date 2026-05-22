const preloadMap = {
    '/':          () => import('../pages/Dashboard'),
    '/products':  () => import('../pages/Products'),
    '/customers': () => import('../pages/Customers'),
    '/suppliers': () => import('../pages/Suppliers'),
    '/sales':     () => import('../pages/Sales'),
    '/sales/new': () => import('../pages/NewSale'),
    '/quotations':() => import('../pages/Quotations'),
    '/purchases': () => import('../pages/Purchases'),
    '/purchases/new': () => import('../pages/NewPurchase'),
    '/expenses':  () => import('../pages/Expenses'),
    '/journals':  () => import('../pages/Journals'),
    '/reports':   () => import('../pages/Reports'),
    '/settings':  () => import('../pages/Settings'),
    '/accounts':  () => import('../pages/Accounts'),
    '/loans':     () => import('../pages/Loans'),
    '/equity':    () => import('../pages/Equity'),
    '/users':     () => import('../pages/Users'),
    '/units':     () => import('../pages/Units'),
    '/inventory/adjustments': () => import('../pages/StockAdjustment'),
    '/payments/customer': () => import('../pages/CustomerPayment'),
    '/payments/supplier': () => import('../pages/SupplierPayment'),
}

export function preloadPage(path) {
    const loader = preloadMap[path]
    if (loader) loader()
}

export function preloadPages(paths) {
    paths.forEach(preloadPage)
}
