import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { quotationsAPI, productsAPI, customersAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { 
    FileText, Plus, Search, X, Download, Eye, 
    Send, CheckCircle, XCircle, Clock, DollarSign,
    TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight,
    Mail, Copy, Pencil, Loader2
} from 'lucide-react'
import './Quotations.css'

const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`
const createInitialFormData = () => ({
    customer_id: '',
    quotation_date: format(new Date(), 'yyyy-MM-dd'),
    valid_until: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    items: [{ product_id: '', quantity: 1, unit_price: 0, line_discount: 0, tax_rate: 0 }],
    discount_amount: 0,
    discount_percentage: 0,
    tax_amount: 0,
    notes: ''
})

const canEditQuotation = (status) => ['draft', 'sent', 'accepted', 'rejected'].includes(status)
const RESPONSE_REMINDER_DAYS = 3

const toDateSafe = (value) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getDaysSince = (value) => {
    const dateValue = toDateSafe(value)
    if (!dateValue) return 0
    const diffMs = Date.now() - dateValue.getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

const isAwaitingResponse = (quotation) => {
    if (!quotation) return false
    return Boolean(quotation.email_sent_at) && !quotation.responded_at && !['accepted', 'rejected', 'converted'].includes(quotation.status)
}

const isReminderOverdue = (quotation) => isAwaitingResponse(quotation) && getDaysSince(quotation.email_sent_at) >= RESPONSE_REMINDER_DAYS

const formatOptionalDateTime = (value) => {
    const parsed = toDateSafe(value)
    if (!parsed) return '-'
    return format(parsed, 'dd MMM yyyy HH:mm')
}

const getFilenameFromDisposition = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = /filename="?([^";]+)"?/i.exec(contentDisposition)
    return match ? match[1] : null
}

const toDateInput = (value, fallbackDate = new Date()) => {
    const raw = value ? new Date(value) : fallbackDate
    return Number.isNaN(raw.getTime()) ? format(fallbackDate, 'yyyy-MM-dd') : format(raw, 'yyyy-MM-dd')
}

const mapQuotationToFormData = (quotation) => ({
    customer_id: String(quotation.customer_id || ''),
    quotation_date: toDateInput(quotation.quotation_date),
    valid_until: toDateInput(quotation.valid_until, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    items: (quotation.items || []).length > 0
        ? quotation.items.map((item) => ({
            product_id: String(item.product_id || ''),
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            line_discount: Number(item.line_discount || 0),
            tax_rate: Number(item.tax_rate || 0),
            line_total: Number(item.line_total || ((Number(item.quantity || 0) * Number(item.unit_price || 0)) - Number(item.line_discount || 0)))
        }))
        : [{ product_id: '', quantity: 1, unit_price: 0, line_discount: 0, tax_rate: 0 }],
    discount_amount: Number(quotation.discount_amount || 0),
    discount_percentage: 0,
    tax_amount: Number(quotation.tax_amount || 0),
    notes: quotation.notes || ''
})

const getQuotationSequence = (quotationNumber) => {
    const normalized = String(quotationNumber || '').trim()
    const match = normalized.match(/(\d+)(?!.*\d)/)
    if (!match) return Number.NaN
    return Number.parseInt(match[1], 10)
}

const sortQuotationsByNumber = (items = []) => {
    return [...items].sort((left, right) => {
        const leftSeq = getQuotationSequence(left.quotation_number)
        const rightSeq = getQuotationSequence(right.quotation_number)

        if (Number.isFinite(leftSeq) && Number.isFinite(rightSeq) && leftSeq !== rightSeq) {
            return rightSeq - leftSeq
        }

        const lexicalSort = String(right.quotation_number || '').localeCompare(
            String(left.quotation_number || ''),
            undefined,
            { numeric: true, sensitivity: 'base' }
        )

        if (lexicalSort !== 0) return lexicalSort

        const leftDate = toDateSafe(left.quotation_date)?.getTime() || 0
        const rightDate = toDateSafe(right.quotation_date)?.getTime() || 0
        return rightDate - leftDate
    })
}

function Quotations() {
    const navigate = useNavigate()
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedQuotation, setSelectedQuotation] = useState(null)
    const [loadingSelectedQuotation, setLoadingSelectedQuotation] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateRange, setDateRange] = useState({ from: '', to: '' })
    const [editingQuotationId, setEditingQuotationId] = useState(null)
    const [isSubmittingQuotation, setIsSubmittingQuotation] = useState(false)
    const [emailing, setEmailing] = useState(false)
    const [activeEmailQuotation, setActiveEmailQuotation] = useState(null)

    const [customers, setCustomers] = useState([])
    const [products, setProducts] = useState([])
    const [formData, setFormData] = useState(createInitialFormData())
    const [emailForm, setEmailForm] = useState({
        toEmail: '',
        subject: '',
        message: '',
        includePdf: true,
        tokenExpiryDays: ''
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
            setCustomers(custRes.data || [])
            setProducts(prodRes.data || [])
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
            setQuotations(sortQuotationsByNumber(response.data || []))
        } catch (error) {
            toast.error('Failed to load quotations')
        } finally {
            setLoading(false)
        }
    }

    const loadQuotationDetail = async (quotationId) => {
        const response = await quotationsAPI.get(quotationId)
        return response.data
    }

    const resetQuotationForm = () => {
        setEditingQuotationId(null)
        setFormData(createInitialFormData())
    }

    const openCreateQuotationModal = () => {
        resetQuotationForm()
        setShowCreateModal(true)
    }

    const openQuotationDetailModal = async (quotation) => {
        setShowModal(true)
        setSelectedQuotation(quotation)
        setLoadingSelectedQuotation(true)
        try {
            const detail = await loadQuotationDetail(quotation.id)
            setSelectedQuotation(detail)
        } catch (error) {
            toast.error(`Failed to load quotation: ${error.message}`)
        } finally {
            setLoadingSelectedQuotation(false)
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
            await loadQuotations()

            if (selectedQuotation?.id === quotation.id) {
                const detail = await loadQuotationDetail(quotation.id)
                setSelectedQuotation(detail)
            }
        } catch (error) {
            toast.error(`Failed to update status: ${error.message}`)
        }
    }

    const handleOpenEditQuotation = async (quotation) => {
        if (!canEditQuotation(quotation.status)) {
            toast.error('This quotation cannot be edited')
            return
        }

        try {
            const detail = await loadQuotationDetail(quotation.id)
            setEditingQuotationId(detail.id)
            setFormData(mapQuotationToFormData(detail))
            setShowCreateModal(true)
            setShowModal(false)
        } catch (error) {
            toast.error(`Failed to load quotation for editing: ${error.message}`)
        }
    }

    const handleDuplicateQuotation = async (quotation) => {
        try {
            const response = await quotationsAPI.duplicate(quotation.id)
            toast.success(`Duplicated as ${response.data.quotation_number}`)
            await loadQuotations()
        } catch (error) {
            toast.error(`Failed to duplicate quotation: ${error.message}`)
        }
    }

    const handleDownloadPdf = async (quotation) => {
        try {
            const response = await quotationsAPI.getPDF(quotation.id)
            const blob = new Blob([response.data], { type: 'application/pdf' })
            const filenameFromHeader = getFilenameFromDisposition(response.headers['content-disposition'])
            const fallbackName = `${quotation.quotation_number || 'quotation'}.pdf`

            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = filenameFromHeader || fallbackName
            link.click()
            URL.revokeObjectURL(link.href)
        } catch (error) {
            toast.error(`Failed to download PDF: ${error.message}`)
        }
    }

    const handleOpenEmailModal = async (quotation) => {
        try {
            const detail = await loadQuotationDetail(quotation.id)
            setActiveEmailQuotation(detail)
            setEmailForm({
                toEmail: detail.customer_email || '',
                subject: `Quotation ${detail.quotation_number}`,
                message: 'Please find your quotation attached. Let us know if you have any questions.',
                includePdf: true,
                tokenExpiryDays: ''
            })
            setShowEmailModal(true)
        } catch (error) {
            toast.error(`Failed to load quotation for email: ${error.message}`)
        }
    }

    const handleSendQuotationEmail = async (event) => {
        event.preventDefault()
        if (!activeEmailQuotation) return

        try {
            setEmailing(true)
            const emailPayload = {
                ...emailForm,
            }

            const normalizedTokenExpiry = String(emailForm.tokenExpiryDays || '').trim()
            if (normalizedTokenExpiry !== '') {
                const parsedDays = Number.parseInt(normalizedTokenExpiry, 10)
                if (!Number.isInteger(parsedDays) || parsedDays <= 0) {
                    toast.error('Token expiry days must be a positive number')
                    return
                }
                emailPayload.token_expiry_days = parsedDays
            }

            delete emailPayload.tokenExpiryDays

            await quotationsAPI.sendEmail(activeEmailQuotation.id, emailPayload)
            toast.success('Quotation email sent successfully')
            setShowEmailModal(false)
            setActiveEmailQuotation(null)

            if (selectedQuotation?.id === activeEmailQuotation.id) {
                const refreshed = await loadQuotationDetail(activeEmailQuotation.id)
                setSelectedQuotation(refreshed)
            }

            await loadQuotations()
        } catch (error) {
            toast.error(`Failed to send email: ${error.message}`)
        } finally {
            setEmailing(false)
        }
    }

    const handleSendReminder = async (quotation) => {
        try {
            await quotationsAPI.sendReminder(quotation.id, {
                toEmail: quotation.customer_email || undefined,
                includePdf: true,
            })
            toast.success('Reminder email sent')

            await loadQuotations()
            if (selectedQuotation?.id === quotation.id) {
                const refreshed = await loadQuotationDetail(quotation.id)
                setSelectedQuotation(refreshed)
            }
        } catch (error) {
            toast.error(`Failed to send reminder: ${error.message}`)
        }
    }

    const handleSubmitQuotationForm = async (e) => {
        e.preventDefault()

        try {
            setIsSubmittingQuotation(true)

            const subtotal = formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0)
            const totalAmount = (subtotal - Number(formData.discount_amount || 0)) + Number(formData.tax_amount || 0)

            const payload = {
                ...formData,
                subtotal,
                total_amount: totalAmount,
                items: formData.items.map((item) => ({
                    ...item,
                    quantity: Number(item.quantity || 0),
                    unit_price: Number(item.unit_price || 0),
                    line_discount: Number(item.line_discount || 0),
                    tax_rate: Number(item.tax_rate || 0),
                    line_total: Number(item.line_total || ((Number(item.quantity || 0) * Number(item.unit_price || 0)) - Number(item.line_discount || 0)))
                }))
            }

            if (editingQuotationId) {
                await quotationsAPI.update(editingQuotationId, payload)
                toast.success('Quotation updated successfully')

                if (selectedQuotation?.id === editingQuotationId) {
                    const refreshed = await loadQuotationDetail(editingQuotationId)
                    setSelectedQuotation(refreshed)
                }
            } else {
                await quotationsAPI.create(payload)
                toast.success('Quotation created successfully')
            }

            setShowCreateModal(false)
            resetQuotationForm()
            await loadQuotations()
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsSubmittingQuotation(false)
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

    const StatusBadge = ({ status }) => {
        const config = {
            draft: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'Draft', icon: FileText },
            sent: { bg: 'rgba(5, 153, 105, 0.15)', color: '#059669', label: 'Sent', icon: Send },
            accepted: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Accepted', icon: CheckCircle },
            rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Rejected', icon: XCircle },
            converted: { bg: 'rgba(8, 145, 178, 0.15)', color: '#0891B2', label: 'Converted', icon: DollarSign },
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

    const MetricCard = ({ label, value, icon: Icon, color, subtext, trend, index = 0 }) => (
        <div style={{
            background: 'var(--color-panel)',
            border: '1px solid var(--border-surface)',
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            minWidth: 0,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
            animationDelay: `${index * 70}ms`
        }}
        className="quote-ui-metric-card quote-ui-fade-up"
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
        }} className="quote-ui-page">
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }} className="quote-ui-page-header quote-ui-fade-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '10px',
                        background: 'rgba(8, 145, 178, 0.12)',
                        border: '1px solid rgba(8, 145, 178, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }} className="quote-ui-title-icon">
                        <FileText size={20} color="var(--purple)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Quotations</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Create and manage customer quotations</p>
                    </div>
                </div>

                <button
                    onClick={openCreateQuotationModal}
                    style={{
                        height: '38px', padding: '0 16px',
                        borderRadius: '8px', border: 'none',
                        background: 'var(--purple)', color: '#fff',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)'
                    }}
                    className="quote-ui-primary-btn"
                >
                    <Plus size={16} />
                    New Quotation
                </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }} className="quote-ui-metrics-row">
                <MetricCard
                    label="Total Value"
                    value={formatCurrency(totals.totalValue)}
                    icon={DollarSign}
                    color="#0891B2"
                    subtext="All quotations"
                    index={0}
                />
                <MetricCard
                    label="Accepted"
                    value={totals.accepted}
                    icon={CheckCircle}
                    color="#10b981"
                    subtext="Ready to convert"
                    trend={5}
                    index={1}
                />
                <MetricCard
                    label="Pending"
                    value={totals.pending}
                    icon={Clock}
                    color="#f59e0b"
                    subtext="Awaiting response"
                    index={2}
                />
                <MetricCard
                    label="Converted"
                    value={totals.converted}
                    icon={TrendingUp}
                    color="#059669"
                    subtext="To sales"
                    index={3}
                />
            </div>

            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--color-panel)',
                borderRadius: '12px', padding: '14px 16px',
                marginBottom: '16px', border: '1px solid var(--border-surface)'
            }} className="quote-ui-toolbar quote-ui-fade-up">
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
            }} className="quote-ui-table-wrap quote-ui-fade-up">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quote #</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valid Until</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response</th>
                            <th style={{ width: '220px', padding: '12px 16px' }}></th>
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
                                            <div style={{ width: '110px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ width: '60px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} />
                                        </td>
                                    </tr>
                                ))}
                            </>
                        ) : quotations.length === 0 ? (
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
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No quotations found</p>
                                            <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Create your first quotation to get started</p>
                                        </div>
                                        <button
                                            onClick={openCreateQuotationModal}
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
                            const awaitingResponse = isAwaitingResponse(quote)
                            const overdueReminder = isReminderOverdue(quote)
                            const baseRowBackground = overdueReminder ? 'rgba(245, 158, 11, 0.08)' : 'var(--color-panel)'

                            return (
                                <tr
                                    key={quote.id}
                                    className="quote-ui-table-row"
                                    style={{
                                        borderBottom: index < quotations.length - 1 ? '1px solid var(--border-light)' : 'none',
                                        background: baseRowBackground,
                                        transition: 'background 0.15s',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => openQuotationDetailModal(quote)}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = baseRowBackground}
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
                                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
                                        {quote.responded_at ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                                                <CheckCircle size={13} />
                                                {formatOptionalDateTime(quote.responded_at)}
                                            </span>
                                        ) : awaitingResponse ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: overdueReminder ? '#f59e0b' : '#059669' }}>
                                                <Clock size={13} />
                                                {overdueReminder ? `Awaiting (${getDaysSince(quote.email_sent_at)}d)` : 'Awaiting response'}
                                            </span>
                                        ) : quote.email_sent_at ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-hint)' }}>
                                                <Mail size={13} />
                                                Sent {formatOptionalDateTime(quote.email_sent_at)}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--color-hint)' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', opacity: 0.5, transition: 'opacity 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                        onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                                            {quote.status !== 'converted' && (
                                                <button
                                                    onClick={() => handleOpenEmailModal(quote)}
                                                    className="quote-ui-action-btn"
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'rgba(5, 153, 105, 0.1)', color: '#059669',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Send Email"
                                                >
                                                    <Mail size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDownloadPdf(quote)}
                                                className="quote-ui-action-btn"
                                                style={{
                                                    width: '30px', height: '30px', borderRadius: '6px',
                                                    border: '1px solid var(--border-surface)',
                                                    background: 'rgba(8, 145, 178, 0.12)', color: 'var(--purple)',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                                title="Download PDF"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicateQuotation(quote)}
                                                className="quote-ui-action-btn"
                                                style={{
                                                    width: '30px', height: '30px', borderRadius: '6px',
                                                    border: '1px solid var(--border-surface)',
                                                    background: 'transparent', color: 'var(--color-muted)',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                                title="Duplicate"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            {canEditQuotation(quote.status) && (
                                                <button
                                                    onClick={() => handleOpenEditQuotation(quote)}
                                                    className="quote-ui-action-btn"
                                                    style={{
                                                        width: '30px', height: '30px', borderRadius: '6px',
                                                        border: '1px solid var(--border-surface)',
                                                        background: 'transparent', color: 'var(--color-muted)',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                            )}
                                            {quote.status === 'accepted' && (
                                                <button
                                                    onClick={() => handleConvertToSale(quote)}
                                                    className="quote-ui-action-btn"
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
                                            <button
                                                onClick={() => openQuotationDetailModal(quote)}
                                                className="quote-ui-action-btn"
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
                    className="quote-ui-overlay"
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
                        className="quote-ui-modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: 'rgba(8, 145, 178, 0.12)',
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

                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Tracking</h4>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-panel-2)' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>Email Sent Count</div>
                                        <div style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 600 }}>{Number(selectedQuotation.email_sent_count || 0)}</div>
                                    </div>
                                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-panel-2)' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>Last Emailed To</div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>{selectedQuotation.last_emailed_to || '-'}</div>
                                    </div>
                                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-panel-2)' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>Link Expires</div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>{formatOptionalDateTime(selectedQuotation.token_expires_at)}</div>
                                    </div>
                                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-panel-2)' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>Responded At</div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>{formatOptionalDateTime(selectedQuotation.responded_at)}</div>
                                    </div>
                                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-panel-2)', gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>Response IP</div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>{selectedQuotation.response_ip || '-'}</div>
                                    </div>
                                </div>

                                {selectedQuotation.customer_response_notes && (
                                    <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                        <div style={{ fontSize: '11px', color: '#065f46', marginBottom: '4px', fontWeight: 600 }}>Customer Notes</div>
                                        <div style={{ fontSize: '13px', color: '#065f46', whiteSpace: 'pre-wrap' }}>{selectedQuotation.customer_response_notes}</div>
                                    </div>
                                )}

                                {isAwaitingResponse(selectedQuotation) && (
                                    <div style={{ marginTop: '10px', fontSize: '12px', color: isReminderOverdue(selectedQuotation) ? '#f59e0b' : '#059669' }}>
                                        Awaiting response for {getDaysSince(selectedQuotation.email_sent_at)} day(s).
                                    </div>
                                )}
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
                                        {loadingSelectedQuotation ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-hint)', fontSize: '13px' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                        <Loader2 size={14} />
                                                        Loading items...
                                                    </span>
                                                </td>
                                            </tr>
                                        ) : (selectedQuotation.items || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-hint)', fontSize: '13px' }}>
                                                    No items found for this quotation.
                                                </td>
                                            </tr>
                                        ) : (selectedQuotation.items || []).map((item, idx) => (
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
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {selectedQuotation.status !== 'converted' && (
                                <button
                                    onClick={() => handleOpenEmailModal(selectedQuotation)}
                                    style={{
                                        height: '40px', padding: '0 14px', borderRadius: '8px',
                                        border: 'none', background: '#059669', color: '#fff',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Mail size={14} /> Send Email
                                </button>
                            )}
                            {isAwaitingResponse(selectedQuotation) && (
                                <button
                                    onClick={() => handleSendReminder(selectedQuotation)}
                                    style={{
                                        height: '40px', padding: '0 14px', borderRadius: '8px',
                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                        background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Clock size={14} /> Send Reminder
                                </button>
                            )}
                            <button
                                onClick={() => handleDownloadPdf(selectedQuotation)}
                                style={{
                                    height: '40px', padding: '0 14px', borderRadius: '8px',
                                    border: '1px solid var(--border-surface)',
                                    background: 'transparent', color: 'var(--color-text)',
                                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Download size={14} /> PDF
                            </button>
                            <button
                                onClick={() => handleDuplicateQuotation(selectedQuotation)}
                                style={{
                                    height: '40px', padding: '0 14px', borderRadius: '8px',
                                    border: '1px solid var(--border-surface)',
                                    background: 'transparent', color: 'var(--color-text)',
                                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Copy size={14} /> Duplicate
                            </button>
                            {canEditQuotation(selectedQuotation.status) && (
                                <button
                                    onClick={() => handleOpenEditQuotation(selectedQuotation)}
                                    style={{
                                        height: '40px', padding: '0 14px', borderRadius: '8px',
                                        border: '1px solid var(--border-surface)',
                                        background: 'transparent', color: 'var(--color-text)',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                            )}
                            {selectedQuotation.status === 'draft' && (
                                <button
                                    onClick={() => { handleUpdateStatus(selectedQuotation, 'rejected'); setShowModal(false) }}
                                    style={{
                                        height: '40px', padding: '0 14px', borderRadius: '8px',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        background: 'transparent', color: '#ef4444',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <XCircle size={14} /> Reject
                                </button>
                            )}
                            {selectedQuotation.status === 'accepted' && (
                                <button
                                    onClick={() => { handleConvertToSale(selectedQuotation); setShowModal(false) }}
                                    style={{
                                        height: '40px', padding: '0 14px', borderRadius: '8px',
                                        border: 'none', background: '#10b981', color: '#fff',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
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

            <SendQuotationEmailModal
                show={showEmailModal}
                onClose={() => {
                    setShowEmailModal(false)
                    setActiveEmailQuotation(null)
                }}
                onSubmit={handleSendQuotationEmail}
                quotation={activeEmailQuotation}
                emailForm={emailForm}
                setEmailForm={setEmailForm}
                sending={emailing}
            />

            <CreateQuotationModal
                show={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false)
                    resetQuotationForm()
                }}
                title={editingQuotationId ? 'Edit Quotation' : 'Create New Quotation'}
                submitLabel={editingQuotationId ? 'Update Quotation' : 'Create Quotation'}
                submitting={isSubmittingQuotation}
                customers={customers}
                products={products}
                formData={formData}
                setFormData={setFormData}
                onAddItem={() => setFormData({ ...formData, items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0, line_discount: 0, tax_rate: 0 }] })}
                onRemoveItem={(idx) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })}
                onItemChange={(idx, field, value) => {
                    const newItems = [...formData.items]
                    newItems[idx][field] = value
                    if (field === 'product_id') {
                        const product = products.find(p => String(p.id) === String(value))
                        if (product) newItems[idx].unit_price = product.retail_price
                    }
                    setFormData({ ...formData, items: newItems })
                }}
                onSubmit={handleSubmitQuotationForm}
            />
        </div>
    )
}

function SendQuotationEmailModal({ show, onClose, onSubmit, quotation, emailForm, setEmailForm, sending }) {
    if (!show || !quotation) return null

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 1200, backdropFilter: 'blur(4px)'
            }}
            className="quote-ui-overlay"
            onClick={() => {
                if (!sending) onClose()
            }}
        >
            <div
                style={{
                    width: '92%', maxWidth: '560px',
                    background: 'var(--color-panel)', borderRadius: '14px',
                    border: '1px solid var(--border-surface)',
                    overflow: 'hidden'
                }}
                className="quote-ui-modal-card quote-ui-email-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-text)' }}>Send Quotation Email</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-hint)' }}>{quotation.quotation_number}</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={sending}
                        style={{
                            width: '30px', height: '30px', borderRadius: '8px',
                            border: '1px solid var(--border-surface)',
                            background: 'transparent', color: 'var(--color-muted)',
                            cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: sending ? 0.5 : 1
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {sending && (
                    <div className="quote-ui-mail-sending-banner" role="status" aria-live="polite">
                        <div className="quote-ui-mail-progress" />
                        <div className="quote-ui-mail-sending-text">
                            <Loader2 size={14} className="quote-ui-spin" />
                            Sending quotation email...
                        </div>
                    </div>
                )}

                <form onSubmit={onSubmit} aria-busy={sending}>
                    <div style={{ padding: '18px 20px', display: 'grid', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>To Email *</label>
                            <input
                                type="email"
                                value={emailForm.toEmail}
                                onChange={(e) => setEmailForm({ ...emailForm, toEmail: e.target.value })}
                                required
                                placeholder="customer@example.com"
                                style={{
                                    width: '100%', height: '38px',
                                    background: 'var(--color-panel-2)',
                                    border: '1px solid var(--border-surface)',
                                    borderRadius: '8px', padding: '0 10px',
                                    fontSize: '13px', color: 'var(--color-text)', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Subject *</label>
                            <input
                                type="text"
                                value={emailForm.subject}
                                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                                required
                                style={{
                                    width: '100%', height: '38px',
                                    background: 'var(--color-panel-2)',
                                    border: '1px solid var(--border-surface)',
                                    borderRadius: '8px', padding: '0 10px',
                                    fontSize: '13px', color: 'var(--color-text)', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Message (optional)</label>
                            <textarea
                                value={emailForm.message}
                                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                                rows={5}
                                style={{
                                    width: '100%',
                                    background: 'var(--color-panel-2)',
                                    border: '1px solid var(--border-surface)',
                                    borderRadius: '8px', padding: '10px',
                                    fontSize: '13px', color: 'var(--color-text)',
                                    outline: 'none', resize: 'vertical'
                                }}
                            />
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text)' }}>
                            <input
                                type="checkbox"
                                checked={Boolean(emailForm.includePdf)}
                                onChange={(e) => setEmailForm({ ...emailForm, includePdf: e.target.checked })}
                            />
                            Attach PDF quotation
                        </label>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                                Response Link Expiry (days, optional)
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={emailForm.tokenExpiryDays || ''}
                                onChange={(e) => setEmailForm({ ...emailForm, tokenExpiryDays: e.target.value })}
                                placeholder="Use quotation valid-until date by default"
                                style={{
                                    width: '100%', height: '38px',
                                    background: 'var(--color-panel-2)',
                                    border: '1px solid var(--border-surface)',
                                    borderRadius: '8px', padding: '0 10px',
                                    fontSize: '13px', color: 'var(--color-text)', outline: 'none'
                                }}
                            />
                        </div>

                    </div>

                    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={sending}
                            style={{
                                height: '38px', padding: '0 14px', borderRadius: '8px',
                                border: '1px solid var(--border-surface)', background: 'transparent',
                                color: 'var(--color-muted)', fontSize: '13px', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            style={{
                                height: '38px', padding: '0 14px', borderRadius: '8px',
                                border: 'none', background: '#059669', color: '#fff',
                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                opacity: sending ? 0.7 : 1
                            }}
                            className={sending ? 'quote-ui-sending-btn' : ''}
                        >
                            {sending ? <Loader2 size={14} className="quote-ui-spin" /> : <Send size={14} />}
                            {sending ? 'Sending Email...' : 'Send Email'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function CreateQuotationModal({
    show,
    onClose,
    customers,
    products,
    formData,
    setFormData,
    onAddItem,
    onRemoveItem,
    onItemChange,
    onSubmit,
    title,
    submitLabel,
    submitting
}) {
    const [productSearch, setProductSearch] = useState('')

    if (!show) return null

    const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const total = subtotal - formData.discount_amount + formData.tax_amount

    const normalizedProductSearch = productSearch.trim().toLowerCase()
    const filteredProducts = normalizedProductSearch
        ? products.filter((product) => {
            const name = String(product.name || '').toLowerCase()
            const code = String(product.code || '').toLowerCase()
            return name.includes(normalizedProductSearch) || code.includes(normalizedProductSearch)
        })
        : products

    const isSameId = (a, b) => String(a) === String(b)
    const getProductLabel = (product) => product.code ? `${product.name} (${product.code})` : product.name

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
                            background: 'rgba(8, 145, 178, 0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <FileText size={18} color="var(--purple)" />
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{title}</h2>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ position: 'relative', width: '220px' }}>
                                        <Search
                                            size={14}
                                            style={{
                                                position: 'absolute',
                                                left: '10px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: 'var(--color-hint)'
                                            }}
                                        />
                                        <input
                                            type="text"
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            placeholder="Search product..."
                                            style={{
                                                width: '100%',
                                                height: '32px',
                                                background: 'var(--color-panel)',
                                                border: '1px solid var(--border-surface)',
                                                borderRadius: '6px',
                                                paddingLeft: '32px',
                                                paddingRight: '10px',
                                                fontSize: '12px',
                                                color: 'var(--color-text)',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

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
                            </div>

                            {productSearch && filteredProducts.length === 0 && (
                                <div style={{
                                    marginBottom: '10px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    color: '#f59e0b',
                                    fontSize: '12px'
                                }}>
                                    No products match "{productSearch}".
                                </div>
                            )}

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
                                                    <option value="">{productSearch ? 'Select from filtered...' : 'Select...'}</option>
                                                    {item.product_id && !filteredProducts.some((p) => isSameId(p.id, item.product_id)) && (
                                                        <option value={item.product_id}>
                                                            {getProductLabel(products.find((p) => isSameId(p.id, item.product_id)) || { name: 'Selected product' })}
                                                        </option>
                                                    )}
                                                    {filteredProducts.map((p) => (
                                                        <option key={p.id} value={p.id}>{getProductLabel(p)}</option>
                                                    ))}
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
                            disabled={submitting}
                            style={{
                                height: '40px', padding: '0 20px', borderRadius: '8px',
                                border: 'none', background: 'var(--purple)', color: '#fff',
                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)',
                                opacity: submitting ? 0.7 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {submitting && <Loader2 size={14} />}
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Quotations
