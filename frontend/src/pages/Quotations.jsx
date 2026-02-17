import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { quotationsAPI, productsAPI, customersAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'

function Quotations() {
    const navigate = useNavigate()
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedQuotation, setSelectedQuotation] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')

    // New Quotation Form State
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
    }, [statusFilter])

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
            const response = await quotationsAPI.list({ status: statusFilter })
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
            toast.success(`✓ Quotation marked as converted`)
            navigate('/sales/new', { state: { quotationId: quotation.id } })
        } catch (error) {
            toast.error(`Failed to convert: ${error.message}`)
        }
    }

    const handleUpdateStatus = async (quotation, newStatus) => {
        try {
            await quotationsAPI.updateStatus(quotation.id, newStatus)
            toast.success(`✓ Status updated to ${newStatus}`)
            loadQuotations()
        } catch (error) {
            toast.error(`Failed to update status: ${error.message}`)
        }
    }

    const getStatusBadge = (status) => {
        const statusConfig = {
            draft: { bg: '#f5f5f5', color: '#666', icon: '📝' },
            sent: { bg: '#e3f2fd', color: '#1e3c72', icon: '📧' },
            accepted: { bg: '#e8f5e9', color: '#388e3c', icon: '✅' },
            rejected: { bg: '#ffebee', color: '#d32f2f', icon: '❌' },
            converted: { bg: '#fff3e0', color: '#f57c00', icon: '💰' },
            expired: { bg: '#fafafa', color: '#9e9e9e', icon: '⏰' }
        }
        const config = statusConfig[status] || statusConfig.draft
        return (
            <span
                style={{
                    background: config.bg,
                    color: config.color,
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
            >
                {config.icon} {status.toUpperCase()}
            </span>
        )
    }

    const handleCreateSubmit = async (e) => {
        e.preventDefault()
        try {
            // Calculate totals before sending
            const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const totalAmount = (subtotal - formData.discount_amount) + formData.tax_amount;

            await quotationsAPI.create({
                ...formData,
                subtotal,
                total_amount: totalAmount
            })
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
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items]
        newItems[index][field] = value
        if (field === 'product_id') {
            const product = products.find(p => p.id === value)
            if (product) newItems[index].unit_price = product.retail_price
        }
        setFormData({ ...formData, items: newItems })
    }

    const handleAddItem = () => {
        setFormData({ ...formData, items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0 }] })
    }

    const handleRemoveItem = (index) => {
        setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })
    }

    const setViewingQuote = async (id) => {
        try {
            const res = await quotationsAPI.get(id)
            setSelectedQuotation(res.data)
            setShowModal(true)
        } catch (error) {
            toast.error('Failed to load quotation details')
        }
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title">📋 Quotations</h1>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New Quotation</button>
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
                                <tr key={quote.id} onClick={() => {
                                    setViewingQuote(quote.id)
                                }} style={{ cursor: 'pointer' }}>
                                    <td className="font-mono" style={{ fontWeight: 'bold' }}>{quote.quotation_number}</td>
                                    <td>{quote.customer_name}</td>
                                    <td>{format(new Date(quote.quotation_date), 'dd/MM/yyyy')}</td>
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
                                    <td style={{ fontSize: '0.9rem', color: '#666' }}>{quote.items ? quote.items.length : 0} items</td>
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
                                📋 {selectedQuotation.quotation_number}
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
                                <div>{format(new Date(selectedQuotation.quotation_date), 'dd MMM yyyy')}</div>
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

            <CreateQuotationModal
                show={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                customers={customers}
                products={products}
                formData={formData}
                setFormData={setFormData}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                onItemChange={handleItemChange}
                onSubmit={handleCreateSubmit}
            />

            <style>{`
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; padding: 28px; width: 95%; max-height: 90vh; overflow-y: auto; }
                .bg-tertiary { background: var(--color-bg-tertiary); }
            `}</style>
        </div>
    )
}

function CreateQuotationModal({ show, onClose, customers, products, formData, setFormData, onAddItem, onRemoveItem, onItemChange, onSubmit }) {
    if (!show) return null;

    const total = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2>Create New Quotation</h2>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={onSubmit}>
                    <div className="grid grid-2 mb-6" style={{ gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Customer *</label>
                            <select className="form-select" value={formData.customer_id} onChange={e => setFormData({ ...formData, customer_id: e.target.value })} required>
                                <option value="">Select Customer...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-2" style={{ gap: 'var(--space-2)' }}>
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input type="date" className="form-input" value={formData.quotation_date} onChange={e => setFormData({ ...formData, quotation_date: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Valid Until</label>
                                <input type="date" className="form-input" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="table-container mb-4">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th style={{ width: '80px' }}>Qty</th>
                                    <th style={{ width: '120px' }}>Price</th>
                                    <th style={{ width: '100px' }}>Disc %</th>
                                    <th style={{ width: '150px' }}>Total</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <select className="form-select" value={item.product_id} onChange={e => onItemChange(idx, 'product_id', e.target.value)} required>
                                                <option value="">Select Product...</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <input type="number" className="form-input" value={item.quantity} onChange={e => onItemChange(idx, 'quantity', e.target.value)} min="1" required />
                                        </td>
                                        <td>
                                            <input type="number" className="form-input" value={item.unit_price} onChange={e => onItemChange(idx, 'unit_price', e.target.value)} required />
                                        </td>
                                        <td>
                                            <input type="number" className="form-input" value={item.tax_rate} onChange={e => onItemChange(idx, 'tax_rate', e.target.value)} placeholder="0" />
                                        </td>
                                        <td className="text-right font-bold">
                                            Rs. {(item.quantity * item.unit_price).toLocaleString()}
                                        </td>
                                        <td>
                                            <button type="button" className="btn btn-ghost" onClick={() => onRemoveItem(idx)} disabled={formData.items.length <= 1}>✕</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-6)' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddItem}>+ Add Item</button>

                        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <div className="form-group flex justify-between items-center">
                                <label className="form-label" style={{ marginBottom: 0 }}>Global Discount (Rs.)</label>
                                <input type="number" className="form-input" style={{ width: '120px' }} value={formData.discount_amount} onChange={e => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="form-group flex justify-between items-center">
                                <label className="form-label" style={{ marginBottom: 0 }}>Tax Amount (Rs.)</label>
                                <input type="number" className="form-input" style={{ width: '120px' }} value={formData.tax_amount} onChange={e => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="flex justify-between items-center p-3 bg-tertiary rounded-lg mt-2">
                                <span className="font-bold">Total:</span>
                                <span className="text-xl font-bold text-accent">Rs. {(total - formData.discount_amount + formData.tax_amount).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-group mt-6">
                        <label className="form-label">Notes</label>
                        <textarea className="form-input" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows="2" placeholder="Terms, conditions, or specific notes..." />
                    </div>

                    <div className="flex gap-4 mt-8">
                        <button type="submit" className="btn btn-primary">Create Quotation</button>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Quotations
