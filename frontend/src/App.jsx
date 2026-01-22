import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import Layout from './components/Layout'
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

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuthStore()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return children
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
                <ProtectedRoute>
                    <Layout />
                </ProtectedRoute>
            }>
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="customers" element={<Customers />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="accounts/:id/ledger" element={<LedgerView type="account" />} />
                <Route path="customers/:id/ledger" element={<LedgerView type="customer" />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="suppliers/:id/ledger" element={<LedgerView type="supplier" />} />
                <Route path="sales" element={<Sales />} />
                <Route path="sales/new" element={<NewSale />} />
                <Route path="quotations" element={<Quotations />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="purchases/new" element={<NewPurchase />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="journals" element={<Journals />} />
                <Route path="reports" element={<Reports />} />
                <Route path="inventory/adjustments" element={<StockAdjustment />} />
                <Route path="users" element={<Users />} />
                <Route path="settings" element={<Settings />} />
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
    )
}

export default App
