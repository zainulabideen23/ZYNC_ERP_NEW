import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import './Layout.css'

const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/sales', label: 'Sales', icon: '💰' },
    { path: '/quotations', label: 'Quotations', icon: '📋' },
    { path: '/purchases', label: 'Purchases', icon: '📦' },
    { path: '/products', label: 'Products', icon: '🏷️' },
    { path: '/customers', label: 'Customers', icon: '👥' },
    { path: '/suppliers', label: 'Suppliers', icon: '🏭' },
    { path: '/accounts', label: 'Accounts', icon: '📖' },
    { path: '/journals', label: 'Journals', icon: '📝' },
    { path: '/inventory/adjustments', label: 'Stock Adjust', icon: '🔧' },
    { path: '/expenses', label: 'Expenses', icon: '💸' },
    { path: '/reports', label: 'Reports', icon: '📈' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
]

function Layout() {
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const openNewInvoice = () => {
        if (window.electronAPI) {
            window.electronAPI.openNewInvoiceWindow()
        } else {
            navigate('/sales/new')
        }
    }

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="logo">ZYNC</h1>
                    <span className="logo-sub">ERP System</span>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            end={item.path === '/'}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                    {user?.role === 'admin' && (
                        <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">👥</span>
                            <span className="nav-label">Users</span>
                        </NavLink>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button className="btn btn-primary new-sale-btn" onClick={openNewInvoice} aria-label="Create new sale">
                        + New Sale
                    </button>

                    <div className="user-info">
                        <span className="user-name">{user?.fullName || user?.username}</span>
                        <span className="user-role">{user?.role}</span>
                    </div>

                    <button className="btn btn-ghost" onClick={handleLogout} aria-label="Logout">
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
