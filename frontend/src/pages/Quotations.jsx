import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

function Quotations() {
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedQuotation, setSelectedQuotation] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all') // all, draft, sent, accepted, rejected, converted

    useEffect(() => {
        loadQuotations()
    }, [statusFilter])

    const loadQuotations = async () => {
        try {
            setLoading(true)
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500))

            // Mock data
            const mockData = [
                {
                    id: 'QT001',
                    quote_number: 'QT-2025-001',
                    customer_name: 'ABC Traders',
                    customer_id: 'C001',
                    quote_date: '2025-01-15',
                    valid_until: '2025-02-15',
                    total_amount: 45000,
                    status: 'accepted',
                    items: [
                        { product_name: 'USB Cable', quantity: 100, unit_price: 150, line_total: 15000 },
                        { product_name: 'Wireless Mouse', quantity: 100, unit_price: 300, line_total: 30000 }
                    ]
                },
                {
                    id: 'QT002',
                    quote_number: 'QT-2025-002',
                    customer_name: 'XYZ Corporation',
                    customer_id: 'C002',
                    quote_date: '2025-01-16',
                    valid_until: '2025-02-16',
                    total_amount: 120000,
                    status: 'draft',
                    items: [
                        { product_name: 'T-Shirt', quantity: 500, unit_price: 400, line_total: 120000 }
                    ]
                },
                {
                    id: 'QT003',
                    quote_number: 'QT-2025-003',
                    customer_name: 'Retail Store Ltd',
                    customer_id: 'C003',
                    quote_date: '2025-01-10',
                    valid_until: '2025-01-30',
                    total_amount: 75000,
                    status: 'rejected',
                    items: [
                        { product_name: 'Rice', quantity: 300, unit_price: 250, line_total: 75000 }
                    ]
                }
            ]

            if (statusFilter !== 'all') {
                const filtered = mockData.filter(q => q.status === statusFilter)
                setQuotations(filtered)
            } else {
                setQuotations(mockData)
            }
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
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500))
            toast.success(`✓ Quotation ${quotation.quote_number} converted to Sale INV-2025-001`)

            // In real app, navigate to sales view
            // navigate('/sales/new', { state: { quotation } })
        } catch (error) {
            toast.error(`Failed to convert: ${error.message}`)
        }
    }

    const handleUpdateStatus = async (quotation, newStatus) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300))
            toast.success(`✓ Status updated to ${newStatus}`)
            loadQuotations()
        } catch (error) {
            toast.error(`Failed to update status`)
        }
    }

    const getStatusBadge = (status) => {
        const statusConfig = {
            draft: { bg: '#f5f5f5', color: '#666', icon: '📝' },
            sent: { bg: '#e3f2fd', color: '#1e3c72', icon: '📧' },
            accepted: { bg: '#e8f5e9', color: '#388e3c', icon: '✅' },
            rejected: { bg: '#ffebee', color: '#d32f2f', icon: '❌' },
            converted: { bg: '#fff3e0', color: '#f57c00', icon: '💰' }
        }
        const config = statusConfig[status] || statusConfig.draft
        return (
            <span
                style={{
                    background: config.bg,
                    color: config.color,
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
            >
                {config.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        )
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title">📋 Quotations</h1>
                <button className="btn btn-primary">+ New Quotation</button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {[
                    { value: 'all', label: 'All Quotations', count: quotations.length },
                    { value: 'draft', label: '📝 Draft', count: quotations.filter(q => q.status === 'draft').length },
                    { value: 'sent', label: '📧 Sent', count: quotations.filter(q => q.status === 'sent').length },
                    { value: 'accepted', label: '✅ Accepted', count: quotations.filter(q => q.status === 'accepted').length },
                    { value: 'rejected', label: '❌ Rejected', count: quotations.filter(q => q.status === 'rejected').length }
                ].map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        style={{
                            padding: '8px 16px',
                            border: statusFilter === tab.value ? '2px solid var(--color-accent)' : '1px solid #ddd',
                            background: statusFilter === tab.value ? '#f0f8ff' : 'white',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: statusFilter === tab.value ? 'bold' : 'normal'
                        }}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Quotations List */}
            <div className="card">
                {quotations.length === 0 ? (
                    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: '#999' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📋</div>
                        <p>No quotations found</p>
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Quote #</th>
                                <th>Customer</th>
                                <th>Date</th>
                                <th>Valid Until</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th>Items</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotations.map(quote => (
                                <tr key={quote.id} onClick={() => setSelectedQuotation(quote)} style={{ cursor: 'pointer' }}>
                                    <td className="font-mono" style={{ fontWeight: 'bold' }}>{quote.quote_number}</td>
                                    <td>{quote.customer_name}</td>
                                    <td>{format(new Date(quote.quote_date), 'dd/MM/yyyy')}</td>
                                    <td>
                                        {new Date(quote.valid_until) < new Date() ? (
                                            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                                                ⚠️ Expired
                                            </span>
                                        ) : (
                                            format(new Date(quote.valid_until), 'dd/MM/yyyy')
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(quote.total_amount)}</td>
                                    <td style={{ fontSize: '0.9rem', color: '#666' }}>{quote.items.length} items</td>
                                    <td>{getStatusBadge(quote.status)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {quote.status === 'accepted' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleConvertToSale(quote)
                                                    }}
                                                    className="btn btn-small"
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '0.75rem',
                                                        background: '#e8f5e9',
                                                        color: '#388e3c',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Convert to Sale"
                                                >
                                                    💰
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toast.success('📧 Quotation sent to customer')
                                                }}
                                                className="btn btn-small"
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '0.75rem',
                                                    background: '#e3f2fd',
                                                    color: '#1e3c72',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                                title="Send Email"
                                            >
                                                📧
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedQuotation(quote)
                                                    setShowModal(true)
                                                }}
                                                className="btn btn-small"
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '0.75rem',
                                                    background: '#fff3e0',
                                                    color: '#f57c00',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                                title="View Details"
                                            >
                                                👁️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
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
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="card"
                        style={{
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                                📋 {selectedQuotation.quote_number}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#999'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Customer</div>
                                <div style={{ fontWeight: 'bold' }}>{selectedQuotation.customer_name}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Amount</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e3c72' }}>
                                    {formatCurrency(selectedQuotation.total_amount)}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Date</div>
                                <div>{format(new Date(selectedQuotation.quote_date), 'dd MMM yyyy')}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Valid Until</div>
                                <div>{format(new Date(selectedQuotation.valid_until), 'dd MMM yyyy')}</div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid #eee' }}>
                            <h4 style={{ fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>Items</h4>
                            <table className="table" style={{ fontSize: '0.9rem' }}>
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th style={{ textAlign: 'center' }}>Qty</th>
                                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedQuotation.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.product_name}</td>
                                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                            <td style={{ textAlign: 'right' }}>Rs. {item.unit_price.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Rs. {item.line_total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            {selectedQuotation.status === 'draft' && (
                                <>
                                    <button
                                        onClick={() => {
                                            handleUpdateStatus(selectedQuotation, 'sent')
                                            setShowModal(false)
                                        }}
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                    >
                                        📧 Send to Customer
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleUpdateStatus(selectedQuotation, 'rejected')
                                            setShowModal(false)
                                        }}
                                        className="btn btn-secondary"
                                    >
                                        ❌ Reject
                                    </button>
                                </>
                            )}
                            {selectedQuotation.status === 'accepted' && (
                                <button
                                    onClick={() => {
                                        handleConvertToSale(selectedQuotation)
                                        setShowModal(false)
                                    }}
                                    className="btn btn-success"
                                    style={{ flex: 1 }}
                                >
                                    💰 Convert to Sale
                                </button>
                            )}
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-ghost"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Quotations
