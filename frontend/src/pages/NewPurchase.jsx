import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { productsAPI, suppliersAPI, purchasesAPI } from '../services/api'

function NewPurchase() {
    const navigate = useNavigate()
    const [products, setProducts] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [cart, setCart] = useState([])
    const [supplierId, setSupplierId] = useState('')
    const [globalDiscount, setGlobalDiscount] = useState(0)
    const [globalDiscountType, setGlobalDiscountType] = useState('amount')
    const [taxRate, setTaxRate] = useState(0)
    const [paidAmount, setPaidAmount] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('bank')
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [showCartModal, setShowCartModal] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [productsRes, suppliersRes] = await Promise.all([
                productsAPI.list({ limit: 500 }),
                suppliersAPI.list({ limit: 500 })
            ])
            setProducts(productsRes.data)
            setSuppliers(suppliersRes.data)
        } catch (error) {
            toast.error('Failed to load data')
        }
    }

    const addToCart = (product) => {
        const existing = cart.find(item => item.product_id === product.id)
        if (existing) {
            setCart(cart.map(item =>
                item.product_id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            setCart([...cart, {
                product_id: product.id,
                name: product.name,
                code: product.code,
                unit_price: product.cost_price,
                quantity: 1,
                discount_percent: 0,
                discount_amount: 0,
                tax_percent: 0
            }])
        }
    }

    const updateCartItem = (productId, field, value) => {
        setCart(cart.map(item => {
            if (item.product_id === productId) {
                return { ...item, [field]: value }
            }
            return item
        }))
    }

    const updateQuantity = (productId, qty) => {
        if (qty <= 0) {
            setCart(cart.filter(item => item.product_id !== productId))
        } else {
            updateCartItem(productId, 'quantity', qty)
        }
    }

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.product_id !== productId))
    }

    // Calculate totals
    const cartSubtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
    const discountAmount = globalDiscountType === 'percent'
        ? (cartSubtotal * globalDiscount / 100)
        : globalDiscount
    const afterDiscount = cartSubtotal - discountAmount
    const taxAmount = afterDiscount * (taxRate / 100)
    const total = afterDiscount + taxAmount
    const balance = total - paidAmount

    const handleSubmit = async () => {
        if (cart.length === 0) {
            toast.error('❌ Add at least one item')
            return
        }

        if (supplierId === '') {
            toast.error('❌ Please select a supplier')
            return
        }

        if (paidAmount < 0) {
            toast.error('❌ Paid amount cannot be negative')
            return
        }

        if (total <= 0) {
            toast.error('❌ Purchase total must be greater than 0')
            return
        }

        setSubmitting(true)
        try {
            const purchaseData = {
                supplier_id: supplierId,
                bill_date: new Date().toISOString().split('T')[0],
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount_percent: item.discount_percent || 0,
                    discount_amount: item.discount_amount || 0,
                    tax_percent: item.tax_percent || 0
                })),
                discount_amount: discountAmount,
                tax_amount: taxAmount,
                paid_amount: paidAmount,
                payment_method: paymentMethod,
                notes: `Purchase via System - ${new Date().toLocaleString()}`
            }

            const response = await purchasesAPI.create(purchaseData)

            if (response.data?.bill_number) {
                toast.success(`✓ Purchase completed! Bill: ${response.data.bill_number}`)
                setCart([])
                setSupplierId('')
                setGlobalDiscount(0)
                setPaidAmount(0)
                setTaxRate(0)
                setTimeout(() => navigate('/purchases'), 1500)
            }
        } catch (error) {
            toast.error(`❌ ${error.message}`)
            console.error('Purchase error:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20)

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', height: 'calc(100vh - 80px)' }}>
            {/* Top Bar with Supplier & Cart Summary */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div className="card" style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>SELECT SUPPLIER</label>
                    <select
                        className="form-select"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        style={{ fontSize: '0.95rem' }}
                    >
                        <option value="">🏢 Select Supplier...</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} - {s.phone}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Cart Badge */}
                <button
                    className="card"
                    onClick={() => setShowCartModal(true)}
                    style={{
                        padding: 'var(--space-3)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'center',
                        border: '2px solid var(--color-accent)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <div style={{ fontSize: '2rem' }}>📦</div>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--color-accent)' }}>{cart.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Items</div>
                    {cart.length > 0 && (
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '4px', color: 'var(--color-accent)' }}>
                            Rs. {cartSubtotal.toLocaleString()}
                        </div>
                    )}
                </button>
            </div>

            {/* Products Grid */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Search by product name or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: 'var(--space-4)' }}
                />
                <div className="card" style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => {
                                const inCart = cart.find(item => item.product_id === product.id)
                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        style={{
                                            padding: 'var(--space-4)',
                                            background: inCart ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-bg-tertiary)',
                                            border: inCart ? '3px solid var(--color-success)' : '2px solid transparent',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = inCart ? 'var(--color-success)' : 'transparent'}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                                            {product.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                                            {product.code}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', padding: '4px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--color-accent)', marginBottom: '8px', fontWeight: 500, textAlign: 'center' }}>
                                            Cost: Rs. {Number(product.cost_price).toLocaleString()}
                                        </div>
                                        <div style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '1rem' }}>
                                            Rs. {Number(product.cost_price).toLocaleString()}
                                        </div>
                                        {inCart && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 600, marginTop: '6px' }}>
                                                ✓ Added
                                            </div>
                                        )}
                                    </button>
                                )
                            })
                        ) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                                {search ? '❌ No products found' : '📦 Loading products...'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CART MODAL - Same as NewSale */}
            {showCartModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    zIndex: 1000
                }} onClick={() => setShowCartModal(false)}>
                    <div
                        style={{
                            background: 'var(--color-bg-primary)',
                            width: '100%',
                            maxHeight: '90vh',
                            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: 'var(--space-4)',
                            borderBottom: '1px solid var(--color-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--color-bg-secondary)'
                        }}>
                            <h2 style={{ margin: 0 }}>📦 Purchase Cart ({cart.length} items)</h2>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowCartModal(false)}
                                style={{ fontSize: '1.5rem', padding: '4px 8px' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>📦</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>No items in cart</div>
                                    <div style={{ fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>Add products to get started</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                                    {cart.map(item => (
                                        <div key={item.product_id} style={{
                                            padding: 'var(--space-3)',
                                            background: 'var(--color-bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '2px' }}>{item.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.code}</div>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => removeFromCart(item.product_id)}
                                                    title="Remove from cart"
                                                    style={{ padding: '2px 6px', fontSize: '1rem' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', fontSize: '0.85rem' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Cost</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={item.unit_price}
                                                        onChange={(e) => updateCartItem(item.product_id, 'unit_price', Number(e.target.value))}
                                                        style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Qty</label>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => updateQuantity(item.product_id, item.quantity - 1)} style={{ flex: 1 }}>−</button>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            value={item.quantity}
                                                            onChange={(e) => updateQuantity(item.product_id, Math.max(1, Number(e.target.value)))}
                                                            style={{ textAlign: 'center', padding: '6px', flex: 1, fontSize: '0.85rem' }}
                                                        />
                                                        <button className="btn btn-ghost btn-sm" onClick={() => updateQuantity(item.product_id, item.quantity + 1)} style={{ flex: 1 }}>+</button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, textAlign: 'right', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
                                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Line Total</div>
                                                <div style={{ fontSize: '1rem', color: 'var(--color-accent)' }}>Rs. {(item.unit_price * item.quantity).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer - Calculations & Checkout */}
                        {cart.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', padding: 'var(--space-4)' }}>
                                {/* Adjustments */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Discount</label>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={globalDiscount}
                                                onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                                                style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }}
                                            />
                                            <select
                                                className="form-select"
                                                value={globalDiscountType}
                                                onChange={(e) => setGlobalDiscountType(e.target.value)}
                                                style={{ flex: '0 0 70px', padding: '8px', fontSize: '0.9rem' }}
                                            >
                                                <option value="amount">Rs</option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Tax Rate (%)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={taxRate}
                                            onChange={(e) => setTaxRate(Number(e.target.value))}
                                            step="0.5"
                                            style={{ padding: '8px', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>

                                {/* Calculation Summary */}
                                <div style={{ background: 'var(--color-bg-tertiary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                                        <span>Subtotal:</span>
                                        <span style={{ fontWeight: 600 }}>Rs. {cartSubtotal.toLocaleString()}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '8px', color: 'var(--color-danger)' }}>
                                            <span>Discount ({globalDiscountType === 'percent' ? globalDiscount + '%' : 'Rs'}):</span>
                                            <span style={{ fontWeight: 600 }}>- Rs. {discountAmount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {taxAmount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '8px', color: 'var(--color-warning)' }}>
                                            <span>Tax ({taxRate}%):</span>
                                            <span style={{ fontWeight: 600 }}>+ Rs. {taxAmount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, paddingTop: '8px', borderTop: '2px solid var(--color-border)', color: 'var(--color-accent)' }}>
                                        <span>Total:</span>
                                        <span>Rs. {total.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Payment Info */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Paid Amount (Rs)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={paidAmount}
                                            onChange={(e) => setPaidAmount(Number(e.target.value))}
                                            style={{ padding: '10px', fontSize: '1rem', fontWeight: 600, textAlign: 'right' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Method</label>
                                        <select
                                            className="form-select"
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            style={{ padding: '10px', fontSize: '0.95rem' }}
                                        >
                                            <option value="bank">🏦 Bank Transfer</option>
                                            <option value="cash">💵 Cash</option>
                                            <option value="cheque">🎫 Cheque</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Balance Display */}
                                {balance !== 0 && (
                                    <div style={{
                                        padding: 'var(--space-3)',
                                        marginBottom: 'var(--space-4)',
                                        borderRadius: 'var(--radius-md)',
                                        background: balance > 0 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                            {balance > 0 ? '💳 Payable:' : '💰 Overpaid:'}
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: balance > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                            Rs. {Math.abs(balance).toLocaleString()}
                                        </span>
                                    </div>
                                )}

                                {/* Complete Purchase Button */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: 'var(--space-3)', fontWeight: 600, fontSize: '0.95rem' }}
                                        onClick={() => setShowCartModal(false)}
                                    >
                                        Continue Shopping
                                    </button>
                                    <button
                                        className="btn btn-success"
                                        style={{ padding: 'var(--space-3)', fontWeight: 600, fontSize: '0.95rem' }}
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                    >
                                        {submitting ? '⏳ Processing...' : '✓ Complete Purchase'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NewPurchase
