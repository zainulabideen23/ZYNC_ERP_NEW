import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportsAPI, dashboardAPI } from '../services/api'
import { format } from 'date-fns'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'
import { useAuthStore } from '../store/auth.store'
import { formatActivity, getActionColor, timeAgo, formatIP } from '../utils/activityFormatter'
import { onboardingAPI } from '../services/api'
import {
    Search, Bell, TrendingUp, TrendingDown, Minus, Banknote, BarChart2,
    Clock, AlertCircle, AlertTriangle, ArrowRight, ChevronRight, Activity,
    Receipt, ShoppingCart, Package, User, Truck, CreditCard,
    FileText, BookOpen, Tag, Ruler, Landmark, PackageCheck, Trophy,
    LogIn, KeyRound, Database, Building2, UserCog, Settings,
    Shield, X, FilePlus, Pencil, Trash2
} from 'lucide-react'

const WaveIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="greeting-wave">
        <path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8" />
        <path d="M10 19v-3.96 3.15" />
        <path d="M7 19h5" />
        <path d="M16 14h.01" />
        <path d="M18 14h.01" />
    </svg>
)

// ─── Inline Icon Map ───
const TABLE_ICON_MAP = {
    sales: Receipt,
    purchases: ShoppingCart,
    products: Package,
    customers: User,
    suppliers: Truck,
    expenses: CreditCard,
    backup: Database,
    quotations: FileText,
    company_info: Settings,
    reports: BarChart2,
    stock_adjustments: Shield,
    journals: BookOpen,
    categories: Tag,
    units: Ruler,
    accounts: Landmark,
    users: UserCog,
}
// Action-specific icons: key for login, file-plus for create, pencil for update, trash for delete
const ACTION_ICON_MAP = {
    login: KeyRound,
    login_failed: KeyRound,
    password_change: KeyRound,
    create: FilePlus,
    update: Pencil,
    delete: Trash2,
    approve: FilePlus,
    reject: Trash2,
}
const resolveIcon = (action, tableName) =>
    ACTION_ICON_MAP[action] || TABLE_ICON_MAP[tableName] || Activity

// ─── Hex colors for dot indicator (avoids dynamic Tailwind class issues) ───
const DOT_COLORS = {
    'bg-green-500': '#22c55e', 'bg-blue-500': '#3b82f6', 'bg-red-500': '#ef4444',
    'bg-yellow-500': '#eab308', 'bg-red-400': '#f87171', 'bg-red-600': '#dc2626',
    'bg-purple-500': '#a855f7', 'bg-indigo-500': '#6366f1', 'bg-orange-500': '#f97316',
    'bg-slate-400': '#94a3b8', 'bg-slate-500': '#64748b',
}
// Icon tint per action
const ICON_TINT = {
    create: '#4ade80', update: '#fbbf24', delete: '#f87171',
    login: '#60a5fa', login_failed: '#f87171', password_change: '#c084fc',
    approve: '#4ade80', reject: '#f87171',
}
import toast from 'react-hot-toast'
import './Dashboard.css'

// ─── Animating Counter Component ───
const Counter = ({ value, duration = 1000, prefix = '', className = '' }) => {
    const [count, setCount] = useState(0)

    useEffect(() => {
        let startTime
        let animationFrame

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp
            const progress = timestamp - startTime
            const percentage = Math.min(progress / duration, 1)
            const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage)
            setCount(value * ease)
            if (progress < duration) animationFrame = requestAnimationFrame(animate)
        }

        animationFrame = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(animationFrame)
    }, [value, duration])

    const formatted = new Intl.NumberFormat('en-PK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(count)

    return <span className={className}>{prefix}{formatted}</span>
}

function Dashboard() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState(new Date())
    const [searchQuery, setSearchQuery] = useState('')
    const [recentActivity, setRecentActivity] = useState([])
    const [activityLoading, setActivityLoading] = useState(true)
    const [bellOpen, setBellOpen] = useState(false)
    const bellRef = useRef(null)
    const navigate = useNavigate()
    const { user, tenant } = useAuthStore()

    // ─── Incomplete setup banner state ───
    const [setupBannerData, setSetupBannerData] = useState(null)
    const [bannerDismissed, setBannerDismissed] = useState(
        () => localStorage.getItem('zync-setup-banner-dismissed') === 'true'
    )

    useEffect(() => { loadDashboard(); loadRecentActivity() }, [])

    // Check incomplete setup for admin
    useEffect(() => {
        if (user?.role === 'admin' && tenant?.is_onboarded && !bannerDismissed) {
            onboardingAPI.status().then(res => {
                const cs = res.data?.completed_steps || {}
                const missing = []
                if (!cs.company_info) missing.push('Company Info')
                if (!cs.categories) missing.push('Categories')
                if (!cs.brands) missing.push('Brands')
                if (missing.length > 0) {
                    // Find first incomplete step number
                    const stepMap = { 'Company Info': 1, 'Categories': 2, 'Brands': 3 }
                    const firstStep = stepMap[missing[0]] || 1
                    setSetupBannerData({ missing, firstStep })
                }
            }).catch(() => {})
        }
    }, [user?.role, tenant?.is_onboarded, bannerDismissed])
    useDataSync(DataSyncEvents.SALE_CREATED, loadDashboard)
    useDataSync(DataSyncEvents.PURCHASE_CREATED, loadDashboard)

    // Auto-refresh recent activity every 60 seconds
    useEffect(() => {
        const interval = setInterval(loadRecentActivity, 60000)
        return () => clearInterval(interval)
    }, [])

    // Close bell dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) {
                setBellOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function loadDashboard() {
        try {
            const response = await reportsAPI.dashboard()
            setData(response.data)
            setLastUpdated(new Date())
        } catch (error) {
            console.error('Failed to load dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadRecentActivity() {
        try {
            const response = await dashboardAPI.recentActivity()
            setRecentActivity(response.data || [])
        } catch (error) {
            console.error('Failed to load recent activity:', error)
        } finally {
            setActivityLoading(false)
        }
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(val || 0)

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
    }

    const getMaxChartValue = () => {
        if (!data) return 100
        const maxSale = Math.max(...(data.sales_trend?.map(d => d.amount) || [0]))
        const maxPurch = Math.max(...(data.purchase_trend?.map(d => d.amount) || [0]))
        return Math.max(maxSale, maxPurch, 100)
    }

    const maxChartVal = getMaxChartValue()
    const hasChartActivity = maxChartVal > 100

    const getDonutGradient = () => {
        if (!data?.expense_breakdown?.length) return 'conic-gradient(#1e293b 0% 100%)'
        let gradient = 'conic-gradient('
        let currentDeg = 0
        const total = data.expense_breakdown.reduce((sum, item) => sum + item.total, 0) || 1
        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']
        data.expense_breakdown.forEach((item, idx) => {
            const deg = (item.total / total) * 360
            const color = colors[idx % colors.length]
            gradient += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `
            currentDeg += deg
        })
        return gradient.slice(0, -2) + ')'
    }

    const handleSearch = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/sales?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    const getAlertCount = () => {
        if (!data) return 0
        return (data.pending_actions?.overdue_invoices || 0) + (data.pending_actions?.low_stock || 0)
    }

    const getActivityTitle = () => {
        if (user?.role === 'cashier') return 'Your Activity Today'
        return 'Recent Activity'
    }

    if (loading) return <DashboardSkeleton />

    const trend = (() => {
        if (!data?.last_month_sales || data.last_month_sales === 0) return { val: 0, dir: 'neutral' }
        const diff = (data.this_month_sales - data.last_month_sales) / data.last_month_sales * 100
        return { val: Math.abs(diff).toFixed(0), dir: diff >= 0 ? 'up' : 'down' }
    })()

    const alertCount = getAlertCount()

    return (
        <div className="page-container">

            {/* Breadcrumbs */}
            <div className="dashboard-breadcrumbs">
                <Link to="/" className="breadcrumb-link">Home</Link>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">Dashboard</span>
            </div>

            {/* Incomplete Setup Banner */}
            {setupBannerData && !bannerDismissed && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderRadius: 10, marginBottom: 16,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <AlertTriangle size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
                        <div>
                            <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.88rem' }}>
                                Your setup is incomplete.
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: 8 }}>
                                Missing: {setupBannerData.missing.join(', ')}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                            onClick={() => navigate(`/setup?step=${setupBannerData.firstStep}`)}
                            style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem',
                                fontWeight: 600, color: '#fbbf24', cursor: 'pointer',
                                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}
                        >Complete Setup →</button>
                        <button
                            onClick={() => { setBannerDismissed(true); localStorage.setItem('zync-setup-banner-dismissed', 'true') }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* 1. Greeting Banner */}
            <div className="dashboard-greeting">
                <div className="greeting-text">
                    <h1><WaveIcon /> {getGreeting()}, Admin</h1>
                    <div className="greeting-date">
                        {format(new Date(), 'EEEE, d MMMM yyyy')} • Processed <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{data?.today_sales?.invoices || 0}</span> invoices today.
                    </div>
                </div>

                <div className="greeting-right">
                    <div className="dashboard-search">
                        <Search size={16} className="dashboard-search-icon" />
                        <input
                            type="text"
                            placeholder="Search invoices, customers, products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearch}
                        />
                    </div>

                    <div className="relative" ref={bellRef}>
                        <button
                            className="notification-bell"
                            onClick={() => setBellOpen(!bellOpen)}
                            title="Notifications"
                        >
                            <Bell size={18} />
                            {alertCount > 0 && (
                                <span className="notification-badge">{alertCount}</span>
                            )}
                        </button>

                        {bellOpen && (
                            <div className="notification-dropdown">
                                <div className="notification-dropdown-header">
                                    <span>Notifications</span>
                                    <button onClick={() => setBellOpen(false)} className="notification-dropdown-close">
                                        <X size={14} />
                                    </button>
                                </div>
                                <div>
                                    <button
                                        className="notification-dropdown-item"
                                        onClick={() => { navigate('/products?filter=low_stock'); setBellOpen(false) }}
                                    >
                                        <AlertCircle size={16} className="n-icon yellow" />
                                        <span>
                                            {data?.pending_actions?.low_stock || 0} product{(data?.pending_actions?.low_stock || 0) !== 1 ? 's' : ''} low on stock
                                        </span>
                                    </button>
                                    <button
                                        className="notification-dropdown-item"
                                        onClick={() => { navigate('/sales?status=pending'); setBellOpen(false) }}
                                    >
                                        <FileText size={16} className="n-icon blue" />
                                        <span>
                                            {data?.pending_actions?.overdue_invoices || 0} overdue invoice{(data?.pending_actions?.overdue_invoices || 0) !== 1 ? 's' : ''}
                                        </span>
                                    </button>
                                    {(user?.role === 'admin' || user?.role === 'manager') && (
                                        <button
                                            className="notification-dropdown-item"
                                            onClick={() => { navigate('/inventory/adjustments'); setBellOpen(false) }}
                                        >
                                            <Package size={16} className="n-icon purple" />
                                            <span>
                                                0 pending adjustments
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="greeting-stat">
                        <div className="label">Total Revenue (Month)</div>
                        <div className="value"><Counter value={data?.this_month_sales} prefix="Rs. " /></div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="quick-stats-row">
                <div className="quick-stat-item" onClick={() => navigate(data?.top_products?.[0]?.id ? `/products?highlight=${data.top_products[0].id}` : '/products')}>
                    <span className="qs-icon"><Trophy size={16} style={{ color: '#fbbf24' }} /></span>
                    <span className="qs-label">Top Product:</span>
                    <span className="qs-value">{data?.top_products?.[0]?.name || '—'}</span>
                    <ArrowRight size={14} style={{ color: 'var(--color-hint)', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
                <div className="quick-stat-item" onClick={() => navigate('/sales?status=pending')}>
                    <span className="qs-icon"><FileText size={16} style={{ color: 'var(--color-accent)' }} /></span>
                    <span className="qs-label">Pending Invoices:</span>
                    <span className="qs-value">{data?.pending_actions?.overdue_invoices || 0}</span>
                    <ArrowRight size={14} style={{ color: 'var(--color-hint)', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
                <div className="quick-stat-item" onClick={() => navigate('/products?filter=low_stock')}>
                    <span className="qs-icon"><Package size={16} style={{ color: 'var(--color-warning)' }} /></span>
                    <span className="qs-label">Low Stock:</span>
                    <span className="qs-value">{data?.pending_actions?.low_stock || 0}</span>
                    <ArrowRight size={14} style={{ color: 'var(--color-hint)', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
            </div>

            {/* 2. KPI Cards */}
            <div className="dashboard-grid">
                {/* Today's Sales */}
                <div className="kpi-card kpi-sales">
                    <div className="kpi-header">
                        <span className="kpi-label">Today's Sales</span>
                        <div className="kpi-icon" style={{ background: 'var(--green-dim)' }} aria-label="Sales Icon">
                            <TrendingUp size={18} style={{ color: 'var(--color-success)' }} />
                        </div>
                    </div>
                    <div className={`kpi-value ${!data?.today_sales?.total ? 'zero-value' : ''}`}>
                        <Counter value={data?.today_sales?.total} prefix="Rs. " />
                    </div>
                    <div className="kpi-footer">
                        <div className="flex items-center gap-2">
                            <span className={`trend-badge trend-${trend.dir}`}>
                                {trend.dir === 'up' ? <TrendingUp size={10} /> : trend.dir === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />} {trend.val}%
                            </span>
                            <span className="kpi-subtitle">vs last month</span>
                        </div>
                        <div className="kpi-timestamp">As of {format(lastUpdated, 'h:mm a')}</div>
                    </div>
                </div>

                {/* Cash Received */}
                <div className="kpi-card kpi-cash">
                    <div className="kpi-header">
                        <span className="kpi-label">Cash Received</span>
                        <div className="kpi-icon" style={{ background: 'var(--blue-dim)' }} aria-label="Cash Icon">
                            <Banknote size={18} style={{ color: 'var(--color-accent)' }} />
                        </div>
                    </div>
                    <div className={`kpi-value ${!data?.today_sales?.received ? 'zero-value' : ''}`}>
                        <Counter value={data?.today_sales?.received} prefix="Rs. " />
                    </div>
                    <div className="kpi-footer">
                        <span className="kpi-subtitle text-success">Collected today</span>
                        <div className="kpi-timestamp">As of {format(lastUpdated, 'h:mm a')}</div>
                    </div>
                </div>

                {/* Net Profit */}
                <div className="kpi-card kpi-profit">
                    <div className="kpi-header">
                        <span className="kpi-label">Net Profit (Month)</span>
                        <div className="kpi-icon" style={{ background: 'var(--purple-dim)' }} aria-label="Profit Icon">
                            <BarChart2 size={18} style={{ color: '#8B5CF6' }} />
                        </div>
                    </div>
                    <div className={`kpi-value ${!data?.month_profit?.net_profit ? 'zero-value' : ''}`}
                        style={{ color: (data?.month_profit?.net_profit || 0) >= 0 ? undefined : 'var(--color-danger)' }}>
                        <Counter value={Math.abs(data?.month_profit?.net_profit || 0)} prefix={(data?.month_profit?.net_profit || 0) < 0 ? '-Rs. ' : 'Rs. '} />
                    </div>
                    <div className="kpi-footer">
                        <span className="kpi-subtitle">Income - Expense</span>
                    </div>
                </div>

                {/* Receivables */}
                <div className="kpi-card kpi-receivable">
                    <div className="kpi-header">
                        <span className="kpi-label">Receivables</span>
                        <div className="kpi-icon" style={{ background: 'var(--amber-dim)' }} aria-label="Receivables Icon">
                            <Clock size={18} style={{ color: 'var(--color-warning)' }} />
                        </div>
                    </div>
                    <div className={`kpi-value ${!data?.outstanding_receivables ? 'zero-value' : ''}`}>
                        <Counter value={data?.outstanding_receivables} prefix="Rs. " />
                    </div>
                    <div className="kpi-footer">
                        <span className="kpi-subtitle">Customer Balances</span>
                    </div>
                </div>

                {/* Payables */}
                <div className="kpi-card kpi-payable">
                    <div className="kpi-header">
                        <span className="kpi-label">Payables</span>
                        <div className="kpi-icon" style={{ background: 'var(--red-dim)' }} aria-label="Payables Icon">
                            <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />
                        </div>
                    </div>
                    <div className={`kpi-value ${!data?.outstanding_payables ? 'zero-value' : ''}`}>
                        <Counter value={data?.outstanding_payables} prefix="Rs. " />
                    </div>
                    <div className="kpi-footer">
                        <span className="kpi-subtitle">Supplier Dues</span>
                    </div>
                </div>
            </div>

            {/* 3. Charts Section */}
            <div className="chart-section">
                {/* Cash Flow Chart */}
                <div className="chart-card fixed-height">
                    <div className="chart-header">
                        <h3 className="chart-title">Cash Flow Trend</h3>
                        <div className="chart-legend">
                            <div className="legend-pill"><div className="legend-color bg-accent"></div> Sales</div>
                            <div className="legend-pill"><div className="legend-color bg-danger opacity-80"></div> Purchases</div>
                        </div>
                        <div className="time-range-selector">
                            <button className="time-range-btn active">7 Days</button>
                            <button className="time-range-btn">30 Days</button>
                            <button className="time-range-btn">90 Days</button>
                        </div>
                    </div>

                    {hasChartActivity ? (
                        <div className="dual-bar-chart">
                            <div className="chart-bg-lines">
                                <div className="chart-line"></div>
                                <div className="chart-line"></div>
                                <div className="chart-line"></div>
                                <div className="chart-line"></div>
                                <div className="chart-line"></div>
                            </div>
                            {data?.sales_trend?.map((day, i) => {
                                const salesVal = day.amount
                                const purchVal = data?.purchase_trend?.[i]?.amount || 0
                                const maxSqrt = Math.sqrt(maxChartVal)
                                const salesH = salesVal > 0 ? Math.max((Math.sqrt(salesVal) / maxSqrt) * 100, 4) : 0
                                const purchH = purchVal > 0 ? Math.max((Math.sqrt(purchVal) / maxSqrt) * 100, 4) : 0

                                return (
                                    <div key={i} className="chart-col">
                                        <div className="bars-group">
                                            <div className="bar bar-sales" style={{ height: `${salesH}%`, minHeight: salesVal > 0 ? '4px' : '0' }}></div>
                                            <div className="bar bar-purchase" style={{ height: `${purchH}%`, minHeight: purchVal > 0 ? '4px' : '0' }}></div>
                                        </div>
                                        <span className="chart-label">{format(new Date(day.date), 'dd MMM')}</span>
                                        <div className="tooltip">
                                            <div className="font-bold mb-1">{format(new Date(day.date), 'EEE, dd MMM')}</div>
                                            <div className="flex justify-between gap-4 text-xs">
                                                <span>Sale:</span>
                                                <span className="font-mono">{formatCurrency(salesVal)}</span>
                                            </div>
                                            <div className="flex justify-between gap-4 text-xs">
                                                <span>Buy:</span>
                                                <span className="font-mono">{formatCurrency(purchVal)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="chart-empty">
                            <div>No significant activity in last 7 days</div>
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="chart-card fixed-height">
                    <div className="chart-header">
                        <h3 className="chart-title">{getActivityTitle()}</h3>
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                            <Link to="/audit-logs" className="view-all-btn">View All</Link>
                        )}
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: '340px', paddingRight: '6px' }}>
                        {activityLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="animate-pulse" style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-panel-3)', marginTop: 8, flexShrink: 0 }} />
                                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--color-panel-3)', flexShrink: 0 }} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                            <div style={{ height: 12, background: 'var(--color-panel-3)', borderRadius: 'var(--radius-xs)', width: '75%' }} />
                                            <div style={{ height: 8, background: 'var(--color-panel-3)', borderRadius: 'var(--radius-xs)', width: '33%' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentActivity.length > 0 ? (
                            <div>
                                {recentActivity.map((log, idx) => {
                                    const activity = formatActivity(log)
                                    const dotColor = getActionColor(log.action)
                                    const Icon = resolveIcon(log.action, log.table_name)
                                    const iconTint = ICON_TINT[log.action] || '#94a3b8'
                                    const fullDate = log.created_at ? new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19) : ''

                                    return (
                                        <div
                                            key={log.id}
                                            className="activity-item"
                                            style={{
                                                borderBottom: idx < recentActivity.length - 1 ? '1px solid var(--border-surface)' : 'none',
                                            }}
                                        >
                                            {/* Color dot */}
                                            <div className="activity-dot" style={{ background: DOT_COLORS[dotColor] || 'var(--color-hint)' }} />
                                            {/* Icon box */}
                                            <div className="activity-icon-box">
                                                <Icon size={14} style={{ color: iconTint }} />
                                            </div>
                                            {/* Text content */}
                                            <div className="activity-text">
                                                <p>
                                                    <span className="username">{log.user?.username || 'System'}</span>
                                                    {' '}
                                                    <span className="action">{activity.text}</span>
                                                </p>
                                                <div className="activity-meta">
                                                    {activity.amount != null && (
                                                        <span className={`activity-amount ${activity.amountType === 'positive' ? 'positive' : 'negative'}`}>
                                                            {activity.amountType === 'positive' ? '+' : '-'}Rs. {Number(activity.amount).toLocaleString()}
                                                        </span>
                                                    )}
                                                    <span className="activity-time" title={fullDate}>{timeAgo(log.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', textAlign: 'center' }}>
                                <Activity size={32} style={{ color: 'var(--color-hint)', marginBottom: '0.5rem' }} />
                                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Panels Grid */}
            <div className="panels-grid">
                {/* Top Products */}
                <div className="chart-card">
                    <div className="chart-header">
                        <h3 className="chart-title">Top Selling Products</h3>
                    </div>
                    <div className="product-list">
                        {data?.top_products?.length > 0 ? (
                            data.top_products.map((prod, i) => {
                                const maxQty = data.top_products[0].qty_sold
                                const percent = (prod.qty_sold / maxQty) * 100
                                const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : 'top-rest'
                                return (
                                    <div key={i} className="top-product-item">
                                        <div className={`rank-badge ${rankClass}`}>{i + 1}</div>
                                        <div className="prod-details">
                                            <div className="prod-header">
                                                <span className="font-bold text-sm truncate">{prod.name}</span>
                                                <span className="prod-sold-count">{prod.qty_sold} sold</span>
                                            </div>
                                            <div className="progress-track" title={`Revenue: ${formatCurrency(prod.revenue)}`}>
                                                <div className="progress-fill" style={{ width: `${percent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-muted text-center text-sm py-4">No sales data this month</div>
                        )}
                    </div>
                </div>

                {/* Expenses Donut */}
                <div className="chart-card">
                    <h3 className="chart-title mb-2">Expenses (Month)</h3>
                    {data?.expense_breakdown?.length > 0 ? (
                        <div className="donut-wrapper">
                            <div className="donut-chart" style={{ background: getDonutGradient() }}>
                                <div className="donut-hole">
                                    <div className="donut-total-label">Total</div>
                                    <div className="donut-total-value">
                                        {(data?.month_profit?.total_expenses || 0) > 1000
                                            ? `${((data?.month_profit?.total_expenses || 0) / 1000).toFixed(1)}k`
                                            : (data?.month_profit?.total_expenses || 0)}
                                    </div>
                                </div>
                            </div>
                            <div className="donut-legend">
                                {data.expense_breakdown.slice(0, 3).map((cat, i) => {
                                    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']
                                    return (
                                        <div key={i} className="legend-row">
                                            <div className="legend-cat">
                                                <div className="color-swatch" style={{ background: colors[i % colors.length] }}></div>
                                                <span>{cat.category}</span>
                                            </div>
                                            <span className="font-mono text-xs">{formatCurrency(cat.total).replace('PKR', '').trim()}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0' }}>
                            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>No expenses this month</p>
                            <button
                                onClick={() => navigate('/expenses')}
                                style={{ color: 'var(--color-accent)', fontSize: '0.75rem', marginTop: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                View Expenses →
                            </button>
                        </div>
                    )}
                </div>

                {/* Inventory & Actions */}
                <div className="flex flex-col gap-4">
                    {/* Stock Health */}
                    <div className="chart-card" style={{ paddingBottom: '20px' }}>
                        <h3 className="chart-title">Inventory Health</h3>
                        <Link to="/inventory/adjustments" className="gauge-container" title="Go to Stock Adjustments">
                            {(() => {
                                const total = data?.stock_health?.total || 1
                                const healthyW = ((data?.stock_health?.healthy || 0) / total) * 100
                                const lowW = ((data?.stock_health?.low || 0) / total) * 100
                                const outW = ((data?.stock_health?.out || 0) / total) * 100
                                return (
                                    <>
                                        <div className="gauge-seg seg-healthy" style={{ width: `${healthyW}%` }}></div>
                                        <div className="gauge-seg seg-low" style={{ width: `${lowW}%` }}></div>
                                        <div className="gauge-seg seg-out" style={{ width: `${outW}%` }}></div>
                                    </>
                                )
                            })()}
                        </Link>
                        <div className="gauge-legend">
                            <Link to="/inventory/adjustments" className="legend-item"><div className="dot bg-success"></div> Good ({data?.stock_health?.healthy || 0})</Link>
                            <Link to="/inventory/adjustments" className="legend-item"><div className="dot bg-warning"></div> Low ({data?.stock_health?.low || 0})</Link>
                            <Link to="/inventory/adjustments" className="legend-item"><div className="dot bg-danger"></div> Out ({data?.stock_health?.out || 0})</Link>
                        </div>
                    </div>

                    {/* Pending Actions */}
                    <div className="actions-list">
                        <Link to="/sales" className={`pending-item ${data?.pending_actions?.overdue_invoices > 0 ? 'urgent' : ''}`}>
                            <div className="flex items-center gap-3">
                                <FileText size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                                <span className="text-sm font-semibold">Overdue Invoices</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {data?.pending_actions?.overdue_invoices > 0 ? (
                                    <span className="count-badge" style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c' }}>{data.pending_actions.overdue_invoices}</span>
                                ) : (
                                    <span className="text-xs text-green-400 font-medium">0</span>
                                )}
                                <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
                            </div>
                        </Link>

                        <Link to="/reports" className={`pending-item ${data?.pending_actions?.low_stock > 0 ? 'warning' : ''}`}>
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                                <span className="text-sm font-semibold">Low Stock Items</span>
                            </div>
                            <div className="flex items-center">
                                {data?.pending_actions?.low_stock > 0 &&
                                    <span className="count-badge">{data.pending_actions.low_stock}</span>
                                }
                                <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
                            </div>
                        </Link>

                        <Link to="/purchases" className="pending-item">
                            <div className="flex items-center gap-3">
                                <Package size={16} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                                <span className="text-sm font-semibold">Pending Purchases</span>
                            </div>
                            <div className="flex items-center">
                                <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

function DashboardSkeleton() {
    return (
        <div className="page-container">
            <div className="skeleton" style={{ height: '20px', width: '150px', marginBottom: '16px' }}></div>
            <div className="skeleton" style={{ height: '100px', width: '100%', marginBottom: '24px' }}></div>
            <div className="skeleton" style={{ height: '40px', width: '100%', marginBottom: '24px' }}></div>
            <div className="dashboard-grid">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton sk-card"></div>)}
            </div>
            <div className="chart-section">
                <div className="skeleton sk-chart"></div>
                <div className="skeleton sk-chart"></div>
            </div>
        </div>
    )
}

export default Dashboard
