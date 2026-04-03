import axios from 'axios'
import { usePlatformAuthStore } from '../store/platform.auth.store'

const platformApi = axios.create({
    baseURL: '/platform',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'X-Platform-Secret': import.meta.env.VITE_PLATFORM_SECRET || ''
    }
})

// Request interceptor — attach platform JWT
platformApi.interceptors.request.use(
    (config) => {
        const token = usePlatformAuthStore.getState().platformToken
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor — handle 401 + unwrap
platformApi.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            // Don't logout on login failures (those are just bad credentials)
            const url = error.config?.url || ''
            if (!url.includes('/auth/login')) {
                usePlatformAuthStore.getState().logout()
            }
        }
        const message = error.response?.data?.error || error.message || 'An error occurred'
        return Promise.reject(new Error(message))
    }
)

// ─── Platform Auth API ───
export const platformAuthAPI = {
    login: (email, password) => platformApi.post('/auth/login', { email, password }),
    me: () => platformApi.get('/auth/me'),
    changePassword: (oldPassword, newPassword) =>
        platformApi.post('/auth/change-password', { oldPassword, newPassword })
}

// ─── Platform Tenants API ───
export const platformTenantsAPI = {
    list: () => platformApi.get('/tenants'),
    get: (id) => platformApi.get(`/tenants/${id}`),
    create: (data) => platformApi.post('/tenants', data),
    update: (id, data) => platformApi.patch(`/tenants/${id}`, data),
    activate: (id) => platformApi.patch(`/tenants/${id}/activate`),
    deactivate: (id) => platformApi.patch(`/tenants/${id}/deactivate`),
    getStats: (id) => platformApi.get(`/tenants/${id}/stats`),
    impersonate: (id) => platformApi.post(`/tenants/${id}/impersonate`)
}

// ─── Platform Dashboard API ───
export const platformDashboardAPI = {
    getOverview: () => platformApi.get('/dashboard')
}

export default platformApi
