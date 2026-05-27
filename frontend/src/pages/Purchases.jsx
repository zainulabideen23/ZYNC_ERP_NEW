import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { purchasesAPI } from '../services/api'
import { format } from 'date-fns'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'
import { toast } from 'react-hot-toast'
import { 
    ShoppingBag, Plus, Search, X, Download, Printer, 
    RotateCcw, FileText, DollarSign, Banknote, AlertCircle,
    ArrowUpRight, ArrowDownRight, Eye, Pencil, Ban
} from 'lucide-react'

function Purchases() {
    const navigate = useNavigate()
    const [purchases, setPurchases] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedPurchase, setSelectedPurchase] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [returnItems, setReturnItems] = useState([])
    const [filters, setFilters] = useState({ search: '', status: '', from_date: '', to_date: '' })
    const [sortConfig, setSortConfig] = useState({ sort_by: 'purchase_date', sort_order: 'desc' })
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 })
    const [summary, setSummary] = useState({ total_bills: 0, total_amount: 0, total_paid: 0, total_outstanding: 0 })
    const [errorMessage, setErrorMessage] = useState('')
    const [returnReason, setReturnReason] = useState('')
    const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0])
    const [isProcessingReturn, setIsProcessingReturn] = useState(false)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            const response = await purchasesAPI.list({
                ...filters,
                ...sortConfig,
                page: pagination.page,
                limit: pagination.limit,
            })

            setPurchases(response.data || [])
            setSummary(response.summary || {
                total_bills: 0,
                total_amount: 0,
                total_paid: 0,
                total_outstanding: 0,
            })

            if (response.pagination) {
                setPagination((prev) => ({
                    ...prev,
                    page: Number(response.pagination.page || prev.page),
                    limit: Number(response.pagination.limit || prev.limit),
                    total: Number(response.pagination.total || 0),
                    pages: Number(response.pagination.pages || 1),
                }))
            }
        } catch (error) {
            console.error('Failed to load purchases:', error)
            setErrorMessage(error.message || 'Failed to load purchases')
            setPurchases([])
        } finally {
            setLoading(false)
        }
    }, [filters, sortConfig, pagination.page, pagination.limit])

    useEffect(() => {
        loadData()
    }, [loadData])

    useDataSync(DataSyncEvents.PURCHASE_CREATED, loadData)
    useDataSync(DataSyncEvents.PURCHASE_UPDATED, loadData)

    const filteredPurchases = purchases

    const aggregates = useMemo(() => {
        return {
            total: Number(summary.total_amount || 0),
            paid: Number(summary.total_paid || 0),
            outstanding: Number(summary.total_outstanding || 0),
            bills: Number(summary.total_bills || 0),
        }
    }, [summary])

    const updateFilters = (patch) => {
        setPagination((prev) => ({ ...prev, page: 1 }))
        setFilters((prev) => ({ ...prev, ...patch }))
    }

    const handleSort = (column) => {
        setPagination((prev) => ({ ...prev, page: 1 }))
        setSortConfig((prev) => {
            if (prev.sort_by === column) {
                return {
                    sort_by: column,
                    sort_order: prev.sort_order === 'asc' ? 'desc' : 'asc',
                }
            }

            return {
                sort_by: column,
                sort_order: 'desc',
            }
        })
    }

    const renderSortIndicator = (column) => {
        if (sortConfig.sort_by !== column) return null
        return sortConfig.sort_order === 'asc' ? '↑' : '↓'
    }

    const handleViewPurchase = async (purchase) => {
        if (purchase.status === 'draft') {
            navigate(`/purchases/new?draftId=${purchase.id}`)
            return
        }

        try {
            const res = await purchasesAPI.get(purchase.id)
            if (!res.data || !res.data.items) return
            setSelectedPurchase(res.data)
            setReturnItems((res.data.items || []).map(item => ({
                purchase_item_id: item.id,
                product_id: item.product_id,
                name: item.product_name,
                quantity: 0,
                max_quantity: Number(item.returnable_quantity ?? item.quantity ?? 0),
                purchased_quantity: Number(item.quantity || 0),
                returned_quantity: Number(item.returned_quantity || 0),
                unit_cost: item.unit_cost,
                alreadyReturned: Number(item.returned_quantity || 0)
            })))
            setReturnReason('')
            setReturnDate(new Date().toISOString().split('T')[0])
            setShowModal(true)
        } catch (error) {
            console.error('Failed to load purchase details:', error)
            toast.error(error.message || 'Failed to load purchase details')
        }
    }

    const handleEditDraft = (purchase) => {
        navigate(`/purchases/new?draftId=${purchase.id}`)
    }

    const handleCancelDraft = async (purchase) => {
        if (purchase.status !== 'draft') return

        const shouldCancel = window.confirm(`Cancel draft ${purchase.bill_number}?`)
        if (!shouldCancel) return

        try {
            await purchasesAPI.cancelDraft(purchase.id, {
                reason: 'Cancelled from purchase list',
            })
            toast.success(`Draft ${purchase.bill_number} cancelled`)
            loadData()
        } catch (error) {
            toast.error(error.message || 'Failed to cancel draft purchase')
        }
    }

    const handleReturn = async () => {
        if (isProcessingReturn) return

        const itemsToReturn = returnItems.filter(item => item.quantity > 0)
        if (itemsToReturn.length === 0) return

        const shouldReturn = window.confirm(
            `Process return for ${itemsToReturn.length} items? This action cannot be undone.`
        )
        if (!shouldReturn) return

        const normalizedReason = returnReason.trim()
        if (normalizedReason.length < 3) {
            toast.error('Please provide a return reason')
            return
        }

        try {
            setIsProcessingReturn(true)
            await purchasesAPI.createReturn(selectedPurchase.id, {
                items: itemsToReturn.map(item => ({
                    purchase_item_id: item.purchase_item_id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                })),
                return_date: returnDate,
                reason: normalizedReason,
                notes: `Reason: ${normalizedReason}\nReturn for ${selectedPurchase.bill_number}`
            })
            setShowModal(false)
            toast.success('Purchase return processed successfully')
            loadData()
        } catch (error) {
            console.error(error.message)
            toast.error(error.message || 'Failed to process return')
        } finally {
            setIsProcessingReturn(false)
        }
    }

    const handleExportCSV = () => {
        if (filteredPurchases.length === 0) return
        const headers = ['Bill #', 'Date', 'Supplier', 'Total', 'Paid', 'Balance', 'Status']
        const rows = filteredPurchases.map(p => [
            p.bill_number,
            format(new Date(p.purchase_date), 'yyyy-MM-dd'),
            p.supplier_name || 'Unknown',
            p.total_amount,
            p.amount_paid,
            (p.total_amount - (p.amount_paid || 0)).toString(),
            p.status
        ])
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `purchases_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
        link.click()
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const handlePrint = async (purchaseSummary = selectedPurchase) => {
        if (!purchaseSummary) return
        let purchaseToPrint = purchaseSummary
        if (!purchaseSummary.items || purchaseSummary.items.length === 0) {
            try {
                const res = await purchasesAPI.get(purchaseSummary.id)
                purchaseToPrint = res.data
            } catch (error) {
                console.error('Failed to load purchase details for printing:', error)
                return
            }
        }
        const iframe = document.createElement('iframe')
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;'
        document.body.appendChild(iframe)
        const doc = iframe.contentWindow.document
        doc.open()
        doc.write(`<!DOCTYPE html><html><head><title>Purchase Bill ${purchaseToPrint.bill_number}</title><style>
            *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:40px;max-width:800px;margin:0 auto}
            .header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #10b981}
            .brand{font-size:28px;font-weight:700;color:#10b981}.meta{color:#64748b;font-size:12px}
            .billing{display:flex;justify-content:space-between;margin-bottom:30px;gap:40px}
            .box{flex:1;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #10b981}
            .box h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px}
            table{width:100%;border-collapse:collapse;margin-bottom:30px}th{background:#10b981;padding:12px 14px;text-align:left;font-weight:600;color:#fff;font-size:11px;text-transform:uppercase}
            td{padding:14px;border-bottom:1px solid #e2e8f0;font-size:14px}.text-right{text-align:right}.text-center{text-align:center}
            .totals{background:#f8fafc;border-radius:8px;padding:20px;margin-top:20px}.row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}
            .row.total{font-size:18px;font-weight:700;border-top:2px solid #10b981;margin-top:10px;padding-top:12px}
        </style></head><body>
            <div class="header"><div><div class="brand">ZYNC ERP</div><div class="meta">Purchase Bill</div></div><div style="text-align:right"><div class="meta">Bill #</div><div style="font-weight:600">${purchaseToPrint.bill_number}</div></div></div>
            <div class="billing">
                <div class="box"><h3>Supplier</h3><div style="font-weight:600">${purchaseToPrint.supplier_name || 'Unknown'}</div></div>
                <div class="box"><h3>Date</h3><div style="font-weight:600">${format(new Date(purchaseToPrint.purchase_date || purchaseToPrint.created_at), 'dd MMM yyyy')}</div></div>
                <div class="box"><h3>Status</h3><div style="font-weight:600;text-transform:uppercase">${purchaseToPrint.status}</div></div>
            </div>
            <table><thead><tr><th>#</th><th>Product</th><th class="text-center">Qty</th><th class="text-right">Unit Cost</th><th class="text-right">Total</th></tr></thead><tbody>
                ${(purchaseToPrint.items || []).map((item, i) => `<tr><td class="text-center">${i+1}</td><td>${item.product_name || item.name}</td><td class="text-center">${item.quantity}</td><td class="text-right">Rs. ${Number(item.unit_cost).toLocaleString()}</td><td class="text-right"><strong>Rs. ${(item.quantity * item.unit_cost).toLocaleString()}</strong></td></tr>`).join('')}
            </tbody></table>
            <div class="totals"><div class="row"><span>Total Amount</span><span>Rs. ${Number(purchaseToPrint.total_amount).toLocaleString()}</span></div><div class="row"><span>Paid Amount</span><span>Rs. ${Number(purchaseToPrint.amount_paid || 0).toLocaleString()}</span></div><div class="row total"><span>Balance Due</span><span>Rs. ${(purchaseToPrint.total_amount - (purchaseToPrint.amount_paid || 0)).toLocaleString()}</span></div></div>
        </body></html>`)
        doc.close()
        iframe.contentWindow.focus()
        setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000) }, 500)
    }

    const StatusBadge = ({ status }) => {
        const config = {
            paid: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Paid' },
            billed: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Billed' },
            draft: { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', label: 'Draft' },
            cancelled: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Cancelled' },
            returned: { bg: 'rgba(8, 145, 178, 0.15)', color: '#0891B2', label: 'Returned' }
        }
        const s = config[status] || { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: status || 'N/A' }
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
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{subtext}</span>
                {trend !== undefined && (
                    <span style={{ fontSize: '11px', fontWeight: 500, color: trend >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
        </div>
    )

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <ShoppingBag size={20} color="var(--green)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Purchases</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Track supplier bills and inventory purchases</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/purchases/new')}
                    style={{
                        height: '38px', padding: '0 16px',
                        borderRadius: '8px', border: 'none',
                        background: '#10b981', color: '#fff',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                >
                    <Plus size={16} />
                    New Purchase
                </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard
                    label="Total Purchases"
                    value={formatCurrency(aggregates.total)}
                    icon={DollarSign}
                    color="#10b981"
                    subtext="All time"
                />
                <MetricCard
                    label="Bills"
                    value={aggregates.bills}
                    icon={FileText}
                    color="#0891B2"
                    subtext="Total bills"
                />
                <MetricCard
                    label="Paid"
                    value={formatCurrency(aggregates.paid)}
                    icon={Banknote}
                    color="#059669"
                    subtext="Settled"
                />
                <MetricCard
                    label="Outstanding"
                    value={formatCurrency(aggregates.outstanding)}
                    icon={AlertCircle}
                    color="#f59e0b"
                    subtext="Due"
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
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                    <input
                        type="text"
                        placeholder="Search bills or suppliers..."
                        value={filters.search}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                        style={{
                            width: '100%', height: '36px',
                            background: 'var(--color-panel-2)',
                            border: '1px solid var(--border-surface)',
                            borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px',
                            fontSize: '13px', color: 'var(--color-text)',
                            outline: 'none'
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--green)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={(e) => updateFilters({ status: e.target.value })}
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
                    <option value="billed">Billed</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                </select>

                {/* Date Range */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                        type="date"
                        value={filters.from_date}
                        onChange={(e) => updateFilters({ from_date: e.target.value })}
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
                        onChange={(e) => updateFilters({ to_date: e.target.value })}
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
                        onClick={() => {
                            setPagination((prev) => ({ ...prev, page: 1 }))
                            setFilters({ search: '', status: '', from_date: '', to_date: '' })
                        }}
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

            {errorMessage && (
                <div style={{
                    marginBottom: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    fontSize: '13px',
                }}>
                    {errorMessage}
                </div>
            )}

            {/* Table */}
            <div style={{
                background: 'var(--color-panel)',
                borderRadius: '12px', border: '1px solid var(--border-surface)',
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th
                                onClick={() => handleSort('bill_number')}
                                style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                            >
                                Bill # {renderSortIndicator('bill_number')}
                            </th>
                            <th
                                onClick={() => handleSort('purchase_date')}
                                style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                            >
                                Date {renderSortIndicator('purchase_date')}
                            </th>
                            <th
                                onClick={() => handleSort('supplier_name')}
                                style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                            >
                                Supplier {renderSortIndicator('supplier_name')}
                            </th>
                            <th
                                onClick={() => handleSort('total_amount')}
                                style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                            >
                                Total {renderSortIndicator('total_amount')}
                            </th>
                            <th
                                onClick={() => handleSort('amount_paid')}
                                style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                            >
                                Paid {renderSortIndicator('amount_paid')}
                            </th>
                            <th
                                onClick={() => handleSort('status')}
                                style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                            >
                                Status {renderSortIndicator('status')}
                            </th>
                            <th style={{ width: '100px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && filteredPurchases.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
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
                                            <div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} />
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
                        ) : filteredPurchases.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '16px',
                                            background: 'var(--color-panel-2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <ShoppingBag size={24} color="var(--color-hint)" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No purchases found</p>
                                            <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Try changing your filters or create a new purchase</p>
                                        </div>
                                        <button
                                            onClick={() => navigate('/purchases/new')}
                                            style={{
                                                marginTop: '8px', padding: '8px 16px',
                                                borderRadius: '8px', border: 'none',
                                                background: '#10b981', color: '#fff',
                                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <Plus size={14} /> New Purchase
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredPurchases.map((purchase, index) => (
                            <tr
                                key={purchase.id}
                                style={{
                                    borderBottom: index < filteredPurchases.length - 1 ? '1px solid var(--border-light)' : 'none',
                                    background: 'var(--color-panel)',
                                    transition: 'background 0.15s',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    if (purchase.status === 'draft') {
                                        handleEditDraft(purchase)
                                        return
                                    }
                                    handleViewPurchase(purchase)
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}
                            >
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--green)' }}>
                                        {purchase.bill_number}
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                    {format(new Date(purchase.purchase_date), 'dd MMM yyyy')}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '6px',
                                            background: 'var(--color-panel-2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)'
                                        }}>
                                            {(purchase.supplier_name || 'SU').charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                                            {purchase.supplier_name || 'Unknown'}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                                    {formatCurrency(purchase.total_amount)}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: '#059669' }}>
                                    {formatCurrency(purchase.amount_paid)}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <StatusBadge status={purchase.status} />
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', opacity: 0.5, transition: 'opacity 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                                        {purchase.status === 'draft' ? (
                                            <>
                                                <button
                                                    onClick={() => handleEditDraft(purchase)}
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'transparent', color: 'var(--color-muted)',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Edit Draft"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleCancelDraft(purchase)}
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                                        background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Cancel Draft"
                                                >
                                                    <Ban size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handlePrint(purchase)}
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'transparent', color: 'var(--color-muted)',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Print Bill"
                                                >
                                                    <Printer size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewPurchase(purchase)}
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'transparent', color: 'var(--color-muted)',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="View & Return"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </>
                                        )}
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
                        {pagination.total > 0
                            ? `Showing ${Math.max(1, ((pagination.page - 1) * pagination.limit) + 1)}-${Math.min(pagination.total, ((pagination.page - 1) * pagination.limit) + filteredPurchases.length)} of ${pagination.total}`
                            : 'No results'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                            value={pagination.limit}
                            onChange={(e) => {
                                const nextLimit = Number(e.target.value)
                                setPagination((prev) => ({ ...prev, page: 1, limit: nextLimit }))
                            }}
                            style={{
                                height: '30px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-surface)',
                                background: 'var(--color-panel)',
                                color: 'var(--color-muted)',
                                fontSize: '12px',
                                padding: '0 8px',
                            }}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>

                        <button
                            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                            disabled={pagination.page <= 1 || loading}
                            style={{
                                height: '30px', padding: '0 10px',
                                borderRadius: '6px', border: '1px solid var(--border-surface)',
                                background: 'transparent', color: 'var(--color-muted)',
                                fontSize: '12px', cursor: pagination.page <= 1 || loading ? 'not-allowed' : 'pointer',
                                opacity: pagination.page <= 1 || loading ? 0.5 : 1,
                            }}
                        >
                            Prev
                        </button>

                        <span style={{ fontSize: '12px', color: 'var(--color-hint)', minWidth: '70px', textAlign: 'center' }}>
                            Page {pagination.page} / {Math.max(1, pagination.pages)}
                        </span>

                        <button
                            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(Math.max(1, prev.pages), prev.page + 1) }))}
                            disabled={pagination.page >= Math.max(1, pagination.pages) || loading}
                            style={{
                                height: '30px', padding: '0 10px',
                                borderRadius: '6px', border: '1px solid var(--border-surface)',
                                background: 'transparent', color: 'var(--color-muted)',
                                fontSize: '12px', cursor: pagination.page >= Math.max(1, pagination.pages) || loading ? 'not-allowed' : 'pointer',
                                opacity: pagination.page >= Math.max(1, pagination.pages) || loading ? 0.5 : 1,
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* View & Return Modal */}
            {showModal && selectedPurchase && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.6)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: 'var(--color-panel)', borderRadius: '16px',
                            width: '90%', maxWidth: '800px', maxHeight: '85vh',
                            overflowY: 'auto', border: '1px solid var(--border-surface)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: 'rgba(16, 185, 129, 0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <ShoppingBag size={18} color="var(--green)" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                                            Purchase Details - {selectedPurchase.bill_number}
                                        </h2>
                                        <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: '2px 0 0 0' }}>
                                            {format(new Date(selectedPurchase.purchase_date || selectedPurchase.created_at), 'dd MMM yyyy')}
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
                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supplier</div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{selectedPurchase.supplier_name || 'Unknown'}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(selectedPurchase.total_amount)}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid</div>
                                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#059669' }}>{formatCurrency(selectedPurchase.amount_paid || 0)}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--color-panel-2)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
                                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#f59e0b' }}>{formatCurrency(selectedPurchase.total_amount - (selectedPurchase.amount_paid || 0))}</div>
                                </div>
                            </div>

                            {/* Items & Returns */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items & Returns</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-panel-2)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                                            <th style={{ width: '130px', padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Returned</th>
                                            <th style={{ width: '100px', padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Returnable</th>
                                            <th style={{ width: '190px', padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return Qty</th>
                                            <th style={{ width: '120px', padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnItems.map((item, idx) => (
                                            <tr
                                                key={item.purchase_item_id || `${item.product_id}-${idx}`}
                                                title={item.alreadyReturned > 0 ? `Previously returned: ${item.alreadyReturned} units` : ''}
                                                style={{ borderBottom: idx < returnItems.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                                            >
                                                <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        <span>{item.name}</span>
                                                        {item.alreadyReturned > 0 && (
                                                            <span style={{ fontSize: '11px', color: '#f59e0b' }}>Has prior returns</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--color-hint)' }}>
                                                    {item.returned_quantity}/{item.max_quantity} returned
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-dim)' }}>{item.max_quantity}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.max_quantity}
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const newItems = [...returnItems]
                                                                const parsed = parseInt(e.target.value) || 0
                                                                newItems[idx].quantity = Math.min(item.max_quantity, Math.max(0, parsed))
                                                                setReturnItems(newItems)
                                                            }}
                                                            style={{
                                                                width: '80px', height: '32px',
                                                                background: 'var(--color-panel)',
                                                                border: item.quantity > item.max_quantity ? '1px solid #ef4444' : '1px solid var(--border-surface)',
                                                                borderRadius: '6px', paddingLeft: '10px', paddingRight: '10px',
                                                                fontSize: '13px', color: 'var(--color-text)',
                                                                outline: 'none', textAlign: 'center'
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newItems = [...returnItems]
                                                                newItems[idx].quantity = item.max_quantity
                                                                setReturnItems(newItems)
                                                            }}
                                                            disabled={item.max_quantity <= 0}
                                                            style={{
                                                                height: '32px',
                                                                padding: '0 10px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--border-surface)',
                                                                background: 'var(--color-panel)',
                                                                color: 'var(--color-muted)',
                                                                fontSize: '12px',
                                                                cursor: item.max_quantity <= 0 ? 'not-allowed' : 'pointer',
                                                                opacity: item.max_quantity <= 0 ? 0.6 : 1,
                                                            }}
                                                            title="Set return quantity to maximum returnable"
                                                        >
                                                            Return All
                                                        </button>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 500, color: 'var(--green)' }}>{formatCurrency(item.unit_cost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginBottom: '18px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return Date</h4>
                                <input
                                    type="date"
                                    value={returnDate}
                                    onChange={(e) => setReturnDate(e.target.value)}
                                    style={{
                                        height: '38px',
                                        minWidth: '220px',
                                        background: 'var(--color-panel-2)',
                                        border: '1px solid var(--border-surface)',
                                        borderRadius: '8px',
                                        paddingLeft: '10px',
                                        paddingRight: '10px',
                                        fontSize: '13px',
                                        color: 'var(--color-text)',
                                        outline: 'none',
                                        colorScheme: 'dark',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '18px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return Reason</h4>
                                <textarea
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                    placeholder="Why are these items being returned?"
                                    maxLength={500}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        background: 'var(--color-panel-2)',
                                        border: '1px solid var(--border-surface)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        color: 'var(--color-text)',
                                        fontSize: '13px',
                                        outline: 'none',
                                    }}
                                />
                                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-hint)', textAlign: 'right' }}>
                                    {returnReason.length}/500
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={handleReturn}
                                    disabled={!returnItems.some(i => i.quantity > 0) || isProcessingReturn}
                                    style={{
                                        height: '40px', padding: '0 16px',
                                        borderRadius: '8px', border: 'none',
                                        background: returnItems.some(i => i.quantity > 0) && !isProcessingReturn ? '#ef4444' : 'var(--color-panel-2)',
                                        color: returnItems.some(i => i.quantity > 0) && !isProcessingReturn ? '#fff' : 'var(--color-muted)',
                                        fontSize: '13px', fontWeight: 500, cursor: returnItems.some(i => i.quantity > 0) && !isProcessingReturn ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <RotateCcw size={14} />
                                    {isProcessingReturn ? 'Processing Return...' : 'Process Return'}
                                </button>
                                <button
                                    onClick={() => handlePrint(selectedPurchase)}
                                    style={{
                                        height: '40px', padding: '0 16px',
                                        borderRadius: '8px', border: '1px solid var(--border-surface)',
                                        background: 'transparent', color: 'var(--color-muted)',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Printer size={14} />
                                    Print Bill
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        height: '40px', padding: '0 16px',
                                        borderRadius: '8px', border: '1px solid var(--border-surface)',
                                        background: 'transparent', color: 'var(--color-muted)',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Purchases
