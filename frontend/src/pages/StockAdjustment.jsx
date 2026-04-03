import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Package, Plus, Minus, Trash2, Check, AlertTriangle, RefreshCw, Search, X, FileText, Undo2, Edit3 } from 'lucide-react'
import { productsAPI, stockAPI } from '../services/api'
import './StockAdjustment.css'

function StockAdjustment() {
    const [products, setProducts] = useState([])
    const [adjustments, setAdjustments] = useState([])
    const [selectedProduct, setSelectedProduct] = useState('')
    const [adjustmentType, setAdjustmentType] = useState('add')
    const [quantity, setQuantity] = useState('')
    const [reason, setReason] = useState('damage')
    const [notes, setNotes] = useState('')
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [showProductDropdown, setShowProductDropdown] = useState(false)
    const [editingRow, setEditingRow] = useState(null)
    const [editValues, setEditValues] = useState({})
    const [errors, setErrors] = useState({})
    const [lastDeleted, setLastDeleted] = useState(null)
    const searchRef = useRef(null)
    const dropdownRef = useRef(null)

    useEffect(() => {
        loadProducts()
    }, [])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowProductDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const loadProducts = async () => {
        try {
            setLoading(true)
            const response = await productsAPI.list({ limit: 500 })
            setProducts(response.data || [])
        } catch (error) {
            toast.error('Failed to load products')
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    )

    const selectedProductData = products.find(p => p.id === selectedProduct)

    const getMetricCards = () => {
        const totalAdjustments = adjustments.length
        const totalQuantity = adjustments.reduce((sum, a) => sum + a.quantity, 0)
        const removals = adjustments.filter(a => a.adjustment_type === 'remove').reduce((sum, a) => sum + a.quantity, 0)
        const additions = adjustments.filter(a => a.adjustment_type === 'add').reduce((sum, a) => sum + a.quantity, 0)

        return [
            { label: 'Total Adjustments', value: totalAdjustments, icon: FileText, color: 'var(--blue)', bg: 'var(--blue-dim)' },
            { label: 'Total Quantity', value: totalQuantity, icon: Package, color: 'var(--purple)', bg: 'var(--purple-dim)' },
            { label: 'Additions', value: additions, icon: Plus, color: 'var(--green)', bg: 'var(--green-dim)' },
            { label: 'Removals', value: removals, icon: Minus, color: 'var(--red)', bg: 'var(--red-dim)' }
        ]
    }

    const validateForm = () => {
        const newErrors = {}
        if (!selectedProduct) {
            newErrors.product = 'Please select a product'
        }
        if (!quantity || parseInt(quantity) <= 0) {
            newErrors.quantity = 'Enter a valid quantity (minimum 1)'
        }
        if (adjustmentType === 'remove' && selectedProductData) {
            if (parseInt(quantity) > (selectedProductData.current_stock || 0)) {
                newErrors.quantity = `Cannot exceed current stock (${selectedProductData.current_stock || 0})`
            }
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const addAdjustment = () => {
        if (!validateForm()) return

        const product = products.find(p => p.id === selectedProduct)
        if (!product) return

        const newAdjustment = {
            product_id: selectedProduct,
            product_code: product.code,
            product_name: product.name,
            current_stock: product.current_stock || 0,
            adjustment_type: adjustmentType,
            quantity: parseInt(quantity),
            reason,
            notes
        }

        setAdjustments([...adjustments, { ...newAdjustment, id: Date.now() }])
        setSelectedProduct('')
        setQuantity('')
        setReason('damage')
        setNotes('')
        setSearch('')
        setErrors({})
        setShowProductDropdown(false)
        toast.success('Adjustment added to list', { icon: '✓' })
    }

    const removeAdjustment = (id) => {
        const deleted = adjustments.find(a => a.id === id)
        setLastDeleted(deleted)
        setAdjustments(adjustments.filter(a => a.id !== id))
        
        toast.custom((t) => (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                background: 'var(--color-panel)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)',
                minWidth: '300px'
            }}>
                <span style={{ flex: 1 }}>Removed "{deleted.product_name}"</span>
                <button
                    onClick={() => {
                        setAdjustments(prev => [...prev, deleted])
                        setLastDeleted(null)
                        toast.dismiss(t.id)
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-2)',
                        background: 'var(--blue-dim)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--blue)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        fontWeight: '500'
                    }}
                >
                    <Undo2 size={14} />
                    Undo
                </button>
            </div>
        ), { duration: 5000 })
    }

    const startEditing = (adj) => {
        setEditingRow(adj.id)
        setEditValues({
            quantity: adj.quantity,
            reason: adj.reason,
            notes: adj.notes
        })
    }

    const saveEdit = (id) => {
        setAdjustments(adjustments.map(a => 
            a.id === id ? { ...a, ...editValues, quantity: parseInt(editValues.quantity) } : a
        ))
        setEditingRow(null)
        setEditValues({})
        toast.success('Adjustment updated')
    }

    const cancelEdit = () => {
        setEditingRow(null)
        setEditValues({})
    }

    const handleSubmitClick = () => {
        if (adjustments.length === 0) {
            toast.error('No adjustments to submit')
            return
        }
        setShowConfirmModal(true)
    }

    const submitAdjustments = async () => {
        setShowConfirmModal(false)
        setSubmitting(true)
        try {
            await stockAPI.adjust({
                adjustments: adjustments.map(({ id, current_stock, product_name, product_code, ...rest }) => rest),
                notes: `Batch adjustment - ${adjustments.length} items`
            })

            toast.success(`${adjustments.length} stock adjustment(s) submitted successfully`, {
                icon: '✓',
                duration: 4000
            })
            setAdjustments([])
            loadProducts()
        } catch (error) {
            toast.error(`Failed to submit: ${error.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const getReasonDisplay = (reason) => {
        const reasons = {
            damage: 'Damaged Items',
            shrinkage: 'Shrinkage/Loss',
            count_correction: 'Count Correction',
            other: 'Other'
        }
        return reasons[reason] || reason
    }

    const getReasonColor = (reason) => {
        const colors = {
            damage: 'var(--red)',
            shrinkage: 'var(--orange)',
            count_correction: 'var(--blue)',
            other: 'var(--muted)'
        }
        return colors[reason] || 'var(--muted)'
    }

    const getReasonBg = (reason) => {
        const colors = {
            damage: 'var(--red-dim)',
            shrinkage: 'var(--orange-dim)',
            count_correction: 'var(--blue-dim)',
            other: 'var(--muted-dim)'
        }
        return colors[reason] || 'var(--muted-dim)'
    }

    const totalAdjustmentValue = adjustments.reduce((sum, adj) => {
        const product = products.find(p => p.id === adj.product_id)
        const value = (product?.cost_price || 0) * adj.quantity
        return sum + (adj.adjustment_type === 'remove' ? -value : value)
    }, 0)

    const metricCards = getMetricCards()
    const isFormValid = selectedProduct && quantity && parseInt(quantity) > 0

    return (
        <div className="stock-adjustment-container">
            <div className="stock-adjustment-header">
                <div className="stock-adjustment-title">
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--blue-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Package size={20} style={{ color: 'var(--blue)' }} />
                    </div>
                    <h1>
                        Stock Adjustment
                    </h1>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: '4px', marginLeft: '52px' }}>
                    Adjust inventory for damages, shrinkage, or count corrections
                </p>
                <button
                    onClick={loadProducts}
                    className="btn btn-ghost"
                    disabled={loading}
                    aria-label="Refresh products list"
                    style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>Refresh</span>
                </button>
            </div>

            {loading ? (
                <div className="stock-metrics-grid">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
                    ))}
                </div>
            ) : (
                <div className="stock-metrics-grid">
                    {metricCards.map((card, i) => (
                        <div
                            key={i}
                            className="stock-metric-card"
                            role="button"
                            tabIndex={0}
                            aria-label={`${card.label}: ${card.value}`}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', fontWeight: '500' }}>{card.label}</span>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius-md)',
                                    background: card.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <card.icon size={16} style={{ color: card.color }} />
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                                {card.value.toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{
                background: 'var(--color-panel)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)'
            }}>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
                    Add Adjustment
                </h2>

                <div className="stock-form-grid">
                    <div style={{ gridColumn: '1 / -1' }} ref={dropdownRef}>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                            Product <span style={{ color: 'var(--red)' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--muted)',
                                pointerEvents: 'none'
                            }}>
                                <Search size={18} />
                            </div>
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search by name or code..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value)
                                    setShowProductDropdown(true)
                                    if (!selectedProduct) {
                                        setErrors(prev => ({ ...prev, product: undefined }))
                                    }
                                }}
                                onFocus={() => {
                                    if (search) setShowProductDropdown(true)
                                }}
                                className="form-input"
                                style={{ 
                                    paddingLeft: '40px', 
                                    height: '48px',
                                    borderColor: errors.product ? 'var(--red)' : undefined
                                }}
                                aria-label="Search products"
                                aria-describedby={errors.product ? 'product-error' : undefined}
                                aria-invalid={!!errors.product}
                            />
                        </div>
                        {errors.product && (
                            <span id="product-error" role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} /> {errors.product}
                            </span>
                        )}

                        {showProductDropdown && search && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'var(--color-panel)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                marginTop: '4px',
                                maxHeight: '240px',
                                overflowY: 'auto',
                                zIndex: 50,
                                boxShadow: 'var(--shadow-lg)'
                            }}>
                                {filteredProducts.length === 0 ? (
                                    <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--muted)' }}>
                                        No products found
                                    </div>
                                ) : (
                                    filteredProducts.slice(0, 10).map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedProduct(p.id)
                                                setSearch(p.name)
                                                setShowProductDropdown(false)
                                                setErrors(prev => ({ ...prev, product: undefined }))
                                            }}
                                            role="option"
                                            aria-selected={selectedProduct === p.id}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    setSelectedProduct(p.id)
                                                    setSearch(p.name)
                                                    setShowProductDropdown(false)
                                                }
                                            }}
                                            style={{
                                                padding: 'var(--space-2) var(--space-3)',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--border)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'background 0.1s',
                                                background: selectedProduct === p.id ? 'var(--blue-dim)' : 'transparent'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedProduct !== p.id) e.currentTarget.style.background = 'var(--color-bg)'
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedProduct !== p.id) e.currentTarget.style.background = 'transparent'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '500', color: 'var(--color-text)' }}>{p.name}</div>
                                                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'monospace' }}>
                                                    {p.code}
                                                </code>
                                            </div>
                                            <span style={{
                                                fontSize: 'var(--text-xs)',
                                                color: (p.current_stock || 0) < 10 ? 'var(--red)' : 'var(--muted)',
                                                background: 'var(--color-bg)',
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontWeight: (p.current_stock || 0) < 10 ? '600' : '400'
                                            }}>
                                                {(p.current_stock || 0)} units
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {selectedProductData && (
                            <div style={{
                                marginTop: 'var(--space-2)',
                                padding: 'var(--space-2) var(--space-3)',
                                background: 'var(--green-dim)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                border: '1px solid var(--green)',
                                borderOpacity: 0.3
                            }}>
                                <Check size={16} style={{ color: 'var(--green)' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>
                                        {selectedProductData.name}
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', display: 'flex', gap: 'var(--space-2)' }}>
                                        <code style={{ fontFamily: 'monospace' }}>{selectedProductData.code}</code>
                                        <span>•</span>
                                        <span>Current Stock: <strong>{(selectedProductData.current_stock || 0)}</strong></span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedProduct('')
                                        setSearch('')
                                        setErrors(prev => ({ ...prev, product: 'Please select a product' }))
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: 'var(--muted)',
                                        borderRadius: 'var(--radius-sm)',
                                        minWidth: '44px',
                                        minHeight: '44px',
                                        justifyContent: 'center'
                                    }}
                                    aria-label="Clear product selection"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
                            Type <span style={{ color: 'var(--red)' }}>*</span>
                        </label>
                        <div 
                            role="group"
                            aria-label="Adjustment type"
                            style={{
                                display: 'flex',
                                background: 'var(--color-bg)',
                                borderRadius: 'var(--radius-md)',
                                padding: '4px',
                                gap: '4px',
                                border: '1px solid var(--border)'
                            }}
                        >
                            <button
                                onClick={() => setAdjustmentType('add')}
                                aria-pressed={adjustmentType === 'add'}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    border: 'none',
                                    borderRadius: 'calc(var(--radius-md) - 2px)',
                                    background: adjustmentType === 'add' ? 'var(--green)' : 'transparent',
                                    color: adjustmentType === 'add' ? '#fff' : 'var(--muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--space-2)',
                                    fontWeight: '600',
                                    fontSize: 'var(--text-sm)',
                                    transition: 'all 0.15s',
                                    outline: 'none'
                                }}
                                onFocus={(e) => {
                                    if (adjustmentType !== 'add') e.currentTarget.style.boxShadow = '0 0 0 2px var(--green-dim)'
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.boxShadow = 'none'
                                }}
                            >
                                <Plus size={18} aria-hidden="true" />
                                Add
                            </button>
                            <button
                                onClick={() => setAdjustmentType('remove')}
                                aria-pressed={adjustmentType === 'remove'}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    border: 'none',
                                    borderRadius: 'calc(var(--radius-md) - 2px)',
                                    background: adjustmentType === 'remove' ? 'var(--red)' : 'transparent',
                                    color: adjustmentType === 'remove' ? '#fff' : 'var(--muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--space-2)',
                                    fontWeight: '600',
                                    fontSize: 'var(--text-sm)',
                                    transition: 'all 0.15s',
                                    outline: 'none'
                                }}
                                onFocus={(e) => {
                                    if (adjustmentType !== 'remove') e.currentTarget.style.boxShadow = '0 0 0 2px var(--red-dim)'
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.boxShadow = 'none'
                                }}
                            >
                                <Minus size={18} aria-hidden="true" />
                                Remove
                            </button>
                        </div>
                        {adjustmentType === 'remove' && selectedProductData && (
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--orange)', marginTop: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} />
                                Available: {selectedProductData.current_stock || 0} units
                            </p>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                            Quantity <span style={{ color: 'var(--red)' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                placeholder="0"
                                value={quantity}
                                onChange={(e) => {
                                    setQuantity(e.target.value)
                                    setErrors(prev => ({ ...prev, quantity: undefined }))
                                }}
                                min="1"
                                max={adjustmentType === 'remove' ? selectedProductData?.current_stock : undefined}
                                className="form-input"
                                style={{ 
                                    height: '48px', 
                                    paddingRight: '60px',
                                    borderColor: errors.quantity ? 'var(--red)' : undefined
                                }}
                                aria-label="Quantity to adjust"
                                aria-describedby={errors.quantity ? 'quantity-error' : undefined}
                                aria-invalid={!!errors.quantity}
                            />
                            <span style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--muted)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: '500',
                                pointerEvents: 'none'
                            }}>
                                units
                            </span>
                        </div>
                        {errors.quantity && (
                            <span id="quantity-error" role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} /> {errors.quantity}
                            </span>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                            Reason
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="form-select"
                            style={{ height: '48px' }}
                            aria-label="Reason for adjustment"
                        >
                            <option value="damage">Damaged Items</option>
                            <option value="shrinkage">Shrinkage/Loss</option>
                            <option value="count_correction">Count Correction</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                            Notes <span style={{ color: 'var(--muted)', fontWeight: '400' }}>(Optional)</span>
                        </label>
                        <textarea
                            placeholder="Add any relevant notes for this adjustment..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                            className="form-input"
                            style={{ resize: 'vertical', minHeight: '80px' }}
                            aria-label="Additional notes"
                        />
                    </div>
                </div>

                <button
                    onClick={addAdjustment}
                    disabled={!isFormValid}
                    className="btn btn-primary"
                    style={{ 
                        marginTop: 'var(--space-4)', 
                        minHeight: '48px',
                        opacity: isFormValid ? 1 : 0.5,
                        cursor: isFormValid ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)'
                    }}
                    aria-label="Add adjustment to pending list"
                >
                    <Plus size={18} />
                    Add to List
                </button>
            </div>

            {adjustments.length > 0 && (
                <div style={{
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', color: 'var(--color-text)' }}>
                            Pending Adjustments ({adjustments.length})
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: 'var(--space-1) var(--space-3)',
                                background: totalAdjustmentValue >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', fontWeight: '500' }}>Net Impact:</span>
                                <span style={{
                                    fontWeight: '700',
                                    color: totalAdjustmentValue >= 0 ? 'var(--green)' : 'var(--red)',
                                    fontFamily: 'monospace'
                                }}>
                                    {totalAdjustmentValue >= 0 ? '+' : '-'}Rs. {Math.abs(totalAdjustmentValue).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="stock-table-wrapper">
                        <table className="table" role="grid" aria-label="Pending adjustments">
                            <thead>
                                <tr>
                                    <th scope="col" style={{ minWidth: '100px' }}>SKU</th>
                                    <th scope="col">Product</th>
                                    <th scope="col">Current</th>
                                    <th scope="col">Type</th>
                                    <th scope="col" style={{ textAlign: 'right' }}>Qty</th>
                                    <th scope="col">Reason</th>
                                    <th scope="col" style={{ minWidth: '150px' }}>Notes</th>
                                    <th scope="col" style={{ textAlign: 'center', width: '100px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustments.map((adj) => (
                                    <tr key={adj.id} style={{ 
                                        borderLeft: `3px solid ${adj.adjustment_type === 'add' ? 'var(--green)' : 'var(--red)'}`
                                    }}>
                                        <td>
                                            <code style={{
                                                fontFamily: 'monospace',
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--muted)',
                                                background: 'var(--color-bg)',
                                                padding: '2px 6px',
                                                borderRadius: 'var(--radius-sm)'
                                            }}>
                                                {adj.product_code}
                                            </code>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{adj.product_name}</td>
                                        <td style={{ color: 'var(--muted)' }}>{adj.current_stock}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: 'var(--text-xs)',
                                                fontWeight: '600',
                                                background: adj.adjustment_type === 'remove' ? 'var(--red-dim)' : 'var(--green-dim)',
                                                color: adj.adjustment_type === 'remove' ? 'var(--red)' : 'var(--green)'
                                            }}>
                                                {adj.adjustment_type === 'remove' ? <Minus size={12} /> : <Plus size={12} />}
                                                {adj.adjustment_type === 'remove' ? 'REMOVE' : 'ADD'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {editingRow === adj.id ? (
                                                <input
                                                    type="number"
                                                    value={editValues.quantity}
                                                    onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                                                    className="form-input"
                                                    style={{ width: '80px', height: '36px', textAlign: 'right' }}
                                                    min="1"
                                                    aria-label="Edit quantity"
                                                />
                                            ) : (
                                                <span style={{ fontWeight: '700', fontSize: 'var(--text-lg)', fontFamily: 'monospace' }}>
                                                    {adj.adjustment_type === 'remove' ? '-' : '+'}{adj.quantity}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {editingRow === adj.id ? (
                                                <select
                                                    value={editValues.reason}
                                                    onChange={(e) => setEditValues({ ...editValues, reason: e.target.value })}
                                                    className="form-select"
                                                    style={{ height: '36px' }}
                                                >
                                                    <option value="damage">Damaged</option>
                                                    <option value="shrinkage">Shrinkage</option>
                                                    <option value="count_correction">Correction</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            ) : (
                                                <span style={{
                                                    fontSize: 'var(--text-sm)',
                                                    color: getReasonColor(adj.reason)
                                                }}>
                                                    {getReasonDisplay(adj.reason)}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {editingRow === adj.id ? (
                                                <input
                                                    type="text"
                                                    value={editValues.notes}
                                                    onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                                                    className="form-input"
                                                    style={{ height: '36px' }}
                                                    placeholder="Notes..."
                                                />
                                            ) : (
                                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', maxWidth: '150px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {adj.notes || <span style={{ fontStyle: 'italic' }}>—</span>}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
                                                {editingRow === adj.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => saveEdit(adj.id)}
                                                            className="btn btn-success"
                                                            style={{ minWidth: '44px', minHeight: '44px', padding: '8px' }}
                                                            aria-label="Save changes"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="btn btn-ghost"
                                                            style={{ minWidth: '44px', minHeight: '44px', padding: '8px' }}
                                                            aria-label="Cancel edit"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => startEditing(adj)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '10px',
                                                                borderRadius: 'var(--radius-md)',
                                                                color: 'var(--blue)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                minWidth: '44px',
                                                                minHeight: '44px'
                                                            }}
                                                            aria-label={`Edit ${adj.product_name}`}
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeAdjustment(adj.id)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '10px',
                                                                borderRadius: 'var(--radius-md)',
                                                                color: 'var(--red)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                minWidth: '44px',
                                                                minHeight: '44px'
                                                            }}
                                                            aria-label={`Remove ${adj.product_name}`}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="stock-submit-grid" style={{
                        paddingTop: 'var(--space-4)',
                        borderTop: '1px solid var(--border)'
                    }}>
                        <div style={{ background: 'var(--color-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: '4px' }}>Items</div>
                            <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--color-text)' }}>{adjustments.length}</div>
                        </div>
                        <div style={{ background: 'var(--green-dim)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--green)', marginBottom: '4px' }}>Additions</div>
                            <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--green)' }}>
                                +{adjustments.filter(a => a.adjustment_type === 'add').reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                        <div style={{ background: 'var(--red-dim)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--red)', marginBottom: '4px' }}>Removals</div>
                            <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--red)' }}>
                                -{adjustments.filter(a => a.adjustment_type === 'remove').reduce((sum, a) => sum + a.quantity, 0)}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        marginTop: 'var(--space-4)',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => setAdjustments([])}
                            className="btn btn-ghost"
                            style={{ minHeight: '48px' }}
                            aria-label="Clear all pending adjustments"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={handleSubmitClick}
                            disabled={submitting}
                            className="btn btn-success"
                            style={{ flex: 1, minHeight: '48px', minWidth: '200px' }}
                            aria-label={`Submit ${adjustments.length} adjustment${adjustments.length > 1 ? 's' : ''}`}
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Check size={18} />
                                    Submit {adjustments.length} Adjustment{adjustments.length > 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {adjustments.length === 0 && !loading && (
                <div style={{
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-6)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--blue-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-3)'
                    }}>
                        <Package size={28} style={{ color: 'var(--blue)' }} />
                    </div>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                        No Pending Adjustments
                    </h3>
                    <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
                        Search and select a product above to create stock adjustments
                    </p>
                </div>
            )}

            {showConfirmModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setShowConfirmModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-title"
                >
                    <div
                        style={{
                            background: 'var(--color-panel)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-5)',
                            maxWidth: '520px',
                            width: '90%',
                            boxShadow: 'var(--shadow-xl)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--orange-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 'var(--space-3)'
                        }}>
                            <AlertTriangle size={28} style={{ color: 'var(--orange)' }} />
                        </div>
                        <h2 id="confirm-title" style={{ fontSize: 'var(--text-lg)', fontWeight: '600', color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
                            Confirm Stock Adjustments
                        </h2>
                        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                            You are about to submit {adjustments.length} stock adjustment{adjustments.length > 1 ? 's' : ''}. This will update inventory records and cannot be undone.
                        </p>

                        <div style={{
                            background: 'var(--color-bg)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-3)',
                            marginBottom: 'var(--space-4)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Items</span>
                                <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{adjustments.length}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plus size={14} style={{ color: 'var(--green)' }} /> Additions
                                </span>
                                <span style={{ fontWeight: '600', color: 'var(--green)' }}>
                                    +{adjustments.filter(a => a.adjustment_type === 'add').reduce((sum, a) => sum + a.quantity, 0)} units
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Minus size={14} style={{ color: 'var(--red)' }} /> Removals
                                </span>
                                <span style={{ fontWeight: '600', color: 'var(--red)' }}>
                                    -{adjustments.filter(a => a.adjustment_type === 'remove').reduce((sum, a) => sum + a.quantity, 0)} units
                                </span>
                            </div>
                        </div>

                        <div style={{
                            background: totalAdjustmentValue >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-3)',
                            marginBottom: 'var(--space-4)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>Net Inventory Impact</span>
                            <span style={{ fontWeight: '700', fontSize: 'var(--text-lg)', color: totalAdjustmentValue >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {totalAdjustmentValue >= 0 ? '+' : '-'}Rs. {Math.abs(totalAdjustmentValue).toLocaleString()}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="btn btn-ghost"
                                style={{ flex: 1, minHeight: '48px' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitAdjustments}
                                className="btn btn-success"
                                style={{ flex: 1, minHeight: '48px' }}
                            >
                                <Check size={18} />
                                Confirm & Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StockAdjustment
