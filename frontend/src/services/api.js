import axios from 'axios'
import { useAuthStore } from '../store/auth.store'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

const publicApi = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout()
            window.location.hash = '#/login'
        }
        const message = error.response?.data?.error || error.message || 'An error occurred'
        return Promise.reject(new Error(message))
    }
)

publicApi.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const message = error.response?.data?.error || error.message || 'An error occurred'
        return Promise.reject(new Error(message))
    }
)

// Auth
export const authAPI = {
    login: (credentials) => api.post('/auth/login', credentials),
    me: () => api.get('/auth/me'),
    changePassword: (data) => api.post('/auth/change-password', data)
}

// Products
export const productsAPI = {
    list: (params) => api.get('/products', { params }),
    get: (id) => api.get(`/products/${id}`),
    create: (data) => api.post('/products', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    delete: (id) => api.delete(`/products/${id}`),
    getStock: (id) => api.get(`/products/${id}/stock`),
    getCostHistory: (id, params) => api.get(`/products/${id}/cost-history`, { params }),
    validateSku: (sku, excludeId) => api.post('/products/validate-sku', { sku, excludeId }),
    importFile: (formData) => api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
    }),
    downloadTemplate: () => api.get('/products/template', { responseType: 'blob' })
}

// Customers
export const customersAPI = {
    list: (params) => api.get('/customers', { params }),
    get: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    recordPayment: (id, data) => api.post(`/customers/${id}/payment`, data),
    searchByPhone: (phone) => api.get(`/customers/search/phone/${phone}`),
    getLedger: (id, params) => api.get(`/customers/${id}/ledger`, { params })
}

// Suppliers
export const suppliersAPI = {
    list: (params) => api.get('/suppliers', { params }),
    get: (id) => api.get(`/suppliers/${id}`),
    create: (data) => api.post('/suppliers', data),
    update: (id, data) => api.put(`/suppliers/${id}`, data),
    getLedger: (id, params) => api.get(`/suppliers/${id}/ledger`, { params }),
    getPurchases: (id, params) => api.get(`/suppliers/${id}/purchases`, { params }),
    getAging: (id, params) => api.get(`/suppliers/${id}/aging`, { params }),
    getStatement: (id, params) => api.get(`/suppliers/${id}/statement`, { params }),
    getDashboard: (id, params) => api.get(`/suppliers/${id}/dashboard`, { params })
}

// Categories
export const categoriesAPI = {
    list: () => api.get('/categories'),
    listFlat: (params) => api.get('/categories', { params: { flat: 'true', ...params } }),
    create: (data) => api.post('/categories', data),
    update: (id, data) => api.put(`/categories/${id}`, data),
    delete: (id) => api.delete(`/categories/${id}`)
}

// Brands
export const brandsAPI = {
    list: (params) => api.get('/brands', { params }),
    create: (data) => api.post('/brands', data),
    update: (id, data) => api.put(`/brands/${id}`, data),
    delete: (id) => api.delete(`/brands/${id}`)
}

// Backward compat alias
export const companiesAPI = brandsAPI

// Sales
export const salesAPI = {
    list: (params) => api.get('/sales', { params }),
    get: (id) => api.get(`/sales/${id}`),
    create: (data) => api.post('/sales', data),
    returnPreview: (id, data) => api.post(`/sales/${id}/return-preview`, data),
    createReturn: (saleIdOrData, data) => {
        if ((typeof saleIdOrData === 'string' || typeof saleIdOrData === 'number') && data) {
            return api.post(`/sales/${saleIdOrData}/returns`, data)
        }
        return api.post('/sales/return', saleIdOrData)
    },
    listReturns: (params) => api.get('/sales/returns', { params }),
    getReturn: (id) => api.get(`/sales/returns/${id}`),
    todaySummary: () => api.get('/sales/summary/today')
}

// Purchases
export const purchasesAPI = {
    list: (params) => api.get('/purchases', { params }),
    listDrafts: (params) => api.get('/purchases/drafts', { params }),
    get: (id) => api.get(`/purchases/${id}`),
    create: (data) => api.post('/purchases', data),
    previewJournal: (data) => api.post('/purchases/preview', data),
    checkDuplicate: (data) => api.post('/purchases/duplicate-check', data),
    createDraft: (data) => api.post('/purchases/drafts', data),
    updateDraft: (id, data) => api.put(`/purchases/${id}`, data),
    cancelDraft: (id, data = {}) => api.post(`/purchases/${id}/cancel`, data),
    listTemplates: (params) => api.get('/purchases/templates', { params }),
    getTemplate: (id) => api.get(`/purchases/templates/${id}`),
    createTemplate: (data) => api.post('/purchases/templates', data),
    updateTemplate: (id, data) => api.put(`/purchases/templates/${id}`, data),
    deleteTemplate: (id) => api.delete(`/purchases/templates/${id}`),
    applyTemplate: (id, data = {}) => api.post(`/purchases/templates/${id}/apply`, data),
    createReturn: (purchaseIdOrData, data) => {
        if ((typeof purchaseIdOrData === 'string' || typeof purchaseIdOrData === 'number') && data) {
            return api.post(`/purchases/${purchaseIdOrData}/returns`, data)
        }
        return api.post('/purchases/return', purchaseIdOrData)
    },
    listReturns: (params) => api.get('/purchases/returns', { params }),
    getReturnStats: (params) => api.get('/purchases/returns/stats', { params }),
    getReturnReasons: (params) => api.get('/purchases/returns/reasons', { params }),
    getReturn: (id) => api.get(`/purchases/returns/${id}`),
}

// Accounts
export const accountsAPI = {
    list: () => api.get('/accounts'),
    getGroups: () => api.get('/accounts/groups'),
    getLedger: (id, params) => api.get(`/accounts/${id}/ledger`, { params }),
    update: (id, data) => api.put(`/accounts/${id}`, data)
}

// Loans
export const loansAPI = {
    list: (params) => api.get('/loans', { params }),
    get: (id) => api.get(`/loans/${id}`),
    create: (data) => api.post('/loans', data),
    update: (id, data) => api.put(`/loans/${id}`, data),
    delete: (id) => api.delete(`/loans/${id}`),
    getPayments: (id) => api.get(`/loans/${id}/payments`),
    createPayment: (id, data) => api.post(`/loans/${id}/payments`, data),
    getSummary: () => api.get('/loans/summary'),
    calculateEMI: (params) => api.get('/loans/emi-calculator', { params }),
    getAmortization: (id) => api.get(`/loans/${id}/amortization`),
    getSettlement: (id) => api.get(`/loans/${id}/settlement`),
    getOverdue: (id) => api.get(`/loans/${id}/overdue`),
    recordRateChange: (id, data) => api.post(`/loans/${id}/rate-change`, data),
    getRateHistory: (id) => api.get(`/loans/${id}/rate-history`),
    recordPrepayment: (id, data) => api.post(`/loans/${id}/prepayment`, data),
    restructure: (id, data) => api.post(`/loans/${id}/restructure`, data),
    settle: (id, data) => api.post(`/loans/${id}/settle`, data),
}

// Equity
export const equityAPI = {
    getSummary: () => api.get('/equity/summary'),
    getTransactions: (params) => api.get('/equity/transactions', { params }),
    recordCapital: (data) => api.post('/equity/capital', data),
    recordDrawing: (data) => api.post('/equity/drawing', data),
    closeYear: (data) => api.post('/equity/close-year', data),
}

// Expenses
export const expensesAPI = {
    list: (params) => api.get('/expenses', { params }),
    create: (data) => api.post('/expenses', data),
    getCategories: () => api.get('/expenses/categories'),
    createCategory: (data) => api.post('/expenses/categories', data)
}

// Journals
export const journalsAPI = {
    list: (params) => api.get('/journals', { params }),
    get: (id) => api.get(`/journals/${id}`),
    create: (data) => api.post('/journals', data)
}

// Reports
export const reportsAPI = {
    dashboard: () => api.get('/reports/dashboard'),
    stock: (params) => api.get('/reports/stock', { params }),
    purchases: (params) => api.get('/reports/purchases', { params }),
    salesByDate: (params) => api.get('/reports/sales/by-date', { params }),
    trialBalance: (params) => api.get('/reports/trial-balance', { params }),
    profitLoss: (params) => api.get('/reports/profit-loss', { params }),
    balanceSheet: (params) => api.get('/reports/balance-sheet', { params }),
    salesByProduct: (params) => api.get('/reports/sales-by-product', { params }),
    salesByCustomer: (params) => api.get('/reports/sales-by-customer', { params }),
    purchaseBySupplier: (params) => api.get('/reports/purchase-by-supplier', { params }),
    supplierAging: (params) => api.get('/reports/suppliers/aging', { params }),
    stockMovements: (params) => api.get('/reports/stock-movements', { params }),
    expenseSummary: (params) => api.get('/reports/expense-summary', { params })
}

// Units
export const unitsAPI = {
    list: (params) => api.get('/units', { params }),
    create: (data) => api.post('/units', data),
    quickCreate: (data) => api.post('/units/quick-create', data),
    seed: () => api.post('/units/seed'),
    update: (id, data) => api.put(`/units/${id}`, data),
    delete: (id) => api.delete(`/units/${id}`)
}

// Users
export const usersAPI = {
    list: () => api.get('/users'),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword })
}

// Backups
export const backupAPI = {
    list: () => api.get('/backups'),
    create: () => api.post('/backups'),
    delete: (filename) => api.delete(`/backups/${filename}`),
    download: (filename) => {
        const token = useAuthStore.getState().token;
        window.open(`${api.defaults.baseURL}/backups/${filename}/download?token=${token}`, '_blank');
    }
}

// Stock
export const stockAPI = {
    adjust: (data) => api.post('/stock/adjust', data)
}

// Quotations
export const quotationsAPI = {
    list: (params) => api.get('/quotations', { params }),
    get: (id) => api.get(`/quotations/${id}`),
    create: (data) => api.post('/quotations', data),
    update: (id, data) => api.put(`/quotations/${id}`, data),
    updateStatus: (id, status) => api.patch(`/quotations/${id}/status`, { status }),
    duplicate: (id) => api.post(`/quotations/${id}/duplicate`),
    sendEmail: (id, data) => api.post(`/quotations/${id}/send-email`, data),
    sendReminder: (id, data) => api.post(`/quotations/${id}/send-reminder`, data),
    getPDF: async (id) => {
        const token = useAuthStore.getState().token
        const response = await axios.get(`${api.defaults.baseURL}/quotations/${id}/pdf`, {
            responseType: 'blob',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        return response
    }
}

export const quotationPublicAPI = {
    getByToken: (token) => publicApi.get(`/public/quote/${encodeURIComponent(token)}`),
    respond: (token, data) => publicApi.post(`/public/quote/${encodeURIComponent(token)}/respond`, data),
    getConfirmPageUrl: (token) => `${API_BASE_URL}/public/quote/${encodeURIComponent(token)}/confirm-page`,
}

// Dashboard
export const dashboardAPI = {
    recentActivity: () => api.get('/dashboard/recent-activity'),
}

// Audit Logs
export const auditLogsAPI = {
    list: (params) => api.get('/audit-logs', { params }),
    meta: () => api.get('/audit-logs/meta'),
}

// Onboarding
export const onboardingAPI = {
    status: () => api.get('/onboarding/status'),
    updateStep: (step) => api.patch('/onboarding/step', { step }),
    complete: () => api.patch('/onboarding/complete'),
}

// Settings
export const settingsAPI = {
    getCompanyInfo: () => api.get('/settings/company-info'),
    updateCompanyInfo: (data) => api.put('/settings/company-info', data),
}

// Payments
export const paymentsAPI = {
    customer: (data) => api.post('/payments/customer', data),
    supplier: (data) => api.post('/payments/supplier', data),
}

// Transfers
export const transfersAPI = {
    bank: (data) => api.post('/transfers/bank', data),
}

// Accounts (additional methods)
export const accountsAPIExtended = {
    ...accountsAPI,
    postOpeningBalances: () => api.post('/accounts/opening-balances'),
}

export default api
