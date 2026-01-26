import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, customersAPI, salesAPI, quotationsAPI } from '../services/api'
import { format } from 'date-fns'
import { useNavigate, useLocation } from 'react-router-dom'

function NewSale() {
    const navigate = useNavigate()
    const location = useLocation()
    const [products, setProducts] = useState([])
    const [customers, setCustomers] = useState([])
    const [cart, setCart] = useState([])
    const [customerId, setCustomerId] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [quotationId, setQuotationId] = useState(null)
    const [notes, setNotes] = useState('')
    const [globalDiscount, setGlobalDiscount] = useState(0)
    const [globalDiscountType, setGlobalDiscountType] = useState('amount') // 'amount' or 'percent'
    const [taxRate, setTaxRate] = useState(0)
    const [paidAmount, setPaidAmount] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [showCartModal, setShowCartModal] = useState(false)

    useEffect(() => {
        loadData()
        if (location.state?.quotationId) {
            loadQuotation(location.state.quotationId)
        }
    }, [])

    const loadQuotation = async (id) => {
        try {
            const res = await quotationsAPI.get(id)
            const quote = res.data
            setQuotationId(id)
            setSelectedCustomer(customers.find(c => c.id === quote.customer_id) || { id: quote.customer_id, name: quote.customer_name })
            setCart(quote.items.map(item => ({
                product_id: item.product_id,
                name: item.product_name,
                code: item.product_code,
                unit_price: item.unit_price,
                quantity: item.quantity,
                discount_percent: item.discount_percent || 0,
                discount_amount: item.discount_amount || 0,
                tax_percent: item.tax_percent || 0
            })))
            setNotes(`Converted from Quotation ${quote.quotation_number}. ${quote.notes || ''}`)
            setCustomerId(quote.customer_id)
            setGlobalDiscount(quote.discount_amount)
            setGlobalDiscountType(quote.discount_type || 'amount')
            setTaxRate(quote.tax_rate)
        } catch (error) {
            toast.error('Failed to load quotation')
            console.error('Load quotation error:', error)
        }
    }

    const loadData = async () => {
        try {
            const [productsRes, customersRes] = await Promise.all([
                productsAPI.list({ limit: 500 }),
                customersAPI.list({ limit: 500 })
            ])
            setProducts(productsRes.data)
            setCustomers(customersRes.data)
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
                unit_price: product.retail_price,
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
                const updated = { ...item, [field]: value }

                // Recalculate line total if needed
                if (['quantity', 'unit_price', 'discount_percent', 'discount_amount', 'tax_percent'].includes(field)) {
                    // Auto-calculate line totals
                }

                return updated
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
    const calculateLineTotal = (item) => {
        const lineSubtotal = item.unit_price * item.quantity
        const discount = item.discount_amount || (lineSubtotal * item.discount_percent / 100)
        const beforeTax = lineSubtotal - discount
        const tax = beforeTax * (item.tax_percent || 0) / 100
        return {
            lineSubtotal,
            discount,
            beforeTax,
            tax,
            lineTotal: beforeTax + tax
        }
    }

    const cartSubtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
    const discountAmount = globalDiscountType === 'percent'
        ? (cartSubtotal * globalDiscount / 100)
        : globalDiscount
    const afterDiscount = cartSubtotal - discountAmount
    const taxAmount = afterDiscount * (taxRate / 100)
    const total = afterDiscount + taxAmount
    const balance = total - paidAmount

    const handleSubmit = async () => {
        // Validation
        if (cart.length === 0) {
            toast.error('❌ Add at least one item')
            return
        }

        if (customerId === '' && balance > 0) {
            toast.error('❌ Walk-in customers cannot have credit sales. Enter payment amount equal to total.')
            return
        }

        if (paidAmount < 0) {
            toast.error('❌ Paid amount cannot be negative')
            return
        }

        if (total <= 0) {
            toast.error('❌ Sale total must be greater than 0')
            return
        }

        setSubmitting(true)
        try {
            const saleData = {
                customer_id: customerId || null,
                invoice_date: new Date().toISOString().split('T')[0],
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
                notes: `Sale via POS - ${new Date().toLocaleString()}`
            }

            const response = await salesAPI.create(saleData)

            if (response.data?.invoice_number) {
                if (quotationId) {
                    await quotationsAPI.updateStatus(quotationId, 'converted')
                }
                toast.success(`✓ Sale completed! Invoice: ${response.data.invoice_number}`)
                // Reset form
                setCart([])
                setCustomerId('')
                setGlobalDiscount(0)
                setPaidAmount(0)
                setTaxRate(0)
                navigate('/sales')
            }
        } catch (error) {
            toast.error(`❌ ${error.message}`)
            console.error('Sale error:', error)
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
            {/* Top Bar with Customer & Cart Summary */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div className="card" style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>SELECT CUSTOMER</label>
                    <select
                        className="form-select"
                        value={customerId}
                        onChange={(e) => {
                            const selected = customers.find(c => c.id === e.target.value)
                            if (selected && selected.credit_limit) {
                                toast((t) => (
                                    <div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{selected.name}</div>
                                        <div>Credit Limit: Rs. {selected.credit_limit}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#999' }}>Balance: Rs. {selected.opening_balance || 0}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#999' }}>Available: Rs. {selected.credit_limit - (selected.opening_balance || 0)}</div>
                                    </div>
                                ), { duration: 4000 })
                            }
                            setCustomerId(e.target.value)
                        }}
                        style={{ fontSize: '0.95rem' }}
                    >
                        <option value="">👥 Walk-in Customer</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name} - {c.phone}
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
                    <div style={{ fontSize: '2rem' }}>🛒</div>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--color-accent)' }}>{cart.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Items in Cart</div>
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
                                const stockAvailable = product.current_stock || 0
                                const outOfStock = stockAvailable <= 0
                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => !outOfStock && addToCart(product)}
                                        disabled={outOfStock}
                                        style={{
                                            padding: 'var(--space-4)',
                                            background: inCart ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-bg-tertiary)',
                                            border: inCart ? '3px solid var(--color-success)' : outOfStock ? '2px solid var(--color-danger)' : '2px solid transparent',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: outOfStock ? 'not-allowed' : 'pointer',
                                            color: outOfStock ? 'var(--color-text-muted)' : 'inherit',
                                            textAlign: 'left',
                                            transition: 'all 0.2s',
                                            opacity: outOfStock ? 0.5 : 1
                                        }}
                                        onMouseEnter={(e) => !outOfStock && (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                                        onMouseLeave={(e) => !outOfStock && (e.currentTarget.style.borderColor = inCart ? 'var(--color-success)' : 'transparent')}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                                            {product.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                                            {product.code}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            padding: '4px 6px',
                                            borderRadius: '4px',
                                            background: outOfStock ? 'rgba(239, 68, 68, 0.2)' : stockAvailable > product.min_stock_level ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                            color: outOfStock ? 'var(--color-danger)' : stockAvailable > product.min_stock_level ? 'var(--color-success)' : 'var(--color-warning)',
                                            marginBottom: '8px',
                                            fontWeight: 500,
                                            textAlign: 'center'
                                        }}>
                                            Stock: {stockAvailable}
                                        </div>
                                        <div style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '1rem' }}>
                                            Rs. {Number(product.retail_price).toLocaleString()}
                                        </div>
                                        {inCart && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 600, marginTop: '6px' }}>
                                                ✓ Added
                                            </div>
                                        )}
                                        {outOfStock && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '6px' }}>
                                                ✕ Out of Stock
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

            {/* CART MODAL */}
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
                            <h2 style={{ margin: 0 }}>🛒 Shopping Cart ({cart.length} items)</h2>
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
                                                    <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Price</label>
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
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Global Discount</label>
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
                                            <option value="cash">💵 Cash</option>
                                            <option value="bank">🏦 Bank Transfer</option>
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
                                            {balance > 0 ? '💳 Credit Balance:' : '💰 Change:'}
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: balance > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                            Rs. {Math.abs(balance).toLocaleString()}
                                        </span>
                                    </div>
                                )}

                                {/* Complete Sale Button */}
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
                                        {submitting ? '⏳ Processing...' : '✓ Complete Sale'}
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
export default NewSale