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
    validateSku: (sku, excludeId) => api.post('/products/validate-sku', { sku, excludeId })
}

// Customers
export const customersAPI = {
    list: (params) => api.get('/customers', { params }),
    get: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    searchByPhone: (phone) => api.get(`/customers/search/phone/${phone}`),
    getLedger: (id, params) => api.get(`/customers/${id}/ledger`, { params })
}

// Suppliers
export const suppliersAPI = {
    list: (params) => api.get('/suppliers', { params }),
    get: (id) => api.get(`/suppliers/${id}`),
    create: (data) => api.post('/suppliers', data),
    update: (id, data) => api.put(`/suppliers/${id}`, data),
    getLedger: (id, params) => api.get(`/suppliers/${id}/ledger`, { params })
}

// Categories
export const categoriesAPI = {
    list: () => api.get('/categories'),
    create: (data) => api.post('/categories', data),
    update: (id, data) => api.put(`/categories/${id}`, data)
}

// Companies
export const companiesAPI = {
    list: () => api.get('/companies'),
    create: (data) => api.post('/companies', data),
    update: (id, data) => api.put(`/companies/${id}`, data)
}

// Sales
export const salesAPI = {
    list: (params) => api.get('/sales', { params }),
    get: (id) => api.get(`/sales/${id}`),
    create: (data) => api.post('/sales', data),
    createReturn: (data) => api.post('/sales/return', data),
    todaySummary: () => api.get('/sales/summary/today')
}

// Purchases
export const purchasesAPI = {
    list: (params) => api.get('/purchases', { params }),
    get: (id) => api.get(`/purchases/${id}`),
    create: (data) => api.post('/purchases', data),
    createReturn: (data) => api.post('/purchases/return', data)
}

// Accounts
export const accountsAPI = {
    list: () => api.get('/accounts'),
    getGroups: () => api.get('/accounts/groups'),
    getLedger: (id, params) => api.get(`/accounts/${id}/ledger`, { params })
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
    salesByDate: (params) => api.get('/reports/sales/by-date', { params }),
    trialBalance: (params) => api.get('/reports/trial-balance', { params }),
    profitLoss: (params) => api.get('/reports/profit-loss', { params }),
    balanceSheet: (params) => api.get('/reports/balance-sheet', { params }),
    salesByProduct: (params) => api.get('/reports/sales-by-product', { params }),
    salesByCustomer: (params) => api.get('/reports/sales-by-customer', { params }),
    purchaseBySupplier: (params) => api.get('/reports/purchase-by-supplier', { params }),
    expenseSummary: (params) => api.get('/reports/expense-summary', { params })
}

// Units
export const unitsAPI = {
    list: () => api.get('/units'),
    create: (data) => api.post('/units', data)
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
    updateStatus: (id, status) => api.patch(`/quotations/${id}/status`, { status })
}

export default api
