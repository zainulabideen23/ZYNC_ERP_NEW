import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, stockAPI } from '../services/api'

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
            setProducts(response.data || [])
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
            await stockAPI.adjust({
                adjustments: adjustments.map(({ id, current_stock, product_name, ...rest }) => rest),
                notes: `Batch adjustment - ${adjustments.length} items`
            })

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
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">📦 Stock Adjustment</h1>
                    <p className="text-muted text-sm" style={{ marginTop: '4px' }}>
                        Adjust inventory for damages, shrinkage, or count corrections
                    </p>
                </div>
            </div>

            {/* Form Card */}
            <div className="card">
                <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>
                    Add Adjustment
                </h2>

                <div className="form-grid">
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
                            <div className="card" style={{ marginTop: '4px', padding: 0, maxHeight: '200px', overflowY: 'auto' }}>
                                {filteredProducts.slice(0, 10).map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedProduct(p.id)
                                            setSearch('')
                                        }}
                                        className="balance-row cursor-pointer"
                                        style={{ borderRadius: 0 }}
                                    >
                                        <span>{p.name}</span>
                                        <span className="text-xs text-muted">
                                            Stock: {p.current_stock || 0}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedProductData && (
                            <div className="summary-stat" style={{ marginTop: '8px' }}>
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    ✓ {selectedProductData.name}
                                </div>
                                <div className="text-sm text-muted">
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
                    <div className="full-width">
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
                    aria-label="Add adjustment to list"
                >
                    ✓ Add to List
                </button>
            </div>

            {/* Adjustments List */}
            {adjustments.length > 0 && (
                <div className="card">
                    <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>
                        Pending Adjustments ({adjustments.length})
                    </h2>

                    {/* Summary */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 'var(--space-2)',
                            marginBottom: 'var(--space-3)'
                        }}
                    >
                        <div className="summary-stat">
                            <div className="summary-stat-label">Total Items</div>
                            <div className="summary-stat-value accent">
                                {adjustments.reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div className="summary-stat">
                            <div className="summary-stat-label">Removals</div>
                            <div className="summary-stat-value danger">
                                {adjustments.filter(a => a.adjustment_type === 'remove').reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div className="summary-stat">
                            <div className="summary-stat-label">Additions</div>
                            <div className="summary-stat-value success">
                                {adjustments.filter(a => a.adjustment_type === 'add').reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div className="summary-stat">
                            <div className="summary-stat-label">Impact Value</div>
                            <div className={`summary-stat-value ${totalAdjustmentValue < 0 ? 'danger' : 'success'}`}>
                                Rs. {Math.abs(totalAdjustmentValue).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Adjustments Table */}
                    <div className="table-container">
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
                                        <td style={{ fontWeight: '600' }}>{adj.product_name}</td>
                                        <td>{adj.current_stock} units</td>
                                        <td>
                                            <span className={`adj-badge ${adj.adjustment_type === 'remove' ? 'remove' : 'add'}`}>
                                                {adj.adjustment_type === 'remove' ? '➖ Remove' : '➕ Add'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                                            {adj.quantity}
                                        </td>
                                        <td>{getReasonDisplay(adj.reason)}</td>
                                        <td className="text-muted text-sm">
                                            {adj.notes || '-'}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => removeAdjustment(adj.id)}
                                                className="btn btn-ghost btn-sm text-danger"
                                                aria-label={`Remove ${adj.product_name} adjustment`}
                                            >
                                                🗑️ Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Submit Button */}
                    <div className="modal-actions">
                        <button
                            onClick={() => setAdjustments([])}
                            className="btn btn-ghost"
                            aria-label="Cancel all adjustments"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitAdjustments}
                            disabled={submitting}
                            className="btn btn-success"
                            style={{ flex: 1 }}
                            aria-label="Submit all adjustments"
                        >
                            {submitting ? '⏳ Submitting...' : '✓ Submit Adjustments'}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {adjustments.length === 0 && (
                <div className="empty-state" style={{ padding: 'var(--space-5)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📦</div>
                    <p>No adjustments pending. Add products above to get started.</p>
                </div>
            )}
        </div>
    )
}

export default StockAdjustment
