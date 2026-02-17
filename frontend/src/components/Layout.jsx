import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import {
    LayoutDashboard, DollarSign, FileText, Package, Tags, Users, Factory,
    Book, FileSpreadsheet, Wrench, Receipt, BarChart3, Settings, UserCog,
    Plus, LogOut
} from 'lucide-react'
import './Layout.css'

const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/sales', label: 'Sales', icon: DollarSign },
    { path: '/quotations', label: 'Quotations', icon: FileText },
    { path: '/purchases', label: 'Purchases', icon: Package },
    { path: '/products', label: 'Products', icon: Tags },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/suppliers', label: 'Suppliers', icon: Factory },
    { path: '/accounts', label: 'Accounts', icon: Book },
    { path: '/journals', label: 'Journals', icon: FileSpreadsheet },
    { type: 'divider' },
    { path: '/inventory/adjustments', label: 'Stock Adjust', icon: Wrench },
    { path: '/expenses', label: 'Expenses', icon: Receipt },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
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
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="logo">ZYNC</h1>
                    <span className="logo-sub">ERP System</span>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item, index) => {
                        if (item.type === 'divider') {
                            return <div key={`div-${index}`} className="nav-divider"></div>
                        }

                        const Icon = item.icon
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                end={item.path === '/'}
                            >
                                <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span>
                                <span className="nav-label">{item.label}</span>
                            </NavLink>
                        )
                    })}
                    {user?.role === 'admin' && (
                        <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon"><UserCog size={18} strokeWidth={2} /></span>
                            <span className="nav-label">Users</span>
                        </NavLink>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button className="btn btn-primary new-sale-btn" onClick={openNewInvoice} aria-label="Create new sale">
                        <Plus size={16} /> New Sale
                    </button>

                    <div className="user-info">
                        <span className="user-name">{user?.fullName || user?.username}</span>
                        <span className="user-role">{user?.role}</span>
                    </div>

                    <button className="btn btn-ghost" onClick={handleLogout} aria-label="Logout">
                        <LogOut size={16} className="mr-2" /> Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
