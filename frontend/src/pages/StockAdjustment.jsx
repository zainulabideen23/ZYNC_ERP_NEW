import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI } from '../services/api'

function StockAdjustment() {
    const [products, setProducts] = useState([])
    const [adjustments, setAdjustments] = useState([])
    const [selectedProduct, setSelectedProduct] = useState('')
    const [adjustmentType, setAdjustmentType] = useState('add') // 'add' or 'remove'
    const [quantity, setQuantity] = useState('')
    const [reason, setReason] = useState('damage') // damage, shrinkage, count_correction, other
    const [notes, setNotes] = useState('')
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadProducts()
    }, [])

    const loadProducts = async () => {
        try {
            const response = await productsAPI.list({ limit: 500 })
            setProducts(response.data)
        } catch (error) {
            toast.error('Failed to load products')
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    )

    const selectedProductData = products.find(p => p.id === selectedProduct)

    const addAdjustment = () => {
        if (!selectedProduct || !quantity) {
            toast.error('Please select product and enter quantity')
            return
        }

        const product = products.find(p => p.id === selectedProduct)
        if (!product) return

        const newAdjustment = {
            product_id: selectedProduct,
            product_name: product.name,
            current_stock: product.current_stock || 0,
            adjustment_type: adjustmentType,
            quantity: parseInt(quantity),
            reason,
            notes
        }

        // Validate adjustment
        if (adjustmentType === 'remove' && newAdjustment.quantity > newAdjustment.current_stock) {
            toast.error(`Cannot remove ${newAdjustment.quantity} units. Available: ${newAdjustment.current_stock}`)
            return
        }

        setAdjustments([...adjustments, { ...newAdjustment, id: Date.now() }])
        setSelectedProduct('')
        setQuantity('')
        setReason('damage')
        setNotes('')
        setSearch('')
        toast.success('✓ Adjustment added')
    }

    const removeAdjustment = (id) => {
        setAdjustments(adjustments.filter(a => a.id !== id))
        toast.success('Adjustment removed')
    }

    const submitAdjustments = async () => {
        if (adjustments.length === 0) {
            toast.error('No adjustments to submit')
            return
        }

        setSubmitting(true)
        try {
            // For now, we'll simulate submission
            // In real app, this would call a backend API
            const payload = {
                adjustments: adjustments.map(({ id, current_stock, ...rest }) => rest),
                submitted_at: new Date().toISOString(),
                notes: `Batch adjustment - ${adjustments.length} items`
            }

            // Simulate API call (replace with real API when backend endpoint is ready)
            await new Promise(resolve => setTimeout(resolve, 1000))

            toast.success(`✓ ${adjustments.length} stock adjustment(s) submitted`)
            setAdjustments([])

            // Reload products to refresh stock
            loadProducts()
        } catch (error) {
            toast.error(`Failed to submit adjustments: ${error.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const getReasonDisplay = (reason) => {
        const reasons = {
            damage: '🔨 Damaged Items',
            shrinkage: '📉 Shrinkage/Loss',
            count_correction: '🔢 Count Correction',
            other: '📝 Other'
        }
        return reasons[reason] || reason
    }

    const totalAdjustmentValue = adjustments.reduce((sum, adj) => {
        const product = products.find(p => p.id === adj.product_id)
        const value = (product?.cost_price || 0) * adj.quantity
        return sum + (adj.adjustment_type === 'remove' ? -value : value)
    }, 0)

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">📦 Stock Adjustment</h1>
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                    Adjust inventory for damages, shrinkage, or count corrections
                </p>
            </div>

            {/* Form Card */}
            <div className="card">
                <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', fontWeight: 'bold' }}>
                    Add Adjustment
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    {/* Product Search */}
                    <div>
                        <label className="form-label">Product</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search by name or code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <div
                                style={{
                                    marginTop: '4px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}
                            >
                                {filteredProducts.slice(0, 10).map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedProduct(p.id)
                                            setSearch('')
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #eee',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => e.target.parentElement.style.background = '#f9f9f9'}
                                        onMouseLeave={(e) => e.target.parentElement.style.background = 'white'}
                                    >
                                        <span>{p.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#999' }}>
                                            Stock: {p.current_stock || 0}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedProductData && (
                            <div
                                style={{
                                    marginTop: '8px',
                                    padding: '8px 12px',
                                    background: '#f0f8ff',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                    ✓ {selectedProductData.name}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                    Code: {selectedProductData.code} | Stock: {selectedProductData.current_stock || 0} units
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Adjustment Type */}
                    <div>
                        <label className="form-label">Type</label>
                        <select
                            className="form-select"
                            value={adjustmentType}
                            onChange={(e) => setAdjustmentType(e.target.value)}
                        >
                            <option value="add">➕ Add Stock</option>
                            <option value="remove">➖ Remove Stock</option>
                        </select>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="form-label">Quantity</label>
                        <input
                            type="number"
                            className="form-input"
                            placeholder="0"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min="1"
                        />
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="form-label">Reason</label>
                        <select
                            className="form-select"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        >
                            <option value="damage">🔨 Damaged Items</option>
                            <option value="shrinkage">📉 Shrinkage/Loss</option>
                            <option value="count_correction">🔢 Count Correction</option>
                            <option value="other">📝 Other</option>
                        </select>
                    </div>

                    {/* Notes */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Notes (Optional)</label>
                        <textarea
                            className="form-input"
                            placeholder="Enter any additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                        />
                    </div>
                </div>

                <button
                    onClick={addAdjustment}
                    className="btn btn-primary"
                    style={{ marginTop: 'var(--space-3)' }}
                >
                    ✓ Add to List
                </button>
            </div>

            {/* Adjustments List */}
            {adjustments.length > 0 && (
                <div className="card">
                    <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', fontWeight: 'bold' }}>
                        Pending Adjustments ({adjustments.length})
                    </h2>

                    {/* Summary */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 'var(--space-3)',
                            marginBottom: 'var(--space-4)',
                            padding: 'var(--space-3)',
                            background: '#f9f9f9',
                            borderRadius: '6px'
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
                                Total Items
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3c72' }}>
                                {adjustments.reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
                                Removals
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d32f2f' }}>
                                {adjustments.filter(a => a.adjustment_type === 'remove').reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
                                Additions
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#388e3c' }}>
                                {adjustments.filter(a => a.adjustment_type === 'add').reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
                                Impact Value
                            </div>
                            <div
                                style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: totalAdjustmentValue < 0 ? '#d32f2f' : '#388e3c'
                                }}
                            >
                                Rs. {Math.abs(totalAdjustmentValue).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Adjustments Table */}
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Current Stock</th>
                                <th>Type</th>
                                <th>Qty</th>
                                <th>Reason</th>
                                <th>Notes</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adjustments.map(adj => (
                                <tr key={adj.id}>
                                    <td style={{ fontWeight: 'bold' }}>{adj.product_name}</td>
                                    <td>{adj.current_stock} units</td>
                                    <td>
                                        <span
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                                background:
                                                    adj.adjustment_type === 'remove' ? '#ffebee' : '#e8f5e9',
                                                color:
                                                    adj.adjustment_type === 'remove' ? '#d32f2f' : '#388e3c'
                                            }}
                                        >
                                            {adj.adjustment_type === 'remove' ? '➖ Remove' : '➕ Add'}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        {adj.quantity}
                                    </td>
                                    <td>{getReasonDisplay(adj.reason)}</td>
                                    <td style={{ fontSize: '0.9rem', color: '#666' }}>
                                        {adj.notes || '-'}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => removeAdjustment(adj.id)}
                                            className="btn btn-danger"
                                            style={{
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                                background: '#ffcdd2',
                                                color: '#c62828',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Submit Button */}
                    <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                        <button
                            onClick={submitAdjustments}
                            disabled={submitting}
                            className="btn btn-success"
                            style={{
                                flex: 1,
                                padding: '10px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                opacity: submitting ? 0.6 : 1
                            }}
                        >
                            {submitting ? '⏳ Submitting...' : '✓ Submit Adjustments'}
                        </button>
                        <button
                            onClick={() => setAdjustments([])}
                            className="btn btn-secondary"
                            style={{ padding: '10px 20px', fontSize: '0.95rem' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {adjustments.length === 0 && (
                <div
                    style={{
                        padding: 'var(--space-6)',
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '0.95rem'
                    }}
                >
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📦</div>
                    <p>No adjustments pending. Add products above to get started.</p>
                </div>
            )}
        </div>
    )
}

export default StockAdjustment
