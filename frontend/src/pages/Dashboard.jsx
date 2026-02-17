import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportsAPI } from '../services/api'
import { format } from 'date-fns'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'
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
    const navigate = useNavigate()

    useEffect(() => { loadDashboard() }, [])
    useDataSync(DataSyncEvents.SALE_CREATED, loadDashboard)
    useDataSync(DataSyncEvents.PURCHASE_CREATED, loadDashboard)

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

    const formatCurrency = (val) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(val || 0)

    // Greeting Logic
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
    }

    // Chart Logic
    const getMaxChartValue = () => {
        if (!data) return 100
        const maxSale = Math.max(...(data.sales_trend?.map(d => d.amount) || [0]))
        const maxPurch = Math.max(...(data.purchase_trend?.map(d => d.amount) || [0]))
        return Math.max(maxSale, maxPurch, 100)
    }

    const maxChartVal = getMaxChartValue()
    const hasChartActivity = maxChartVal > 100

    // Donut Logic
    const getDonutGradient = () => {
        if (!data?.expense_breakdown?.length) return 'conic-gradient(#1e293b 0% 100%)'

        let gradient = 'conic-gradient('
        let currentDeg = 0
        const total = data.expense_breakdown.reduce((sum, item) => sum + item.total, 0) || 1
        const colors = ['#2F8FFF', '#29B070', '#f59e0b', '#FF5C6C', '#a855f7']

        data.expense_breakdown.forEach((item, idx) => {
            const deg = (item.total / total) * 360
            const color = colors[idx % colors.length]
            gradient += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `
            currentDeg += deg
        })

        return gradient.slice(0, -2) + ')'
    }

    if (loading) return <DashboardSkeleton />

    const trend = (() => {
        if (!data?.last_month_sales || data.last_month_sales === 0) return { val: 0, dir: 'neutral' }
        const diff = (data.this_month_sales - data.last_month_sales) / data.last_month_sales * 100
        return { val: Math.abs(diff).toFixed(0), dir: diff >= 0 ? 'up' : 'down' }
    })()

    return (
        <div className="page-container">
            {/* 1. Greeting Banner */}
            <div className="dashboard-greeting">
                <div className="greeting-text">
                    <h1>{getGreeting()}, Admin</h1>
                    <div className="greeting-date">
                        {format(new Date(), 'EEEE, d MMMM yyyy')} • Processed <span className="font-bold text-white">{data?.today_sales?.invoices || 0}</span> invoices today.
                    </div>
                </div>
                <div className="greeting-stat">
                    <div className="label">Total Revenue (Month)</div>
                    <div className="value"><Counter value={data?.this_month_sales} prefix="Rs. " /></div>
                </div>
            </div>

            {/* 2. KPI Cards - 5 Col Grid */}
            <div className="dashboard-grid">
                {/* Today's Sales */}
                <div className="kpi-card kpi-sales">
                    <div className="kpi-header">
                        <span className="kpi-label">Today's Sales</span>
                        <div className="kpi-icon" aria-label="Sales Icon">📊</div>
                    </div>
                    <div className={`kpi-value ${!data?.today_sales?.total ? 'zero-value' : ''}`}>
                        <Counter value={data?.today_sales?.total} prefix="Rs. " />
                    </div>
                    <div className="kpi-footer">
                        <div className="flex items-center gap-2">
                            <span className={`trend-badge trend-${trend.dir}`}>
                                {trend.dir === 'up' ? '↗' : '↘'} {trend.val}%
                            </span>
                            <span className="kpi-subtitle">vs last</span>
                        </div>
                        <div className="kpi-timestamp">As of {format(lastUpdated, 'h:mm a')}</div>
                    </div>
                </div>

                {/* Cash Received */}
                <div className="kpi-card kpi-cash">
                    <div className="kpi-header">
                        <span className="kpi-label">Cash Received</span>
                        <div className="kpi-icon" aria-label="Cash Icon">💰</div>
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
                        <span className="kpi-label">Net Profit (Mo)</span>
                        <div className="kpi-icon" aria-label="Profit Icon">📈</div>
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
                        <div className="kpi-icon" aria-label="Receivables Icon">⏳</div>
                    </div>
                    <div className={`kpi-value ${!data?.outstanding_receivables ? 'zero-value' : ''} text-warning`}>
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
                        <div className="kpi-icon" aria-label="Payables Icon">💸</div>
                    </div>
                    <div className={`kpi-value ${!data?.outstanding_payables ? 'zero-value' : ''} text-danger`}>
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

                                // SQL Scale for better visualization of variance
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
                        <h3 className="chart-title">Recent Activity</h3>
                        <Link to="/reports" className="view-all-btn">View All</Link>
                    </div>
                    <div className="timeline">
                        {data?.recent_activity?.length > 0 ? (
                            data.recent_activity.map((act, i) => (
                                <div key={i} className="timeline-item">
                                    <div
                                        className={`timeline-dot dot-${act.type}`}
                                        title={act.type === 'sale' ? 'Sale Record' : 'Purchase Record'}
                                    ></div>
                                    <div className="timeline-content">
                                        <div className="tl-info">
                                            {/* Swap Hierarchy: Party Name First, Ref Second */}
                                            <span className="tl-party">{act.party_name || 'Walk-in Customer'}</span>
                                            <span className="tl-ref">{act.ref}</span>
                                        </div>
                                        <div className="tl-meta">
                                            <span className={`tl-amount ${act.type === 'sale' ? 'text-success' : 'text-danger'}`}>
                                                {act.type === 'sale' ? '+' : '-'}{act.amount > 1000000
                                                    ? (act.amount / 1000000).toFixed(2) + 'M'
                                                    : formatCurrency(act.amount).replace('PKR', '').trim()}
                                            </span>
                                            <span className="tl-time">{format(new Date(act.created_at), 'h:mm a')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-muted text-center py-8 text-sm">No recent transactions</div>
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
                                const rankClass = i === 0 ? 'top-1' : i < 3 ? `top-${i + 1}` : 'top-rest'
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
                                    const colors = ['#2F8FFF', '#29B070', '#f59e0b', '#FF5C6C', '#a855f7']
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
                        <div className="chart-empty bg-transparent border-0 h-32">
                            <span>No expenses recorded</span>
                            <Link to="/expenses" className="empty-cta-btn">+ Add Expense</Link>
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
                                <span>📄</span>
                                <span className="text-sm font-semibold">Overdue Invoices</span>
                            </div>
                            <div className="flex items-center">
                                {data?.pending_actions?.overdue_invoices > 0 &&
                                    <span className="count-badge">{data.pending_actions.overdue_invoices}</span>
                                }
                                <span className="chevron">›</span>
                            </div>
                        </Link>

                        <Link to="/reports" className={`pending-item ${data?.pending_actions?.low_stock > 0 ? 'warning' : ''}`}>
                            <div className="flex items-center gap-3">
                                <span>⚠️</span>
                                <span className="text-sm font-semibold">Low Stock Items</span>
                            </div>
                            <div className="flex items-center">
                                {data?.pending_actions?.low_stock > 0 &&
                                    <span className="count-badge">{data.pending_actions.low_stock}</span>
                                }
                                <span className="chevron">›</span>
                            </div>
                        </Link>

                        <Link to="/purchases/new" className="pending-item">
                            <div className="flex items-center gap-3">
                                <span>📦</span>
                                <span className="text-sm font-semibold">Incomplete POs</span>
                            </div>
                            <div className="flex items-center">
                                <span className="chevron">›</span>
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
            <div className="skeleton" style={{ height: '100px', width: '100%', marginBottom: '24px' }}></div>
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
