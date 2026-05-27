import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { salesAPI } from '../services/api'
import { format } from 'date-fns'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'
import SaleDetailModal from '../components/SaleDetailModal'
import { Printer, TrendingUp, FileText, Banknote, AlertCircle, ShoppingCart, Plus, Search, X, Eye, TrendingDown } from 'lucide-react'

function Sales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ search: '', status: '', from_date: '', to_date: '' })
    const [selectedSale, setSelectedSale] = useState(null)
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 })
    const [aggregates, setAggregates] = useState(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData()
        }, 500)
        return () => clearTimeout(timer)
    }, [filters, pagination.page])

    useDataSync(DataSyncEvents.SALE_CREATED, () => {
        loadData()
    })

    useDataSync(DataSyncEvents.SALE_UPDATED, () => {
        loadData()
    })

    const loadData = async (page = pagination.page) => {
        setLoading(true)
        try {
            const response = await salesAPI.list({
                page,
                limit: 50,
                ...filters
            })
            setSales(response.data || [])
            setPagination(response.pagination || { page: 1, limit: 50, total: 0, pages: 1 })
            setAggregates(response.aggregates || null)
        } catch (error) {
            console.error('Failed to load sales:', error)
        } finally {
            setLoading(false)
        }
    }

    const clearFilters = () => {
        setFilters({ search: '', status: '', from_date: '', to_date: '' })
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const handlePrintInvoice = async (sale) => {
        try {
            const response = await salesAPI.get(sale.id)
            const data = response.data

            const printContent = `
                <!DOCTYPE html><html><head><title>Invoice-${data.invoice_number}</title><style>
                *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a2e;line-height:1.5}
                .invoice-header{display:flex;justify-content:space-between;margin-bottom:40px;padding-bottom:25px;border-bottom:3px solid #059669}
                .company-info h1{font-size:32px;font-weight:700;color:#059669}.company-info p{color:#64748b;font-size:13px;margin-top:4px}
                .invoice-title{text-align:right}.invoice-title h2{font-size:28px;font-weight:300;color:#64748b;text-transform:uppercase;letter-spacing:3px}
                .invoice-title .invoice-number{font-size:18px;font-weight:600;color:#1a1a2e;margin-top:5px}
                .billing-section{display:flex;justify-content:space-between;margin-bottom:35px;gap:40px}
                .billing-box{flex:1;padding:20px;background:#f8fafc;border-radius:8px;border-left:4px solid #059669}
                .billing-box h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:10px;font-weight:600}
                .billing-box p{font-size:15px;color:#1a1a2e}.billing-box .highlight{font-weight:600;font-size:16px}
                table{width:100%;border-collapse:collapse;margin-bottom:30px}thead tr{background:#059669}
                th{padding:14px 16px;text-align:left;font-weight:600;color:#fff;font-size:12px;text-transform:uppercase}
                td{padding:16px;border-bottom:1px solid #e2e8f0;font-size:14px}.text-right{text-align:right}.text-center{text-align:center}
                .totals-wrapper{display:flex;justify-content:flex-end}.totals{width:320px;background:#f8fafc;border-radius:8px;padding:20px}
                .totals .row{display:flex;justify-content:space-between;padding:10px 0;font-size:14px}
                .totals .row.total{font-size:20px;font-weight:700;border-top:2px solid #059669;margin-top:10px;padding-top:15px}
                .status-badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase}
                .status-paid{background:#dcfce7;color:#16a34a}.status-partial{background:#fef3c7;color:#d97706}.status-unpaid{background:#fee2e2;color:#dc2626}
                .footer{margin-top:50px;padding-top:25px;border-top:1px solid #e2e8f0;text-align:center}
                .footer .thanks{font-size:18px;color:#059669;font-weight:500;margin-bottom:8px}.footer .meta{font-size:11px;color:#94a3b8}
                @media print{body{padding:20px}.billing-box,.totals,thead tr{background:#f8fafc!important;-webkit-print-color-adjust:exact}.status-badge{-webkit-print-color-adjust:exact}}
                </style></head><body>
                <div class="invoice-header"><div class="company-info"><h1>ZYNC</h1><p>Enterprise Resource Planning</p></div>
                <div class="invoice-title"><h2>Invoice</h2><div class="invoice-number">${data.invoice_number}</div></div></div>
                <div class="billing-section">
                <div class="billing-box"><h3>Bill To</h3><p class="highlight">${data.customer_name || 'Walk-in Customer'}</p></div>
                <div class="billing-box"><h3>Invoice Date</h3><p class="highlight">${format(new Date(data.sale_date), 'MMMM dd, yyyy')}</p></div>
                <div class="billing-box"><h3>Status</h3><span class="status-badge ${Number(data.amount_due) === 0 ? 'status-paid' : Number(data.amount_paid) > 0 ? 'status-partial' : 'status-unpaid'}">${Number(data.amount_due) === 0 ? 'Paid' : Number(data.amount_paid) > 0 ? 'Partial' : 'Unpaid'}</span></div></div>
                <table><thead><tr><th>#</th><th>Description</th><th class="text-center">Qty</th><th class="text-right">Price</th><th class="text-right">Amount</th></tr></thead><tbody>
                ${(data.items || []).map((item, i) => `<tr><td class="text-center">${i+1}</td><td>${item.product_name||item.name}</td><td class="text-center">${item.quantity}</td><td class="text-right">Rs. ${Number(item.unit_price).toLocaleString()}</td><td class="text-right"><strong>Rs. ${Number(item.line_total||item.quantity*item.unit_price).toLocaleString()}</strong></td></tr>`).join('')}
                </tbody></table>
                <div class="totals-wrapper"><div class="totals">
                <div class="row subtotal"><span>Subtotal</span><span>Rs. ${Number(data.subtotal).toLocaleString()}</span></div>
                <div class="row total"><span>Total</span><span>Rs. ${Number(data.total_amount).toLocaleString()}</span></div>
                <div class="row"><span>Paid</span><span>Rs. ${Number(data.amount_paid).toLocaleString()}</span></div>
                <div class="row"><span>Due</span><span>Rs. ${Number(data.amount_due).toLocaleString()}</span></div></div></div>
                <div class="footer"><p class="thanks">Thank you for your business!</p><p class="meta">Generated ${format(new Date(),'dd/MM/yyyy HH:mm')}</p></div></body></html>`

            let printFrame = document.getElementById('print-frame')
            if (!printFrame) {
                printFrame = document.createElement('iframe')
                printFrame.id = 'print-frame'
                printFrame.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;border:none;'
                document.body.appendChild(printFrame)
            }
            const frameDoc = printFrame.contentWindow || printFrame.contentDocument
            const doc = frameDoc.document || frameDoc
            doc.open(); doc.write(printContent); doc.close()
            printFrame.onload = () => { frameDoc.focus(); frameDoc.print() }
        } catch (error) {
            console.error('Failed to print invoice:', error)
        }
    }

    const getDisplayStatus = (sale) => {
        const currentStatus = String(sale?.status || '').toLowerCase()
        const returnedAmount = Number(sale?.returned_amount || 0)

        if (currentStatus !== 'returned' && returnedAmount > 0.0001) {
            return 'partially_returned'
        }

        return currentStatus
    }

    // Status Badge with proper colors
    const StatusBadge = ({ sale }) => {
        const status = getDisplayStatus(sale)
        const styles = {
            completed: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Paid' },
            paid: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Paid' },
            confirmed: { bg: 'rgba(5, 153, 105, 0.15)', color: '#059669', label: 'Confirmed' },
            draft: { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', label: 'Draft' },
            cancelled: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Cancelled' },
            returned: { bg: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4', label: 'Returned' },
            partially_returned: { bg: 'rgba(14, 116, 144, 0.15)', color: '#0891B2', label: 'Partial Return' },
        }
        const s = styles[status] || { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: status || 'N/A' }
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 600,
                backgroundColor: s.bg, color: s.color, letterSpacing: '0.02em'
            }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color }} />
                {s.label}
            </span>
        )
    }

    // Metric Card Component
    const MetricCard = ({ label, value, icon: Icon, color, subtext, trend }) => (
        <div style={{
            background: 'var(--color-panel)',
            border: '1px solid var(--border-surface)',
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            minWidth: 0,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.borderColor = color + '40'
            e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-surface)'
            e.currentTarget.style.transform = 'translateY(0)'
        }}
        >
            {/* Decorative circle */}
            <div style={{
                position: 'absolute', top: '-20px', right: '-20px',
                width: '100px', height: '100px', borderRadius: '50%',
                background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', position: 'relative' }}>
                <span style={{
                    fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>{label}</span>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: color + '20', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                {value}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{subtext}</span>
                {trend && (
                    <span style={{ 
                        fontSize: '11px', fontWeight: 500, 
                        color: trend > 0 ? '#10b981' : '#ef4444',
                        display: 'flex', alignItems: 'center', gap: '2px'
                    }}>
                        {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
        </div>
    )

    return (
        <div style={{
            padding: '24px',
            maxWidth: '1400px',
            margin: '0 auto',
            background: 'var(--color-bg)',
            minHeight: '100vh'
        }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '10px',
                        background: 'rgba(5, 153, 105, 0.12)',
                        border: '1px solid rgba(5, 153, 105, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <ShoppingCart size={20} color="var(--blue)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Sales</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Track and manage all your sales</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => window.open('/#/pos', '_blank', 'width=1200,height=800')}
                        style={{
                            height: '38px', padding: '0 14px',
                            borderRadius: '8px', border: '1px solid var(--border-surface)',
                            background: 'transparent', color: 'var(--color-text-dim)',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        Launch POS
                    </button>
                    <Link to="/sales/new" style={{ textDecoration: 'none' }}>
                        <button style={{
                            height: '38px', padding: '0 16px',
                            borderRadius: '8px', border: 'none',
                            background: 'var(--blue)', color: '#fff',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 2px 8px rgba(5, 153, 105, 0.3)'
                        }}>
                            <Plus size={16} />
                            New Sale
                        </button>
                    </Link>
                </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard
                    label="Total Revenue"
                    value={formatCurrency(aggregates?.total_sales || 0)}
                    icon={TrendingUp}
                    color="#059669"
                    subtext="Filtered total"
                />
                <MetricCard
                    label="Invoices"
                    value={aggregates?.count || 0}
                    icon={FileText}
                    color="#0891B2"
                    subtext="Filtered count"
                />
                <MetricCard
                    label="Received"
                    value={formatCurrency(aggregates?.total_paid || 0)}
                    icon={Banknote}
                    color="#10b981"
                    subtext="Collected"
                />
                <MetricCard
                    label="Pending"
                    value={formatCurrency(aggregates?.total_due || 0)}
                    icon={AlertCircle}
                    color="#f59e0b"
                    subtext="Outstanding"
                />
            </div>

            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--color-panel)',
                borderRadius: '12px', padding: '14px 16px',
                marginBottom: '16px', border: '1px solid var(--border-surface)'
            }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '0 0 260px' }}>
                    <Search size={15} style={{
                        position: 'absolute', left: '12px', top: '50%',
                        transform: 'translateY(-50%)', color: 'var(--color-hint)'
                    }} />
                    <input
                        type="text"
                        placeholder="Search invoices, customers..."
                        value={filters.search}
                        onChange={(e) => setFilters({...filters, search: e.target.value})}
                        style={{
                            width: '100%', height: '36px',
                            background: 'var(--color-panel-2)',
                            border: '1px solid var(--border-surface)',
                            borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px',
                            fontSize: '13px', color: 'var(--color-text)',
                            outline: 'none'
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    style={{
                        height: '36px', background: 'var(--color-panel-2)',
                        border: '1px solid var(--border-surface)',
                        borderRadius: '8px', paddingLeft: '12px', paddingRight: '28px',
                        fontSize: '13px', color: 'var(--color-text)',
                        outline: 'none', cursor: 'pointer', appearance: 'none'
                    }}
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="completed">Completed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                </select>

                {/* Date Range */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                        type="date"
                        value={filters.from_date}
                        onChange={(e) => setFilters({...filters, from_date: e.target.value})}
                        style={{
                            height: '36px', background: 'var(--color-panel-2)',
                            border: '1px solid var(--border-surface)',
                            borderRadius: '8px', paddingLeft: '10px', paddingRight: '10px',
                            fontSize: '13px', color: 'var(--color-text)',
                            outline: 'none', colorScheme: 'dark'
                        }}
                    />
                    <span style={{ color: 'var(--color-hint)', fontSize: '12px' }}>—</span>
                    <input
                        type="date"
                        value={filters.to_date}
                        onChange={(e) => setFilters({...filters, to_date: e.target.value})}
                        style={{
                            height: '36px', background: 'var(--color-panel-2)',
                            border: '1px solid var(--border-surface)',
                            borderRadius: '8px', paddingLeft: '10px', paddingRight: '10px',
                            fontSize: '13px', color: 'var(--color-text)',
                            outline: 'none', colorScheme: 'dark'
                        }}
                    />
                </div>

                {(filters.search || filters.status || filters.from_date || filters.to_date) && (
                    <button
                        onClick={clearFilters}
                        style={{
                            height: '36px', padding: '0 10px',
                            borderRadius: '8px', border: 'none',
                            background: 'transparent', color: 'var(--color-muted)',
                            fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                    >
                        <X size={13} /> Clear
                    </button>
                )}

            </div>
            {/* Table */}
            <div style={{
                background: 'var(--color-panel)',
                borderRadius: '12px', border: '1px solid var(--border-surface)',
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ width: '100px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && sales.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '90px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '28px', height: '28px', background: 'var(--color-panel-2)', borderRadius: '6px' }} />
                                                <div style={{ width: '100px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ width: '60px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ width: '50px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '60px', height: '24px', background: 'var(--color-panel-2)', borderRadius: '6px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '60px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} />
                                        </td>
                                    </tr>
                                ))}
                            </>
                        ) : sales.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '16px',
                                            background: 'var(--color-panel-2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <FileText size={24} color="var(--color-hint)" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No sales yet</p>
                                            <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Create your first sale to get started</p>
                                        </div>
                                        <Link to="/sales/new" style={{ textDecoration: 'none' }}>
                                            <button style={{
                                                marginTop: '8px', padding: '8px 16px',
                                                borderRadius: '8px', border: 'none',
                                                background: 'var(--blue)', color: '#fff',
                                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}>
                                                <Plus size={14} /> New Sale
                                            </button>
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ) : sales.map((sale, index) => (
                            <tr
                                key={sale.id}
                                style={{
                                    borderBottom: index < sales.length - 1 ? '1px solid var(--border-light)' : 'none',
                                    background: 'var(--color-panel)',
                                    transition: 'background 0.15s',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedSale(sale)}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}
                            >
                                <td style={{ padding: '14px 16px' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedSale(sale) }}
                                        style={{
                                            fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500,
                                            color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0
                                        }}
                                    >
                                        #{sale.invoice_number}
                                    </button>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                    {format(new Date(sale.sale_date), 'dd MMM yyyy')}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '6px',
                                            background: 'var(--color-panel-2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)'
                                        }}>
                                            {(sale.customer_name || 'WI').charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                                            {sale.customer_name || 'Walk-in'}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                                    <div>{formatCurrency(sale.total_amount)}</div>
                                    {Number(sale.returned_amount || 0) > 0 && (
                                        <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '2px' }}>
                                            Returned {formatCurrency(sale.returned_amount)}
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: '#10b981' }}>
                                    {formatCurrency(sale.amount_paid)}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 500, color: parseFloat(sale.amount_due) > 0 ? '#ef4444' : 'var(--color-hint)' }}>
                                    {parseFloat(sale.amount_due) > 0 ? formatCurrency(sale.amount_due) : '—'}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <StatusBadge sale={sale} />
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', opacity: 0.5, transition: 'opacity 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                                        <button
                                            onClick={() => setSelectedSale(sale)}
                                            style={{
                                                width: '30px', height: '30px', borderRadius: '6px',
                                                border: '1px solid var(--border-surface)',
                                                background: 'transparent', color: 'var(--color-muted)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title="View"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        <button
                                            onClick={() => handlePrintInvoice(sale)}
                                            style={{
                                                width: '30px', height: '30px', borderRadius: '6px',
                                                border: '1px solid var(--border-surface)',
                                                background: 'transparent', color: 'var(--color-muted)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title="Print"
                                        >
                                            <Printer size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderTop: '1px solid var(--border-surface)',
                    background: 'var(--color-panel-2)'
                }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>
                        {sales.length > 0 ? `Showing ${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}` : 'No results'}
                    </span>
                    {pagination.pages > 1 && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                onClick={() => setPagination(p => ({...p, page: Math.max(1, p.page - 1)}))}
                                disabled={pagination.page === 1}
                                style={{
                                    width: '30px', height: '30px', borderRadius: '6px',
                                    border: '1px solid var(--border-surface)',
                                    background: 'transparent', color: 'var(--color-muted)',
                                    cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                                    opacity: pagination.page === 1 ? 0.5 : 1
                                }}
                            >&lt;</button>
                            <span style={{ padding: '0 10px', fontSize: '12px', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center' }}>
                                {pagination.page} / {pagination.pages}
                            </span>
                            <button
                                onClick={() => setPagination(p => ({...p, page: Math.min(p.pages, p.page + 1)}))}
                                disabled={pagination.page === pagination.pages}
                                style={{
                                    width: '30px', height: '30px', borderRadius: '6px',
                                    border: '1px solid var(--border-surface)',
                                    background: 'transparent', color: 'var(--color-muted)',
                                    cursor: pagination.page === pagination.pages ? 'not-allowed' : 'pointer',
                                    opacity: pagination.page === pagination.pages ? 0.5 : 1
                                }}
                            >&gt;</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {selectedSale && (
                <SaleDetailModal
                    saleId={selectedSale.id}
                    onClose={() => setSelectedSale(null)}
                    onPrint={handlePrintInvoice}
                    onReturned={() => loadData()}
                />
            )}
        </div>
    )
}

export default Sales
