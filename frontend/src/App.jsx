import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/auth.store'
import { usePlatformAuthStore } from './store/platform.auth.store'
import Layout from './components/Layout'
import ImpersonationBanner from './components/ImpersonationBanner'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Sales from './pages/Sales'
import NewSale from './pages/NewSale'
import Purchases from './pages/Purchases'
import NewPurchase from './pages/NewPurchase'
import Expenses from './pages/Expenses'
import Journals from './pages/Journals'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Accounts from './pages/Accounts'
import LedgerView from './pages/LedgerView'
import StockAdjustment from './pages/StockAdjustment'
import Quotations from './pages/Quotations'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import Units from './pages/Units'
import SetupWizard from './pages/setup/SetupWizard'
import CustomerPayment from './pages/CustomerPayment'
import SupplierPayment from './pages/SupplierPayment'

// Platform Admin imports
import PlatformLayout from './components/platform/PlatformLayout'
import PlatformLogin from './pages/platform/PlatformLogin'
import PlatformDashboard from './pages/platform/PlatformDashboard'
import ClientsList from './pages/platform/ClientsList'
import NewClient from './pages/platform/NewClient'
import ClientDetail from './pages/platform/ClientDetail'

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuthStore()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return children
}

function RoleRoute({ children, roles }) {
    const { user } = useAuthStore()
    if (!roles.includes(user?.role)) {
        return <Navigate to="/" replace />
    }
    return children
}

function PlatformProtectedRoute({ children }) {
    const { isAuthenticated } = usePlatformAuthStore()

    if (!isAuthenticated) {
        return <Navigate to="/platform/login" replace />
    }

    return children
}

// Handles impersonation token from URL
function ImpersonationHandler() {
    const [searchParams] = useSearchParams()
    const { login } = useAuthStore()

    useEffect(() => {
        const token = searchParams.get('token')
        if (token) {
            // Decode JWT payload (client-side, no verification)
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                login({
                    id: payload.userId,
                    username: payload.username || 'impersonated-user',
                    full_name: payload.username || 'Impersonated User',
                    role: payload.role || 'admin',
                }, token)
            } catch (e) {
                console.error('Failed to parse impersonation token', e)
            }
        }
    }, [searchParams, login])

    return <Navigate to="/" replace />
}

// Redirect non-onboarded admin users to the setup wizard
function OnboardingGuard({ children }) {
    const { user, tenant, isAuthenticated } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated) return
        // Only admin sees wizard, only non-onboarded tenants
        if (
            user?.role === 'admin' &&
            tenant?.is_onboarded === false &&
            !window.location.hash.includes('/setup')
        ) {
            navigate(`/setup?step=${tenant.onboarding_step || 1}`)
        }
    }, [isAuthenticated, tenant?.is_onboarded, user?.role, navigate, tenant?.onboarding_step])

    return children
}

function App() {
    return (
        <>
            <ImpersonationBanner />
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* Impersonation entry point */}
                <Route path="/impersonate" element={<ImpersonationHandler />} />

                {/* Platform Admin Routes */}
                <Route path="/platform/login" element={<PlatformLogin />} />
                <Route path="/platform" element={
                    <PlatformProtectedRoute>
                        <PlatformLayout />
                    </PlatformProtectedRoute>
                }>
                    <Route index element={<Navigate to="/platform/dashboard" replace />} />
                    <Route path="dashboard" element={<PlatformDashboard />} />
                    <Route path="clients" element={<ClientsList />} />
                    <Route path="clients/new" element={<NewClient />} />
                    <Route path="clients/:id" element={<ClientDetail />} />
                    <Route path="settings" element={
                        <div style={{ color: '#e2e8f0', padding: 20 }}>
                            <h2>Platform Settings</h2>
                            <p style={{ color: '#64748b' }}>Coming soon...</p>
                        </div>
                    } />
                </Route>

                {/* Setup Wizard — full screen, outside Layout */}
                <Route path="/setup" element={
                    <ProtectedRoute>
                        <RoleRoute roles={['admin']}>
                            <SetupWizard />
                        </RoleRoute>
                    </ProtectedRoute>
                } />

                {/* Tenant App Routes */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <OnboardingGuard>
                            <Layout />
                        </OnboardingGuard>
                    </ProtectedRoute>
                }>
                    <Route index element={<Dashboard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="units" element={<RoleRoute roles={['admin', 'manager']}><Units /></RoleRoute>} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="accounts" element={<RoleRoute roles={['admin', 'manager']}><Accounts /></RoleRoute>} />
                    <Route path="accounts/:id/ledger" element={<RoleRoute roles={['admin', 'manager']}><LedgerView type="account" /></RoleRoute>} />
                    <Route path="customers/:id/ledger" element={<RoleRoute roles={['admin', 'manager']}><LedgerView type="customer" /></RoleRoute>} />
                    <Route path="suppliers" element={<RoleRoute roles={['admin', 'manager']}><Suppliers /></RoleRoute>} />
                    <Route path="suppliers/:id/ledger" element={<RoleRoute roles={['admin', 'manager']}><LedgerView type="supplier" /></RoleRoute>} />
                    <Route path="sales" element={<Sales />} />
                    <Route path="sales/new" element={<NewSale />} />
                    <Route path="quotations" element={<Quotations />} />
                    <Route path="purchases" element={<RoleRoute roles={['admin', 'manager']}><Purchases /></RoleRoute>} />
                    <Route path="purchases/new" element={<RoleRoute roles={['admin', 'manager']}><NewPurchase /></RoleRoute>} />
                    <Route path="expenses" element={<RoleRoute roles={['admin', 'manager']}><Expenses /></RoleRoute>} />
                    <Route path="journals" element={<RoleRoute roles={['admin', 'manager']}><Journals /></RoleRoute>} />
                    <Route path="reports" element={<RoleRoute roles={['admin', 'manager']}><Reports /></RoleRoute>} />
                    <Route path="inventory/adjustments" element={<RoleRoute roles={['admin', 'manager']}><StockAdjustment /></RoleRoute>} />
                    <Route path="users" element={<RoleRoute roles={['admin']}><Users /></RoleRoute>} />
                    <Route path="audit-logs" element={<RoleRoute roles={['admin']}><AuditLogs /></RoleRoute>} />
                    <Route path="payments/customer" element={<RoleRoute roles={['admin', 'manager']}><CustomerPayment /></RoleRoute>} />
                    <Route path="payments/supplier" element={<RoleRoute roles={['admin', 'manager']}><SupplierPayment /></RoleRoute>} />
                    <Route path="settings" element={<RoleRoute roles={['admin', 'manager']}><Settings /></RoleRoute>} />
                </Route>

                <Route path="/pos" element={
                    <ProtectedRoute>
                        <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-primary)', minHeight: '100vh' }}>
                            <NewSale />
                        </div>
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    )
}

export default App
