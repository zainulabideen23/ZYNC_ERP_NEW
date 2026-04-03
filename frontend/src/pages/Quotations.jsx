import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { quotationsAPI, productsAPI, customersAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { 
    FileText, Plus, Search, X, Download, Eye, 
    Send, CheckCircle, XCircle, Clock, DollarSign,
    TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

function Quotations() {
    const navigate = useNavigate()
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedQuotation, setSelectedQuotation] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateRange, setDateRange] = useState({ from: '', to: '' })

    const [customers, setCustomers] = useState([])
    const [products, setProducts] = useState([])
    const [formData, setFormData] = useState({
        customer_id: '',
        quotation_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [{ product_id: '', quantity: 1, unit_price: 0, line_discount: 0, tax_rate: 0 }],
        discount_amount: 0,
        discount_percentage: 0,
        tax_amount: 0,
        notes: ''
    })

    useEffect(() => {
        loadQuotations()
        loadMasterData()
    }, [statusFilter, searchQuery, dateRange])

    const loadMasterData = async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                customersAPI.list({ limit: 500 }),
                productsAPI.list({ limit: 500 })
            ])
            setCustomers(custRes.data)
            setProducts(prodRes.data)
        } catch (error) {
            console.error('Failed to load master data')
        }
    }

    const loadQuotations = async () => {
        try {
            setLoading(true)
            const params = { status: statusFilter || undefined }
            if (searchQuery) params.search = searchQuery
            if (dateRange.from) params.from_date = dateRange.from
            if (dateRange.to) params.to_date = dateRange.to
            
            const response = await quotationsAPI.list(params)
            setQuotations(response.data || [])
        } catch (error) {
            toast.error('Failed to load quotations')
        } finally {
            setLoading(false)
        }
    }

    const handleConvertToSale = async (quotation) => {
        if (quotation.status !== 'accepted') {
            toast.error('Only accepted quotations can be converted to sales')
            return
        }

        try {
            await quotationsAPI.updateStatus(quotation.id, 'converted')
            toast.success('Quotation marked as converted')
            navigate('/sales/new', { state: { quotationId: quotation.id } })
        } catch (error) {
            toast.error(`Failed to convert: ${error.message}`)
        }
    }

    const handleUpdateStatus = async (quotation, newStatus) => {
        try {
            await quotationsAPI.updateStatus(quotation.id, newStatus)
            toast.success(`Status updated to ${newStatus}`)
            loadQuotations()
        } catch (error) {
            toast.error(`Failed to update status: ${error.message}`)
        }
    }

    const handleSendEmail = async (quotation) => {
        try {
            await quotationsAPI.send(quotation.id)
            toast.success('Quotation sent to customer')
        } catch (error) {
            toast.error('Failed to send quotation')
        }
    }

    const handleExportCSV = () => {
        if (quotations.length === 0) return

        const headers = ['Quote #', 'Customer', 'Date', 'Valid Until', 'Amount', 'Status']
        const rows = quotations.map(q => [
            q.quotation_number,
            q.customer_name,
            format(new Date(q.quotation_date), 'yyyy-MM-dd'),
            format(new Date(q.valid_until), 'yyyy-MM-dd'),
            q.total_amount,
            q.status
        ])

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `quotations_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
        link.click()
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const StatusBadge = ({ status }) => {
        const config = {
            draft: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'Draft', icon: FileText },
            sent: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Sent', icon: Send },
            accepted: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Accepted', icon: CheckCircle },
            rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Rejected', icon: XCircle },
            converted: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', label: 'Converted', icon: DollarSign },
            expired: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Expired', icon: Clock }
        }
        const s = config[status] || config.draft
        const Icon = s.icon
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 600,
                backgroundColor: s.bg, color: s.color, letterSpacing: '0.02em'
            }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color }} />
                {s.label}
            </span>
        )
    }

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
                {trend !== undefined && (
                    <span style={{ 
                        fontSize: '11px', fontWeight: 500, 
                        color: trend >= 0 ? '#10b981' : '#ef4444',
                        display: 'flex', alignItems: 'center', gap: '2px'
                    }}>
                        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
        </div>
    )

    const totals = {
        totalValue: quotations.reduce((sum, q) => sum + Number(q.total_amount || 0), 0),
        accepted: quotations.filter(q => q.status === 'accepted').length,
        pending: quotations.filter(q => ['draft', 'sent'].includes(q.status)).length,
        converted: quotations.filter(q => q.status === 'converted').length
    }

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
                        background: 'rgba(139, 92, 246, 0.12)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <FileText size={20} color="var(--purple)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Quotations</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Create and manage customer quotations</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                        height: '38px', padding: '0 16px',
                        borderRadius: '8px', border: 'none',
                        background: 'var(--purple)', color: '#fff',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                    }}
                >
                    <Plus size={16} />
                    New Quotation
                </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard
                    label="Total Value"
                    value={formatCurrency(totals.totalValue)}
                    icon={DollarSign}
                    color="#8b5cf6"
                    subtext="All quotations"
                />
                <MetricCard
                    label="Accepted"
                    value={totals.accepted}
                    icon={CheckCircle}
                    color="#10b981"
                    subtext="Ready to convert"
                    trend={5}
                />
                <MetricCard
                    label="Pending"
                    value={totals.pending}
                    icon={Clock}
                    color="#f59e0b"
                    subtext="Awaiting response"
                />
                <MetricCard
                    label="Converted"
                    value={totals.converted}
                    icon={TrendingUp}
                    color="#3b82f6"
                    subtext="To sales"
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
                        placeholder="Search quotations, customers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', height: '36px',
                            background: 'var(--color-panel-2)',
                            border: '1px solid var(--border-surface)',
                            borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px',
                            fontSize: '13px', color: 'var(--color-text)',
                            outline: 'none'
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
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
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="converted">Converted</option>
                    <option value="expired">Expired</option>
                </select>

                {/* Date Range */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
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
                        value={dateRange.to}
                        onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                        style={{
                            height: '36px', background: 'var(--color-panel-2)',
                            border: '1px solid var(--border-surface)',
                            borderRadius: '8px', paddingLeft: '10px', paddingRight: '10px',
                            fontSize: '13px', color: 'var(--color-text)',
                            outline: 'none', colorScheme: 'dark'
                        }}
                    />
                </div>

                {(searchQuery || statusFilter || dateRange.from || dateRange.to) && (
                    <button
                        onClick={() => { setSearchQuery(''); setStatusFilter(''); setDateRange({ from: '', to: '' }) }}
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

                <div style={{ flex: 1 }} />

                {/* Export */}
                <button
                    onClick={handleExportCSV}
                    style={{
                        height: '36px', padding: '0 12px',
                        borderRadius: '8px', border: '1px solid var(--border-surface)',
                        background: 'transparent', color: 'var(--color-muted)',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    <Download size={14} /> Export
                </button>
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
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quote #</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valid Until</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ width: '100px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && quotations.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '28px', height: '28px', background: 'var(--color-panel-2)', borderRadius: '6px' }} />
                                                <div style={{ width: '100px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '90px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '90px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '70px', height: '24px', background: 'var(--color-panel-2)', borderRadius: '6px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '60px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} />
                                        </td>
                                    </tr>
                                ))}
                            </>
                        ) : quotations.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '16px',
                                            background: 'var(--color-panel-2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <FileText size={24} color="var(--color-hint)" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No quotations found</p>
                                            <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Create your first quotation to get started</p>
                                        </div>
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            style={{
                                                marginTop: '8px', padding: '8px 16px',
                                                borderRadius: '8px', border: 'none',
                                                background: 'var(--purple)', color: '#fff',
                                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <Plus size={14} /> New Quotation
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : quotations.map((quote, index) => {
                            const isExpired = new Date(quote.valid_until) < new Date() && !['converted', 'rejected'].includes(quote.status)
                            return (
                                <tr
                                    key={quote.id}
                                    style={{
                                        borderBottom: index < quotations.length - 1 ? '1px solid var(--border-light)' : 'none',
                                        background: 'var(--color-panel)',
                                        transition: 'background 0.15s',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        setSelectedQuotation(quote)
                                        setShowModal(true)
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}
                                >
                                    <td style={{ padding: '14px 16px' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500,
                                            color: 'var(--purple)'
                                        }}>
                                            {quote.quotation_number}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '6px',
                                                background: 'var(--color-panel-2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)'
                                            }}>
                                                {(quote.customer_name || 'CU').charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                                                {quote.customer_name || 'Unknown'}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                        {format(new Date(quote.quotation_date), 'dd MMM yyyy')}
                                    </td>
                                    <td style={{ padding: '14px 16px', fontSize: '13px', color: isExpired ? '#ef4444' : 'var(--color-text-dim)', fontWeight: isExpired ? 500 : 400 }}>
                                        {isExpired && <AlertCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                        {format(new Date(quote.valid_until), 'dd MMM yyyy')}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                                        {formatCurrency(quote.total_amount)}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <StatusBadge status={isExpired ? 'expired' : quote.status} />
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', opacity: 0.5, transition: 'opacity 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                        onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                                            {quote.status === 'accepted' && (
                                                <button
                                                    onClick={() => handleConvertToSale(quote)}
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Convert to Sale"
                                                >
                                                    <DollarSign size={14} />
                                                </button>
                                            )}
                                            {['draft', 'sent'].includes(quote.status) && (
                                                <button
                                                    onClick={() => handleSendEmail(quote)}
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Send Email"
                                                >
                                                    <Send size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setSelectedQuotation(quote); setShowModal(true) }}
                                                style={{
                                                    width: '30px', height: '30px', borderRadius: '6px',
                                                    border: '1px solid var(--border-surface)',
                                                    background: 'transparent', color: 'var(--color-muted)',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                                title="View Details"
                                            >
                                                <Eye size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* Footer */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderTop: '1px solid var(--border-surface)',
                    background: 'var(--color-panel-2)'
                }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>
                        {quotations.length > 0 ? `Showing ${quotations.length} quotations` : 'No results'}
                    </span>
                </div>
            </div>

            {/* Detail Modal */}
            {showModal && selectedQuotation && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: 'var(--color-panel)',
                            borderRadius: '16px',
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            border: '1px solid var(--border-surface)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: 'rgba(139, 92, 246, 0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FileText size={18} color="var(--purple)" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                                            {selectedQuotation.quotation_number}
                                        </h2>
                                        <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: '2px 0 0 0' }}>
                                            Created {format(new Date(selectedQuotation.quotation_date), 'dd MMM yyyy')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        border: '1px solid var(--border-surface)',
                                        background: 'transparent', color: 'var(--color-muted)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{selectedQuotation.customer_name}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div>
                                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--purple)' }}>{formatCurrency(selectedQuotation.total_amount)}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{format(new Date(selectedQuotation.quotation_date), 'dd MMM yyyy')}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valid Until</div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{format(new Date(selectedQuotation.valid_until), 'dd MMM yyyy')}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</h4>
                                <StatusBadge status={selectedQuotation.status} />
                            </div>

                            <div style={{ borderTop: '1px solid var(--border-surface)', paddingTop: '20px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Product</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Qty</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Price</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedQuotation.items || []).map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: idx < selectedQuotation.items.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--color-text)' }}>{item.product_name}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-dim)' }}>{item.quantity}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: 'var(--color-text-dim)' }}>{formatCurrency(item.unit_price)}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{formatCurrency(item.line_total || item.quantity * item.unit_price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px' }}>
                            {selectedQuotation.status === 'draft' && (
                                <>
                                    <button
                                        onClick={() => { handleUpdateStatus(selectedQuotation, 'sent'); setShowModal(false) }}
                                        style={{
                                            flex: 1, height: '40px', borderRadius: '8px',
                                            border: 'none', background: 'var(--blue)', color: '#fff',
                                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <Send size={14} /> Send to Customer
                                    </button>
                                    <button
                                        onClick={() => { handleUpdateStatus(selectedQuotation, 'rejected'); setShowModal(false) }}
                                        style={{
                                            height: '40px', padding: '0 16px', borderRadius: '8px',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            background: 'transparent', color: '#ef4444',
                                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <XCircle size={14} />
                                    </button>
                                </>
                            )}
                            {selectedQuotation.status === 'accepted' && (
                                <button
                                    onClick={() => { handleConvertToSale(selectedQuotation); setShowModal(false) }}
                                    style={{
                                        flex: 1, height: '40px', borderRadius: '8px',
                                        border: 'none', background: '#10b981', color: '#fff',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <DollarSign size={14} /> Convert to Sale
                                </button>
                            )}
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    height: '40px', padding: '0 16px', borderRadius: '8px',
                                    border: '1px solid var(--border-surface)',
                                    background: 'transparent', color: 'var(--color-muted)',
                                    fontSize: '13px', fontWeight: 500, cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CreateQuotationModal
                show={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                customers={customers}
                products={products}
                formData={formData}
                setFormData={setFormData}
                onAddItem={() => setFormData({ ...formData, items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0 }] })}
                onRemoveItem={(idx) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })}
                onItemChange={(idx, field, value) => {
                    const newItems = [...formData.items]
                    newItems[idx][field] = value
                    if (field === 'product_id') {
                        const product = products.find(p => p.id === value)
                        if (product) newItems[idx].unit_price = product.retail_price
                    }
                    setFormData({ ...formData, items: newItems })
                }}
                onSubmit={async (e) => {
                    e.preventDefault()
                    try {
                        const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
                        const totalAmount = (subtotal - formData.discount_amount) + formData.tax_amount
                        await quotationsAPI.create({ ...formData, subtotal, total_amount: totalAmount })
                        toast.success('Quotation created successfully')
                        setShowCreateModal(false)
                        setFormData({
                            customer_id: '',
                            quotation_date: format(new Date(), 'yyyy-MM-dd'),
                            valid_until: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                            items: [{ product_id: '', quantity: 1, unit_price: 0, line_discount: 0, tax_rate: 0 }],
                            discount_amount: 0,
                            discount_percentage: 0,
                            tax_amount: 0,
                            notes: ''
                        })
                        loadQuotations()
                    } catch (error) {
                        toast.error(error.message)
                    }
                }}
            />
        </div>
    )
}

function CreateQuotationModal({ show, onClose, customers, products, formData, setFormData, onAddItem, onRemoveItem, onItemChange, onSubmit }) {
    if (!show) return null

    const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const total = subtotal - formData.discount_amount + formData.tax_amount

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 1100, backdropFilter: 'blur(4px)'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--color-panel)', borderRadius: '16px',
                    width: '95%', maxWidth: '800px', maxHeight: '90vh',
                    overflowY: 'auto', border: '1px solid var(--border-surface)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'rgba(139, 92, 246, 0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <FileText size={18} color="var(--purple)" />
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Create New Quotation</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: '1px solid var(--border-surface)',
                            background: 'transparent', color: 'var(--color-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit}>
                    <div style={{ padding: '24px' }}>
                        {/* Customer & Dates */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Customer *</label>
                                <select
                                    value={formData.customer_id}
                                    onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                                    required
                                    style={{
                                        width: '100%', height: '40px',
                                        background: 'var(--color-panel-2)',
                                        border: '1px solid var(--border-surface)',
                                        borderRadius: '8px', paddingLeft: '12px', paddingRight: '12px',
                                        fontSize: '13px', color: 'var(--color-text)',
                                        outline: 'none', cursor: 'pointer'
                                    }}
                                >
                                    <option value="">Select Customer...</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Date</label>
                                    <input
                                        type="date"
                                        value={formData.quotation_date}
                                        onChange={e => setFormData({ ...formData, quotation_date: e.target.value })}
                                        required
                                        style={{
                                            width: '100%', height: '40px',
                                            background: 'var(--color-panel-2)',
                                            border: '1px solid var(--border-surface)',
                                            borderRadius: '8px', paddingLeft: '12px', paddingRight: '12px',
                                            fontSize: '13px', color: 'var(--color-text)',
                                            outline: 'none', colorScheme: 'dark'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Valid Until</label>
                                    <input
                                        type="date"
                                        value={formData.valid_until}
                                        onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                                        style={{
                                            width: '100%', height: '40px',
                                            background: 'var(--color-panel-2)',
                                            border: '1px solid var(--border-surface)',
                                            borderRadius: '8px', paddingLeft: '12px', paddingRight: '12px',
                                            fontSize: '13px', color: 'var(--color-text)',
                                            outline: 'none', colorScheme: 'dark'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</h4>
                                <button
                                    type="button"
                                    onClick={onAddItem}
                                    style={{
                                        height: '32px', padding: '0 12px',
                                        borderRadius: '6px', border: '1px solid var(--border-surface)',
                                        background: 'transparent', color: 'var(--purple)',
                                        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    <Plus size={14} /> Add Item
                                </button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-panel-2)', borderRadius: '10px', overflow: 'hidden' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Product</th>
                                        <th style={{ width: '80px', padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Qty</th>
                                        <th style={{ width: '110px', padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Price</th>
                                        <th style={{ width: '110px', padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Total</th>
                                        <th style={{ width: '50px', padding: '12px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: idx < formData.items.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                            <td style={{ padding: '10px 12px' }}>
                                                <select
                                                    value={item.product_id}
                                                    onChange={e => onItemChange(idx, 'product_id', e.target.value)}
                                                    required
                                                    style={{
                                                        width: '100%', height: '36px',
                                                        background: 'var(--color-panel)',
                                                        border: '1px solid var(--border-surface)',
                                                        borderRadius: '6px', paddingLeft: '10px', paddingRight: '10px',
                                                        fontSize: '13px', color: 'var(--color-text)',
                                                        outline: 'none', cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">Select...</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => onItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                    min="1"
                                                    required
                                                    style={{
                                                        width: '100%', height: '36px',
                                                        background: 'var(--color-panel)',
                                                        border: '1px solid var(--border-surface)',
                                                        borderRadius: '6px', paddingLeft: '10px', paddingRight: '10px',
                                                        fontSize: '13px', color: 'var(--color-text)',
                                                        outline: 'none', textAlign: 'center'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={e => onItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    required
                                                    style={{
                                                        width: '100%', height: '36px',
                                                        background: 'var(--color-panel)',
                                                        border: '1px solid var(--border-surface)',
                                                        borderRadius: '6px', paddingLeft: '10px', paddingRight: '10px',
                                                        fontSize: '13px', color: 'var(--color-text)',
                                                        outline: 'none', textAlign: 'right'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                                                {formatCurrency(item.quantity * item.unit_price)}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveItem(idx)}
                                                    disabled={formData.items.length <= 1}
                                                    style={{
                                                        width: '28px', height: '28px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'transparent', color: 'var(--color-muted)',
                                                        cursor: formData.items.length <= 1 ? 'not-allowed' : 'pointer',
                                                        opacity: formData.items.length <= 1 ? 0.5 : 1,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals & Notes */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    placeholder="Terms, conditions, or specific notes..."
                                    style={{
                                        width: '100%', background: 'var(--color-panel-2)',
                                        border: '1px solid var(--border-surface)',
                                        borderRadius: '8px', padding: '10px 12px',
                                        fontSize: '13px', color: 'var(--color-text)',
                                        outline: 'none', resize: 'vertical'
                                    }}
                                />
                            </div>
                            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Subtotal</span>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{formatCurrency(subtotal)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Discount</span>
                                    <input
                                        type="number"
                                        value={formData.discount_amount}
                                        onChange={e => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100px', height: '32px',
                                            background: 'var(--color-panel-2)',
                                            border: '1px solid var(--border-surface)',
                                            borderRadius: '6px', paddingLeft: '8px', paddingRight: '8px',
                                            fontSize: '13px', color: 'var(--color-text)',
                                            outline: 'none', textAlign: 'right'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Tax</span>
                                    <input
                                        type="number"
                                        value={formData.tax_amount}
                                        onChange={e => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100px', height: '32px',
                                            background: 'var(--color-panel-2)',
                                            border: '1px solid var(--border-surface)',
                                            borderRadius: '6px', paddingLeft: '8px', paddingRight: '8px',
                                            fontSize: '13px', color: 'var(--color-text)',
                                            outline: 'none', textAlign: 'right'
                                        }}
                                    />
                                </div>
                                <div style={{ padding: '14px', background: 'var(--purple)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Total</span>
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                height: '40px', padding: '0 16px', borderRadius: '8px',
                                border: '1px solid var(--border-surface)',
                                background: 'transparent', color: 'var(--color-muted)',
                                fontSize: '13px', fontWeight: 500, cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                height: '40px', padding: '0 20px', borderRadius: '8px',
                                border: 'none', background: 'var(--purple)', color: '#fff',
                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                            }}
                        >
                            Create Quotation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Quotations
