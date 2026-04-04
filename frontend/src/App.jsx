import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAuthStore } from './store/auth.store'
import { usePlatformAuthStore } from './store/platform.auth.store'
import ImpersonationBanner from './components/ImpersonationBanner'
import { authAPI } from './services/api'

const Layout = lazy(() => import('./components/Layout'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Products = lazy(() => import('./pages/Products'))
const Customers = lazy(() => import('./pages/Customers'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Sales = lazy(() => import('./pages/Sales'))
const NewSale = lazy(() => import('./pages/NewSale'))
const Purchases = lazy(() => import('./pages/Purchases'))
const NewPurchase = lazy(() => import('./pages/NewPurchase'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Journals = lazy(() => import('./pages/Journals'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Accounts = lazy(() => import('./pages/Accounts'))
const LedgerView = lazy(() => import('./pages/LedgerView'))
const StockAdjustment = lazy(() => import('./pages/StockAdjustment'))
const Quotations = lazy(() => import('./pages/Quotations'))
const Users = lazy(() => import('./pages/Users'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Units = lazy(() => import('./pages/Units'))
const SetupWizard = lazy(() => import('./pages/setup/SetupWizard'))
const CustomerPayment = lazy(() => import('./pages/CustomerPayment'))
const SupplierPayment = lazy(() => import('./pages/SupplierPayment'))

// Platform Admin imports
const PlatformLayout = lazy(() => import('./components/platform/PlatformLayout'))
const PlatformLogin = lazy(() => import('./pages/platform/PlatformLogin'))
const PlatformDashboard = lazy(() => import('./pages/platform/PlatformDashboard'))
const ClientsList = lazy(() => import('./pages/platform/ClientsList'))
const NewClient = lazy(() => import('./pages/platform/NewClient'))
const ClientDetail = lazy(() => import('./pages/platform/ClientDetail'))
const PlatformSettings = lazy(() => import('./pages/platform/PlatformSettings'))

function RouteFallback() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg)',
                color: 'var(--color-text-muted)',
                fontSize: 14,
            }}
        >
            Loading...
        </div>
    )
}

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
    const navigate = useNavigate()
    const { login, logout } = useAuthStore()

    useEffect(() => {
        const applyImpersonation = async () => {
            const token = searchParams.get('token')

            if (!token) {
                navigate('/login', { replace: true })
                return
            }

            try {
                // Persist token first, then fetch verified user from backend.
                login({ id: null, username: 'loading...', full_name: 'Loading...', role: null }, token)

                const meResponse = await authAPI.me()
                const verifiedUser = meResponse?.data

                if (!verifiedUser?.id) {
                    throw new Error('Invalid impersonation token')
                }

                login({
                    id: verifiedUser.id,
                    username: verifiedUser.username,
                    full_name: verifiedUser.full_name || verifiedUser.fullName || verifiedUser.username,
                    role: verifiedUser.role,
                    email: verifiedUser.email,
                }, token)

                navigate('/', { replace: true })
            } catch (e) {
                logout()
                navigate('/login', { replace: true })
            }
        }

        applyImpersonation()
    }, [searchParams, login, logout, navigate])

    return null
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
        <Suspense fallback={<RouteFallback />}>
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
                    <Route path="settings" element={<PlatformSettings />} />
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
        </Suspense>
    )
}

export default App
