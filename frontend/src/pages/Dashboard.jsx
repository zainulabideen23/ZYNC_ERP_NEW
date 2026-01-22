import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { reportsAPI } from '../services/api'
import { format } from 'date-fns'
import './Dashboard.css'

function Dashboard() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            const response = await reportsAPI.dashboard()
            setData(response.data)
        } catch (error) {
            console.error('Failed to load dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value || 0)
    }

    // Helper to calculate bar height percentage
    const getBarHeight = (amount) => {
        if (!data?.sales_trend) return 0;
        const max = Math.max(...data.sales_trend.map(d => d.amount), 1); // Avoid division by zero
        return Math.max((amount / max) * 100, 4); // Min 4% height
    }

    if (loading) {
        return (
            <div className="page-container flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="text-muted">Loading Dashboard...</div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="text-muted">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
                </div>
                <Link to="/sales/new" className="btn btn-primary">
                    <span className="mr-2">+</span> New Sale
                </Link>
            </header>

            {/* KPI Stats Grid */}
            <div className="dashboard-grid">
                <div className="stat-card blue">
                    <div className="stat-header">
                        <div>
                            <div className="stat-label">Today's Sales</div>
                            <div className="stat-value">{formatCurrency(data?.today_sales?.total)}</div>
                        </div>
                        <div className="stat-icon">📊</div>
                    </div>
                    <div className="stat-subtext">
                        {data?.today_sales?.invoices} invoices processed
                    </div>
                </div>

                <div className="stat-card green">
                    <div className="stat-header">
                        <div>
                            <div className="stat-label">Cash Received</div>
                            <div className="stat-value">{formatCurrency(data?.today_sales?.received)}</div>
                        </div>
                        <div className="stat-icon">💰</div>
                    </div>
                    <div className="stat-subtext">
                        Collected today
                    </div>
                </div>

                <div className="stat-card orange">
                    <div className="stat-header">
                        <div>
                            <div className="stat-label">Receivables</div>
                            <div className="stat-value text-warning">{formatCurrency(data?.outstanding_receivables)}</div>
                        </div>
                        <div className="stat-icon">⏳</div>
                    </div>
                    <div className="stat-subtext">
                        Customer pending dues
                    </div>
                </div>

                <div className="stat-card purple">
                    <div className="stat-header">
                        <div>
                            <div className="stat-label">Payables</div>
                            <div className="stat-value text-danger">{formatCurrency(data?.outstanding_payables)}</div>
                        </div>
                        <div className="stat-icon">💸</div>
                    </div>
                    <div className="stat-subtext">
                        Supplier pending dues
                    </div>
                </div>
            </div>

            {/* Low Stock Alert */}
            {data?.low_stock_count > 0 && (
                <div className="alert alert-warning mb-6 flex justify-between items-center" style={{
                    background: '#fff7ed', border: '1px solid #fdba74', padding: '16px', borderRadius: '12px', color: '#c2410c'
                }}>
                    <div className="flex items-center gap-3">
                        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                        <div>
                            <strong>Low Stock Alert</strong>
                            <div className="text-sm">There are {data.low_stock_count} products below minimum stock level.</div>
                        </div>
                    </div>
                    <Link to="/reports" className="btn btn-sm" style={{ background: 'white', border: '1px solid #fdba74' }}>View Stock</Link>
                </div>
            )}

            {/* Main Content Area */}
            <div className="chart-section">
                {/* Sales Chart */}
                <div className="chart-card">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">Sales Trend</h3>
                        <span className="text-sm text-muted">Last 7 Days</span>
                    </div>

                    <div className="simple-bar-chart">
                        {data?.sales_trend?.map((day, idx) => (
                            <div key={idx} className="chart-bar-col">
                                <div
                                    className="chart-bar"
                                    style={{ height: `${getBarHeight(day.amount)}%` }}
                                    data-value={formatCurrency(day.amount)}
                                ></div>
                                <span className="chart-label">{format(new Date(day.date), 'dd MMM')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="chart-card">
                    <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
                    <div className="activity-list">
                        {data?.recent_activity?.length === 0 ? (
                            <div className="text-muted text-center py-4">No recent transactions</div>
                        ) : (
                            data?.recent_activity?.map((act, idx) => (
                                <Link to={act.type === 'sale' ? '/sales' : '/purchases'} key={idx} className="activity-item">
                                    <div className={`activity-icon ${act.type}`}>
                                        {act.type === 'sale' ? '↗' : '↙'}
                                    </div>
                                    <div className="activity-details">
                                        <div className="activity-title text-sm">{act.party_name}</div>
                                        <div className="activity-time">{format(new Date(act.created_at), 'hh:mm a')}</div>
                                    </div>
                                    <div className={`activity-amount ${act.type === 'sale' ? 'text-success' : 'text-primary'}`}>
                                        {act.type === 'sale' ? '+' : '-'}{formatCurrency(act.amount)}
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
                <div className="quick-action-grid">
                    <Link to="/products" className="action-btn">
                        <span className="action-icon">📦</span>
                        <span>Manage Products</span>
                    </Link>
                    <Link to="/customers" className="action-btn">
                        <span className="action-icon">👥</span>
                        <span>Customers</span>
                    </Link>
                    <Link to="/expenses" className="action-btn">
                        <span className="action-icon">🧾</span>
                        <span>Record Expense</span>
                    </Link>
                    <Link to="/settings" className="action-btn">
                        <span className="action-icon">⚙️</span>
                        <span>Settings</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
