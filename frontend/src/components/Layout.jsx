import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import PageTransition from './PageTransition'
import { useAuthStore } from '../store/auth.store'
import { useThemeStore } from '../store/theme.store'
import {
    LayoutDashboard, DollarSign, FileText, Package, Tags, Users, Factory,
    Book, FileSpreadsheet, Wrench, Receipt, BarChart3, Settings, UserCog,
    LogOut, User, ChevronDown, Shield, Ruler, ArrowLeftRight, CreditCard,
    ChevronLeft, ChevronRight, Menu, X, Sun, Moon, Banknote, TrendingUp
} from 'lucide-react'
import './Layout.css'

const menuSections = [
    {
        label: 'Navigation',
        items: [
            { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        ]
    },
    {
        label: 'Transactions',
        items: [
            { path: '/sales', label: 'Sales', icon: DollarSign },
            { path: '/quotations', label: 'Quotations', icon: FileText },
            { path: '/purchases', label: 'Purchases', icon: Package, roles: ['admin', 'manager'] },
        ]
    },
    {
        label: 'Master Data',
        items: [
            { path: '/products', label: 'Products', icon: Tags },
            { path: '/units', label: 'Units', icon: Ruler, roles: ['admin', 'manager'] },
            { path: '/customers', label: 'Customers', icon: Users },
            { path: '/suppliers', label: 'Suppliers', icon: Factory, roles: ['admin', 'manager'] },
        ]
    },
    {
        label: 'Finance',
        items: [
            { path: '/accounts', label: 'Accounts', icon: Book, roles: ['admin', 'manager'] },
            { path: '/loans', label: 'Loans', icon: Banknote, roles: ['admin', 'manager'] },
            { path: '/equity', label: 'Equity', icon: TrendingUp, roles: ['admin', 'manager'] },
            { path: '/journals', label: 'Journals', icon: FileSpreadsheet, roles: ['admin', 'manager'] },
            { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'manager'] },
            { path: '/payments/customer', label: 'Customer Payments', icon: CreditCard, roles: ['admin', 'manager'] },
            { path: '/payments/supplier', label: 'Supplier Payments', icon: ArrowLeftRight, roles: ['admin', 'manager'] },
        ]
    },
    {
        label: 'Inventory',
        items: [
            { path: '/inventory/adjustments', label: 'Stock Adjust', icon: Wrench, roles: ['admin', 'manager'] },
        ]
    },
    {
        label: 'Utilities',
        items: [
            { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
            { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager'] },
        ]
    },
]

function Layout() {
    const { user, logout } = useAuthStore()
    const { theme, toggleTheme } = useThemeStore()
    const navigate = useNavigate()
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [sidebarExpanded, setSidebarExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebarExpanded') === 'true'
        }
        return false
    })
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const navRef = useRef(null)
    const firstFocusRef = useRef(null)
    const userMenuRef = useRef(null)

    useEffect(() => {
        localStorage.setItem('sidebarExpanded', sidebarExpanded)
    }, [sidebarExpanded])

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    useEffect(() => {
        if (mobileMenuOpen && firstFocusRef.current) {
            firstFocusRef.current.focus()
        }
    }, [mobileMenuOpen])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false)
            }
        }
        
        if (userMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [userMenuOpen])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const toggleSidebar = () => {
        setSidebarExpanded(prev => !prev)
    }

    const closeMobileMenu = () => {
        setMobileMenuOpen(false)
    }

    const handleNavKeyDown = useCallback((e) => {
        const items = Array.from(navRef.current?.querySelectorAll('.nav-item') || [])
        const currentIndex = items.indexOf(document.activeElement)
        
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const nextIndex = (currentIndex + 1) % items.length
            items[nextIndex]?.focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prevIndex = (currentIndex - 1 + items.length) % items.length
            items[prevIndex]?.focus()
        }
    }, [])

    const handleOverlayClick = () => {
        setMobileMenuOpen(false)
    }

    const handleOverlayKeyDown = (e) => {
        if (e.key === 'Escape') {
            setMobileMenuOpen(false)
        }
    }

    const renderNavItem = (item) => {
        const Icon = item.icon
        const tooltip = !sidebarExpanded ? item.label : undefined
        
        return (
            <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={item.path === '/'}
                aria-current={({ isActive }) => isActive ? 'page' : undefined}
                role="menuitem"
                data-tooltip={tooltip}
                title={tooltip}
                onClick={closeMobileMenu}
            >
                <span className="nav-icon"><Icon size={18} strokeWidth={1.5} /></span>
                <span className="nav-label">{item.label}</span>
            </NavLink>
        )
    }

    return (
        <div className="layout">
            <aside 
                className={`app-sidebar ${sidebarExpanded ? 'expanded' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
                role="navigation"
                aria-label="Main navigation"
            >
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <h1 className="logo">ZYNC</h1>
                        <span className="logo-sub">ERP System</span>
                    </div>
                    <button 
                        className="sidebar-collapse-btn"
                        onClick={toggleSidebar}
                        aria-pressed={sidebarExpanded}
                        aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        <ChevronLeft size={18} />
                    </button>
                </div>

                <nav 
                    className="sidebar-nav"
                    ref={navRef}
                    onKeyDown={handleNavKeyDown}
                    role="menubar"
                >
                    {menuSections.map((section) => {
                        const visibleItems = section.items.filter(
                            (item) => !item.roles || item.roles.includes(user?.role)
                        )
                        if (visibleItems.length === 0) return null
                        return (
                        <div key={section.label} className="nav-section" role="group" aria-label={section.label}>
                            <div className="nav-section-label">{section.label}</div>
                            {visibleItems.map(renderNavItem)}
                        </div>
                        )
                    })}
                    {user?.role === 'admin' && (
                        <div className="nav-section" role="group" aria-label="Administration">
                            <div className="nav-section-label">Administration</div>
                            <NavLink 
                                to="/users" 
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                role="menuitem"
                                data-tooltip={!sidebarExpanded ? 'Users' : undefined}
                                title={!sidebarExpanded ? 'Users' : undefined}
                                onClick={closeMobileMenu}
                            >
                                <span className="nav-icon"><UserCog size={18} strokeWidth={1.5} /></span>
                                <span className="nav-label">Users</span>
                            </NavLink>
                            <NavLink 
                                to="/audit-logs" 
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                role="menuitem"
                                data-tooltip={!sidebarExpanded ? 'Audit Logs' : undefined}
                                title={!sidebarExpanded ? 'Audit Logs' : undefined}
                                onClick={closeMobileMenu}
                            >
                                <span className="nav-icon"><Shield size={18} strokeWidth={1.5} /></span>
                                <span className="nav-label">Audit Logs</span>
                            </NavLink>
                        </div>
                    )}
                </nav>

                <div className="sidebar-footer" ref={userMenuRef}>
                    <button 
                        className="user-profile-area"
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        aria-expanded={userMenuOpen}
                        aria-haspopup="true"
                    >
                        <div className="user-avatar">
                            <User size={14} />
                            <span className="user-status-dot" />
                        </div>
                        <div className="user-info">
                            <span className="user-name">{user?.fullName || user?.username}</span>
                            <span className="user-role">{user?.email || user?.role}</span>
                        </div>
                        <ChevronDown size={14} className={`user-chevron ${userMenuOpen ? 'open' : ''}`} />
                    </button>

                    {userMenuOpen && (
                        <div className="user-dropdown">
                            <div className="user-dropdown-header">
                                <div className="user-avatar-small">
                                    <User size={16} />
                                </div>
                                <div className="user-dropdown-info">
                                    <span className="user-dropdown-name">{user?.fullName || user?.username}</span>
                                    <span className="user-dropdown-email">{user?.email || user?.role}</span>
                                </div>
                            </div>
                            <div className="user-dropdown-menu">
                                <button 
                                    className="user-dropdown-item" 
                                    role="menuitem"
                                    onClick={() => { navigate('/settings'); setUserMenuOpen(false); closeMobileMenu(); }}
                                >
                                    <User size={15} strokeWidth={1.5} /> Profile
                                </button>
                                <button 
                                    className="user-dropdown-item" 
                                    role="menuitem"
                                    onClick={() => { navigate('/settings'); setUserMenuOpen(false); closeMobileMenu(); }}
                                >
                                    <Settings size={15} strokeWidth={1.5} /> Settings
                                </button>
                                <div className="user-dropdown-theme">
                                    <span className="theme-icon">
                                        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                                    </span>
                                    <span className="theme-label">Dark mode</span>
                                    <button 
                                        className={`theme-toggle-pill ${theme === 'dark' ? 'active' : ''}`}
                                        onClick={toggleTheme}
                                        role="switch"
                                        aria-checked={theme === 'dark'}
                                        aria-label="Toggle dark mode"
                                    >
                                        <span className="theme-toggle-thumb" />
                                    </button>
                                </div>
                                <div className="user-dropdown-divider" role="separator"></div>
                                <button 
                                    className="user-dropdown-item text-danger" 
                                    role="menuitem"
                                    onClick={handleLogout}
                                >
                                    <LogOut size={15} strokeWidth={1.5} /> Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    className="mobile-close-btn"
                    onClick={closeMobileMenu}
                    aria-label="Close navigation"
                    ref={firstFocusRef}
                >
                    <X size={24} />
                </button>
            </aside>

            {mobileMenuOpen && (
                <div 
                    className="sidebar-overlay"
                    onClick={handleOverlayClick}
                    onKeyDown={handleOverlayKeyDown}
                    aria-hidden="true"
                />
            )}

            <button 
                className="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
            >
                <Menu size={24} />
            </button>

            <main className="main-content" tabIndex={-1}>
                <PageTransition>
                    <Outlet />
                </PageTransition>
            </main>
        </div>
    )
}

export default Layout
