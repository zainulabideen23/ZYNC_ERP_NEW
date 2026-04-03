import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { reportsAPI } from '../services/api'
import { format } from 'date-fns'
import {
    BarChart3, Package, DollarSign, Scale, TrendingUp, Building2,
    ShoppingCart, Users, Truck, Receipt, RefreshCw, Download,
    CheckCircle, XCircle, AlertTriangle, ChevronUp, ChevronDown, ChevronRight,
    FileSpreadsheet, Printer, FileText, Search, X, TrendingDown,
    ArrowUpDown, Eye, PieChart, LayoutGrid, Minus, Activity
} from 'lucide-react'
import './Reports.css'

const allTabs = [
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'sales', label: 'Sales', icon: DollarSign },
    { id: 'pl', label: 'P&L', icon: TrendingUp },
    { id: 'expense_summary', label: 'Expenses', icon: Receipt },
    { id: 'trial', label: 'Trial Balance', icon: Scale },
    { id: 'bs', label: 'Balance Sheet', icon: Building2 },
    { id: 'sales_product', label: 'By Product', icon: LayoutGrid },
    { id: 'sales_customer', label: 'By Customer', icon: Users },
    { id: 'purchase_supplier', label: 'By Supplier', icon: Truck }
]

const categoryColors = {
    'Electronics': { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
    'Clothing': { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
    'Groceries': { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
    'Sports': { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
    'Home & Garden': { color: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)' },
    'default': { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)' }
}

const ITEMS_PER_PAGE = 50

function Reports() {
    const [activeTab, setActiveTab] = useState('stock')
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState(null)
    const [sortConfig, setSortConfig] = useState({ key: 'stock_value', direction: 'desc' })
    const [currentPage, setCurrentPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [chartPanelOpen, setChartPanelOpen] = useState(true)
    const [chartRange, setChartRange] = useState('30D')
    const [filters, setFilters] = useState({
        from_date: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
        to_date: format(new Date(), 'yyyy-MM-dd'),
        as_of_date: format(new Date(), 'yyyy-MM-dd'),
        low_stock_only: false
    })
    const exportRef = useRef(null)

    const handleTabChange = (tabId) => {
        setActiveTab(tabId)
        setCurrentPage(1)
        setSortConfig({ key: null, direction: 'asc' })
        setData(null)
        setLoading(true)
        fetchReport(tabId, filters)
    }

    const fetchReport = async (tab, tabFilters) => {
        try {
            let response
            switch (tab) {
                case 'stock':
                    response = await reportsAPI.stock({ low_stock_only: tabFilters.low_stock_only })
                    break
                case 'sales':
                    response = await reportsAPI.salesByDate({ from_date: tabFilters.from_date, to_date: tabFilters.to_date })
                    break
                case 'trial':
                    response = await reportsAPI.trialBalance({ as_of_date: tabFilters.as_of_date })
                    break
                case 'pl':
                    response = await reportsAPI.profitLoss({ from_date: tabFilters.from_date, to_date: tabFilters.to_date })
                    break
                case 'bs':
                    response = await reportsAPI.balanceSheet({ as_of_date: tabFilters.as_of_date })
                    break
                case 'sales_product':
                    response = await reportsAPI.salesByProduct({ from_date: tabFilters.from_date, to_date: tabFilters.to_date })
                    break
                case 'sales_customer':
                    response = await reportsAPI.salesByCustomer({ from_date: tabFilters.from_date, to_date: tabFilters.to_date })
                    break
                case 'purchase_supplier':
                    response = await reportsAPI.purchaseBySupplier({ from_date: tabFilters.from_date, to_date: tabFilters.to_date })
                    break
                case 'expense_summary':
                    response = await reportsAPI.expenseSummary({ from_date: tabFilters.from_date, to_date: tabFilters.to_date })
                    break
                default:
                    response = { data: null }
            }
            const rawData = response.data
            if (rawData && typeof rawData === 'object' && Array.isArray(rawData.data)) {
                setData(rawData.data)
            } else if (rawData && typeof rawData === 'object' && 'items' in rawData) {
                setData(rawData)
            } else if (Array.isArray(rawData)) {
                setData(rawData)
            } else {
                setData(rawData)
            }
        } catch (err) {
            toast.error(`Failed to load report: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (data === null && !loading) {
            setLoading(true)
            fetchReport(activeTab, filters)
        }
    }, [])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) {
                setShowExportMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }))
    }

    const getSortedData = (items) => {
        if (!sortConfig.key || !items) return items
        return [...items].sort((a, b) => {
            let aVal = a[sortConfig.key]
            let bVal = b[sortConfig.key]
            if (typeof aVal === 'string') aVal = aVal.toLowerCase()
            if (typeof bVal === 'string') bVal = bVal.toLowerCase()
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }

    const getFilteredData = (items) => {
        if (!items) return []
        let filtered = items
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(item => 
                item.name?.toLowerCase().includes(query) || 
                item.code?.toLowerCase().includes(query) ||
                item.category?.toLowerCase().includes(query)
            )
        }
        
        return getSortedData(filtered)
    }

    const getPaginatedData = (items) => {
        const filtered = getFilteredData(items)
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return {
            items: filtered.slice(start, start + ITEMS_PER_PAGE),
            total: filtered.length
        }
    }

    const getTotalPages = (totalItems) => Math.ceil((totalItems || 0) / ITEMS_PER_PAGE)

    const getDataItems = (tabData) => {
        if (!tabData) return null
        if (Array.isArray(tabData)) return tabData
        if (Array.isArray(tabData.items)) return tabData.items
        if (Array.isArray(tabData.data)) return tabData.data
        return tabData
    }

    const handleExport = (format) => {
        setShowExportMenu(false)
        console.log(`Exporting ${activeTab} as ${format}`)
    }

    const handleRefresh = () => {
        setLoading(true)
        fetchReport(activeTab, filters)
    }

    const activeReport = allTabs.find(t => t.id === activeTab)
    const categories = data?.items ? [...new Set(data.items.map(item => item.category).filter(Boolean))] : []

    // Calculate KPI metrics for the strip
    const kpis = data?.summary ? [
        { label: 'Inventory Value', value: `PKR ${data.summary.total_value.toLocaleString()}`, delta: '+12.4%', trend: 'up', color: 'green' },
        { label: 'Total Products', value: data.summary.total_items.toLocaleString(), delta: '+24', trend: 'up', color: 'blue' },
        { label: 'Low Stock', value: data.summary.low_stock_count.toString(), delta: '-3', trend: 'down', color: 'amber' },
        { label: 'Categories', value: categories.length.toString(), delta: null, trend: 'neutral', color: 'muted' },
        { label: 'Avg. Value/Item', value: `PKR ${Math.round(data.summary.total_value / data.summary.total_items).toLocaleString()}`, delta: '+8.2%', trend: 'up', color: 'green' },
        { label: 'Out of Stock', value: (data.items?.filter(i => i.current_stock === 0).length || 0).toString(), delta: null, trend: 'neutral', color: 'red' }
    ] : []

    // Get heatmap intensity for value column
    const getHeatmapStyle = (value, maxValue) => {
        if (!maxValue || maxValue === 0) return {}
        const intensity = Math.min(value / maxValue, 1)
        const baseColor = '#4ade80'
        const alpha = 0.1 + (intensity * 0.25)
        return {
            backgroundColor: `rgba(74, 222, 128, ${alpha})`,
            textShadow: intensity > 0.7 ? `0 0 8px rgba(74, 222, 128, 0.6)` : 'none'
        }
    }

    const maxStockValue = data?.items ? Math.max(...data.items.map(i => i.stock_value || 0)) : 0

    // Chart data for category distribution
    const getCategoryData = () => {
        if (!data?.items) return []
        const grouped = {}
        data.items.forEach(item => {
            const cat = item.category || 'Uncategorized'
            if (!grouped[cat]) grouped[cat] = { value: 0, count: 0 }
            grouped[cat].value += item.stock_value || 0
            grouped[cat].count += 1
        })
        return Object.entries(grouped).map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
    }

    const categoryChartData = getCategoryData()
    const maxChartValue = categoryChartData[0]?.value || 1

    return (
        <div className="reports-container terminal">
            {/* Compact Top Bar */}
            <div className="top-bar">
                <div className="top-bar-left">
                    <div className="logo-mark">
                        <Activity size={16} />
                    </div>
                    <div className="global-search">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search across all reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                        {searchQuery && (
                            <button className="clear-btn" onClick={() => setSearchQuery('')}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="top-bar-right">
                    <div className="segmented-tabs">
                        {allTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`seg-tab ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="top-bar-actions">
                        <button onClick={handleRefresh} disabled={loading} className="icon-btn" title="Refresh">
                            <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        </button>
                        <div className="export-wrapper" ref={exportRef}>
                            <button onClick={() => setShowExportMenu(!showExportMenu)} className="icon-btn" title="Export">
                                <Download size={14} />
                            </button>
                            {showExportMenu && (
                                <div className="export-menu">
                                    <button onClick={() => handleExport('csv')}>
                                        <FileSpreadsheet size={13} style={{ color: '#22c55e' }} /> CSV
                                    </button>
                                    <button onClick={() => handleExport('pdf')}>
                                        <FileText size={13} style={{ color: '#f87171' }} /> PDF
                                    </button>
                                    <button onClick={() => handleExport('print')}>
                                        <Printer size={13} style={{ color: '#6b8fff' }} /> Print
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dense KPI Strip */}
            {activeTab === 'stock' && kpis.length > 0 && (
                <div className="kpi-strip">
                    {kpis.map((kpi, i) => (
                        <div key={i} className="kpi-cell">
                            <span className="kpi-label">{kpi.label}</span>
                            <span className="kpi-value">{kpi.value}</span>
                            {kpi.delta && (
                                <span className={`kpi-delta ${kpi.trend}`}>
                                    {kpi.trend === 'up' ? <TrendingUp size={10} /> : kpi.trend === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
                                    {kpi.delta}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Chart Panel */}
            {activeTab === 'stock' && (
                <div className={`chart-panel ${chartPanelOpen ? 'open' : 'collapsed'}`}>
                    <button className="panel-toggle" onClick={() => setChartPanelOpen(!chartPanelOpen)}>
                        <div className="toggle-header">
                            <PieChart size={13} />
                            <span>Analytics</span>
                            {data?.summary && (
                                <span className="live-badge">LIVE</span>
                            )}
                        </div>
                        <ChevronRight size={14} className={`toggle-chevron ${chartPanelOpen ? 'rotated' : ''}`} />
                    </button>
                    {chartPanelOpen && (
                        <div className="panel-content">
                            <div className="chart-toolbar">
                                <div className="range-selector">
                                    {['7D', '30D', '90D'].map(range => (
                                        <button
                                            key={range}
                                            onClick={() => setChartRange(range)}
                                            className={`range-btn ${chartRange === range ? 'active' : ''}`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="charts-grid">
                                {/* Bar Chart - Category Values */}
                                <div className="chart-box">
                                    <div className="chart-title">Value by Category</div>
                                    <div className="bar-chart">
                                        {categoryChartData.slice(0, 6).map((cat, i) => {
                                            const pct = (cat.value / maxChartValue) * 100
                                            const catColor = categoryColors[cat.name] || categoryColors.default
                                            return (
                                                <div key={i} className="bar-row">
                                                    <span className="bar-label">{cat.name}</span>
                                                    <div className="bar-track">
                                                        <div
                                                            className="bar-fill"
                                                            style={{
                                                                width: `${pct}%`,
                                                                backgroundColor: catColor.color,
                                                                boxShadow: `0 0 8px ${catColor.glow}`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="bar-value">{Math.round(cat.value / 1000)}k</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                {/* Donut Chart - Stock Distribution */}
                                <div className="chart-box donut-box">
                                    <div className="chart-title">Stock Distribution</div>
                                    <div className="donut-wrapper">
                                        <div
                                            className="donut"
                                            style={{
                                                background: `conic-gradient(${categoryChartData.slice(0, 5).map((cat, i) => {
                                                    const pct = (cat.value / maxChartValue) * 100
                                                    return `${categoryColors[cat.name]?.color || '#94a3b8'} ${categoryChartData.slice(0, i).reduce((a, c) => a + (c.value / maxChartValue) * 100, 0)}deg ${categoryChartData.slice(0, i + 1).reduce((a, c) => a + (c.value / maxChartValue) * 100, 0)}deg`
                                                }).join(', ')})`
                                            }}
                                        >
                                            <div className="donut-hole">
                                                <span className="donut-total">{data?.items?.length || 0}</span>
                                                <span className="donut-label">SKUs</span>
                                            </div>
                                        </div>
                                        <div className="donut-legend">
                                            {categoryChartData.slice(0, 5).map((cat, i) => (
                                                <div key={i} className="legend-item">
                                                    <span className="legend-dot" style={{ backgroundColor: categoryColors[cat.name]?.color }} />
                                                    <span className="legend-text">{cat.name}</span>
                                                    <span className="legend-count">{cat.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Filters Bar */}
            <div className="filters-bar">
                {activeTab === 'stock' && (
                    <>
                        <label className="filter-toggle">
                            <input
                                type="checkbox"
                                checked={filters.low_stock_only}
                                onChange={(e) => setFilters({ ...filters, low_stock_only: e.target.checked })}
                            />
                            <span className="toggle-track">
                                <span className="toggle-thumb" />
                            </span>
                            <span>Low Stock</span>
                        </label>
                        <span className="filter-divider" />
                    </>
                )}
                {['pl', 'sales', 'sales_product', 'sales_customer', 'purchase_supplier', 'expense_summary'].includes(activeTab) && (
                    <>
                        <div className="date-range">
                            <input
                                type="date"
                                value={filters.from_date}
                                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                            />
                            <span className="date-sep">→</span>
                            <input
                                type="date"
                                value={filters.to_date}
                                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                            />
                        </div>
                        <span className="filter-divider" />
                    </>
                )}
                {['trial', 'bs'].includes(activeTab) && (
                    <>
                        <span className="filter-label">As of:</span>
                        <input
                            type="date"
                            value={filters.as_of_date}
                            onChange={(e) => setFilters({ ...filters, as_of_date: e.target.value })}
                            className="date-single"
                        />
                        <span className="filter-divider" />
                    </>
                )}
                {searchQuery && (
                    <span className="search-info">
                        <Search size={12} />
                        {getFilteredData(data?.items)?.length || 0} results for "{searchQuery}"
                        <button onClick={() => setSearchQuery('')}><X size={12} /></button>
                    </span>
                )}
            </div>

            {/* Data Table */}
            <div className="table-container">
                {activeTab === 'stock' && (
                    <table className="data-table terminal-table">
                        <thead>
                            <tr>
                                <th className="sticky-col sku-col" onClick={() => handleSort('code')}>
                                    SKU {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                </th>
                                <th className="name-col" onClick={() => handleSort('name')}>
                                    Product {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                </th>
                                <th onClick={() => handleSort('category')}>
                                    Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                </th>
                                <th className="num-col" onClick={() => handleSort('current_stock')}>
                                    Qty {sortConfig.key === 'current_stock' && (sortConfig.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                </th>
                                <th>Unit</th>
                                <th className="num-col value-col" onClick={() => handleSort('stock_value')}>
                                    Value {sortConfig.key === 'stock_value' && (sortConfig.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                </th>
                                <th className="action-col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(10)].map((_, i) => (
                                    <tr key={i} className="loading-row">
                                        <td className="sku-col"><div className="skeleton" /></td>
                                        <td><div className="skeleton wide" /></td>
                                        <td><div className="skeleton" /></td>
                                        <td className="num-col"><div className="skeleton" /></td>
                                        <td><div className="skeleton" /></td>
                                        <td className="num-col value-col"><div className="skeleton" /></td>
                                        <td className="action-col"></td>
                                    </tr>
                                ))
                            ) : getPaginatedData(data?.items)?.items?.length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <Package size={32} />
                                            <span>No items found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                getPaginatedData(data?.items)?.items?.map((item, idx) => {
                                    const catStyle = categoryColors[item.category] || categoryColors.default
                                    return (
                                        <tr key={item.id} className={item.is_low_stock ? 'warning' : ''}>
                                            <td className="sku-col">
                                                <code className="sku">{item.code}</code>
                                                {item.is_low_stock && <AlertTriangle size={10} className="warn-icon" />}
                                            </td>
                                            <td className="name-cell">{item.name}</td>
                                            <td>
                                                <span className="cat-tag" style={{ borderColor: catStyle.color, color: catStyle.color }}>
                                                    {item.category || '—'}
                                                </span>
                                            </td>
                                            <td className="num-col">
                                                <span className={item.current_stock === 0 ? 'zero' : item.is_low_stock ? 'low' : 'normal'}>
                                                    {item.current_stock.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="unit-cell">{item.unit}</td>
                                            <td className="num-col value-col">
                                                <span className="value-cell" style={getHeatmapStyle(item.stock_value, maxStockValue)}>
                                                    {item.stock_value.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="action-col">
                                                <button className="row-action"><Eye size={13} /></button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                )}

                {activeTab === 'sales' && (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('invoice_date')}>
                                    Date {sortConfig.key === 'invoice_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                </th>
                                <th className="num-col">Invoices</th>
                                <th className="num-col">Total</th>
                                <th className="num-col">Received</th>
                                <th className="num-col">Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i}><td colSpan={5}><div className="skeleton" /></td></tr>
                                ))
                            ) : (
                                getPaginatedData(getDataItems(data))?.items?.map((item, i) => (
                                    <tr key={i}>
                                        <td>{format(new Date(item.invoice_date), 'dd MMM yyyy')}</td>
                                        <td className="num-col">{item.invoices}</td>
                                        <td className="num-col green">{parseFloat(item.total).toLocaleString()}</td>
                                        <td className="num-col">{parseFloat(item.received).toLocaleString()}</td>
                                        <td className="num-col red">{parseFloat(item.credit).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}

                {activeTab === 'trial' && (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Account</th>
                                <th>Group</th>
                                <th className="num-col">Debit</th>
                                <th className="num-col">Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i}><td colSpan={5}><div className="skeleton" /></td></tr>
                                ))
                            ) : (
                                data?.accounts?.map((acc) => (
                                    <tr key={acc.id}>
                                        <td><code>{acc.code}</code></td>
                                        <td>{acc.name}</td>
                                        <td className="muted">{acc.group_name}</td>
                                        <td className="num-col">{acc.debits > 0 ? acc.debits.toLocaleString() : '—'}</td>
                                        <td className="num-col">{acc.credits > 0 ? acc.credits.toLocaleString() : '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="totals-row">
                                <td colSpan={3}>Totals</td>
                                <td className="num-col">{data?.totals?.debits?.toLocaleString()}</td>
                                <td className="num-col">{data?.totals?.credits?.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                )}

                {activeTab === 'pl' && (
                    <div className="financial-statement terminal-statement">
                        <div className="statement-block">
                            <div className="block-header green">
                                <TrendingUp size={13} /> Income
                            </div>
                            {data?.income?.map(acc => (
                                <div key={acc.id} className="statement-row">
                                    <span>{acc.name}</span>
                                    <span className="amount green">{acc.amount.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="statement-row total green">
                                <span>Total Income</span>
                                <span>{data?.total_income?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="statement-block">
                            <div className="block-header red">
                                <Receipt size={13} /> Expenses
                            </div>
                            {data?.expenses?.map(acc => (
                                <div key={acc.id} className="statement-row">
                                    <span>{acc.name}</span>
                                    <span className="amount red">{acc.amount.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="statement-row total red">
                                <span>Total Expenses</span>
                                <span>{data?.total_expenses?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className={`statement-row net ${data?.net_profit >= 0 ? 'green' : 'red'}`}>
                            <span>Net {data?.net_profit >= 0 ? 'Profit' : 'Loss'}</span>
                            <span className="amount">{data?.net_profit?.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {(activeTab === 'bs' || activeTab === 'expense_summary' || activeTab === 'sales_product' || activeTab === 'sales_customer' || activeTab === 'purchase_supplier') && (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th className="num-col">Value</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="empty-row">
                                <td colSpan={3}>
                                    <div className="empty-state">
                                        <BarChart3 size={24} />
                                        <span>{activeReport?.label} — Report View</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {activeTab === 'stock' && data?.items?.length > ITEMS_PER_PAGE && (
                <div className="pagination">
                    <span className="page-info">
                        {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, getFilteredData(data?.items)?.length)} of {getFilteredData(data?.items)?.length}
                    </span>
                    <div className="page-controls">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="page-btn"
                        >
                            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        {Array.from({ length: Math.min(getTotalPages(getFilteredData(data?.items)?.length), 7) }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={`page-btn ${currentPage === p ? 'active' : ''}`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(getTotalPages(getFilteredData(data?.items)?.length), p + 1))}
                            disabled={currentPage === getTotalPages(getFilteredData(data?.items)?.length)}
                            className="page-btn"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <select
                        className="per-page"
                        value={ITEMS_PER_PAGE}
                        onChange={() => {}}
                    >
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                    </select>
                </div>
            )}

            {/* Balance indicator for Trial Balance */}
            {activeTab === 'trial' && data && (
                <div className={`balance-indicator ${data?.is_balanced ? 'balanced' : 'unbalanced'}`}>
                    {data?.is_balanced ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    Trial Balance {data?.is_balanced ? 'Balanced' : 'NOT Balanced'}
                </div>
            )}
        </div>
    )
}

export default Reports
