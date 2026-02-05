import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { productsAPI, suppliersAPI, purchasesAPI, categoriesAPI } from '../services/api'
import { ProductCard } from '../components/pos'
import { emit, DataSyncEvents } from '../utils/dataSync'
import '../components/pos/pos.css'

function NewPurchase() {
    const navigate = useNavigate()
    const searchRef = useRef(null)

    // Data state
    const [products, setProducts] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    // UI state
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState(null)
    const [searchFocused, setSearchFocused] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [lastAddedProductId, setLastAddedProductId] = useState(null)
    const [cartOpen, setCartOpen] = useState(false)

    // Cart state (local, not persisted like sales)
    const [cart, setCart] = useState([])
    const [supplierId, setSupplierId] = useState('')
    const [referenceNumber, setReferenceNumber] = useState('')
    const [globalDiscount, setGlobalDiscount] = useState(0)
    const [globalDiscountType, setGlobalDiscountType] = useState('amount')
    const [taxRate, setTaxRate] = useState(0)
    const [paidAmount, setPaidAmount] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer')

    // Load data on mount
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [productsRes, suppliersRes, categoriesRes] = await Promise.all([
                productsAPI.list({ limit: 500 }),
                suppliersAPI.list({ limit: 500 }),
                categoriesAPI.list({ limit: 100 })
            ])
            setProducts(productsRes.data || [])
            setSuppliers(suppliersRes.data || [])
            setCategories(categoriesRes.data || [])
        } catch (error) {
            toast.error('Failed to load data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Cart operations
    const addToCart = useCallback((product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id)
            
            // Only auto-open cart on first item (when cart was empty)
            if (prev.length === 0) {
                setCartOpen(true)
            }
            
            if (existing) {
                return prev.map(item =>
                    item.product_id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }
            return [...prev, {
                product_id: product.id,
                name: product.name,
                code: product.code,
                unit_price: product.cost_price || 0,
                quantity: 1
            }]
        })
        setLastAddedProductId(product.id)
        setTimeout(() => setLastAddedProductId(null), 400)
    }, [])

    const updateQuantity = useCallback((productId, qty) => {
        if (qty <= 0) {
            setCart(prev => prev.filter(item => item.product_id !== productId))
        } else {
            setCart(prev => prev.map(item =>
                item.product_id === productId ? { ...item, quantity: qty } : item
            ))
        }
    }, [])

    const updateUnitPrice = useCallback((productId, price) => {
        setCart(prev => prev.map(item =>
            item.product_id === productId ? { ...item, unit_price: price } : item
        ))
    }, [])

    const removeFromCart = useCallback((productId) => {
        setCart(prev => prev.filter(item => item.product_id !== productId))
    }, [])

    const clearCart = useCallback(() => {
        setCart([])
        setSupplierId('')
        setReferenceNumber('')
        setGlobalDiscount(0)
        setTaxRate(0)
        setPaidAmount(0)
    }, [])

    // Calculate totals
    const { subtotal, discountAmount, taxAmount, total, balance } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
        const disc = globalDiscountType === 'percent'
            ? (sub * globalDiscount / 100)
            : globalDiscount
        const afterDisc = sub - disc
        const tax = afterDisc * (taxRate / 100)
        const tot = afterDisc + tax
        return {
            subtotal: sub,
            discountAmount: disc,
            taxAmount: tax,
            total: tot,
            balance: tot - paidAmount
        }
    }, [cart, globalDiscount, globalDiscountType, taxRate, paidAmount])

    // Filter products
    const filteredProducts = useMemo(() => {
        let result = products
        if (categoryFilter) {
            result = result.filter(p => p.category_id === categoryFilter)
        }
        if (search.trim()) {
            const term = search.toLowerCase()
            result = result.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term)
            )
        }
        return result
    }, [products, categoryFilter, search])

    // Toggle cart
    const toggleCart = useCallback(() => setCartOpen(prev => !prev), [])
    const closeCart = useCallback(() => setCartOpen(false), [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && cartOpen) {
                closeCart()
            }
            if (e.key === 'F9') {
                e.preventDefault()
                toggleCart()
            }
            if (e.key === '/' && !searchFocused && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [cartOpen, searchFocused, closeCart, toggleCart])

    // Submit purchase
    const handleSubmit = async () => {
        if (cart.length === 0) {
            toast.error('Add at least one item')
            return
        }
        if (!supplierId) {
            toast.error('Please select a supplier')
            return
        }
        if (total <= 0) {
            toast.error('Purchase total must be greater than 0')
            return
        }

        setSubmitting(true)
        try {
            const purchaseData = {
                supplier_id: supplierId,
                purchase_date: new Date().toISOString(),
                reference_number: referenceNumber,
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_price,
                    line_discount: 0,
                    tax_rate: 0
                })),
                discount_amount: discountAmount,
                tax_amount: taxAmount,
                amount_paid: paidAmount,
                payment_method: paymentMethod,
                notes: `Purchase via POS - ${new Date().toLocaleString()}`
            }

            const response = await purchasesAPI.create(purchaseData)

            if (response.data?.bill_number) {
                toast.success(`✓ Purchase completed! Bill: ${response.data.bill_number}`)
                
                // Emit data sync event so other components can refresh
                emit(DataSyncEvents.PURCHASE_CREATED, response.data)
                
                clearCart()
                setTimeout(() => navigate('/purchases'), 1500)
            }
        } catch (error) {
            toast.error(error.message || 'Failed to complete purchase')
            console.error('Purchase error:', error)
        } finally {
            setSubmitting(false)
        }
    }

    // Get cart quantity for a product
    const getCartQty = useCallback((productId) => {
        const item = cart.find(i => i.product_id === productId)
        return item?.quantity || 0
    }, [cart])

    if (loading) {
        return (
            <div className="pos-loading">
                <div className="loading-spinner">⟳</div>
                <div>Loading purchase data...</div>
            </div>
        )
    }

    return (
        <div className="pos-layout">
            <main className="pos-main">
                {/* Top Bar */}
                <div className="pos-topbar">
                    <div style={{ flex: 1, maxWidth: '400px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block', textTransform: 'uppercase' }}>
                            Supplier
                        </label>
                        <select
                            className="form-select"
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">Select Supplier...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ width: '180px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block', textTransform: 'uppercase' }}>
                            Ref # (Supplier Bill)
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="INV-2024-001"
                        />
                    </div>
                </div>

                {/* Search */}
                <div className={`pos-search ${searchFocused ? 'focused' : ''}`}>
                    <span className="search-icon">🔍</span>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search products by name, code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                    {search && (
                        <button className="search-clear" onClick={() => setSearch('')}>✕</button>
                    )}
                    <span className="search-hint">Press /</span>
                </div>

                {/* Category Tabs */}
                {categories.length > 0 && (
                    <div className="category-tabs">
                        <button
                            className={`category-tab ${categoryFilter === null ? 'active' : ''}`}
                            onClick={() => setCategoryFilter(null)}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`category-tab ${categoryFilter === cat.id ? 'active' : ''}`}
                                onClick={() => setCategoryFilter(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Products Grid */}
                <div className="pos-products">
                    {filteredProducts.length > 0 ? (
                        <div className="product-grid">
                            {filteredProducts.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    cartQuantity={getCartQty(product.id)}
                                    onAdd={addToCart}
                                    isSelected={lastAddedProductId === product.id}
                                    priceLabel="Cost"
                                    priceValue={product.cost_price || 0}
                                    allowOutOfStock={true}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="pos-no-products">
                            {search ? '❌ No products found' : '📦 No products available'}
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Cart Toggle Button */}
            <button
                type="button"
                className={`cart-toggle-fab ${cartOpen ? 'hidden' : ''} ${cart.length > 0 ? 'has-items' : ''}`}
                onClick={toggleCart}
                aria-label="Open cart"
            >
                <span className="fab-icon">📦</span>
                {cart.length > 0 && (
                    <span className="fab-badge">{cart.length}</span>
                )}
            </button>

            {/* Cart Sidebar / Drawer */}
            <div className={`cart-overlay ${cartOpen ? 'open' : ''}`} onClick={closeCart} />
            <aside className={`cart-sidebar drawer-mode ${cartOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="cart-header">
                    <h2 className="cart-title">📦 Purchase Cart</h2>
                    <span className="cart-count">{cart.length} items</span>
                    <button className="cart-close-btn" onClick={closeCart} aria-label="Close cart">✕</button>
                </div>

                {/* Cart Items */}
                <div className="cart-items">
                    {cart.length === 0 ? (
                        <div className="cart-empty">
                            <div className="cart-empty-icon">📦</div>
                            <div className="cart-empty-text">No items in cart</div>
                            <div className="cart-empty-hint">Add products to get started</div>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.product_id} className="cart-item purchase-cart-item">
                                <button
                                    className="cart-item-remove"
                                    onClick={() => removeFromCart(item.product_id)}
                                    title="Remove"
                                >
                                    ✕
                                </button>
                                <div className="cart-item-info">
                                    <div className="cart-item-name">{item.name}</div>
                                    <div className="cart-item-code">{item.code}</div>
                                </div>
                                <div className="purchase-cart-controls">
                                    <div className="purchase-input-group">
                                        <label>Cost</label>
                                        <input
                                            type="number"
                                            value={item.unit_price}
                                            onChange={(e) => updateUnitPrice(item.product_id, Number(e.target.value))}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="purchase-input-group">
                                        <label>Qty</label>
                                        <div className="qty-controls">
                                            <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>−</button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.product_id, Math.max(1, parseInt(e.target.value) || 1))}
                                                min="1"
                                            />
                                            <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="cart-item-total">
                                    Rs. {(item.unit_price * item.quantity).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="cart-footer">
                        {/* Adjustments */}
                        <div className="purchase-adjustments">
                            <div className="adjust-field">
                                <label>Discount</label>
                                <div className="adjust-input-row">
                                    <input
                                        type="number"
                                        value={globalDiscount}
                                        onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                                        className="form-input"
                                    />
                                    <select
                                        value={globalDiscountType}
                                        onChange={(e) => setGlobalDiscountType(e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="amount">Rs</option>
                                        <option value="percent">%</option>
                                    </select>
                                </div>
                            </div>
                            <div className="adjust-field">
                                <label>Tax Rate (%)</label>
                                <input
                                    type="number"
                                    value={taxRate}
                                    onChange={(e) => setTaxRate(Number(e.target.value))}
                                    className="form-input"
                                    step="0.5"
                                />
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="cart-totals">
                            <div className="total-row">
                                <span>Subtotal:</span>
                                <span>Rs. {subtotal.toLocaleString()}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="total-row discount">
                                    <span>Discount:</span>
                                    <span>- Rs. {discountAmount.toLocaleString()}</span>
                                </div>
                            )}
                            {taxAmount > 0 && (
                                <div className="total-row">
                                    <span>Tax ({taxRate}%):</span>
                                    <span>+ Rs. {taxAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="total-row grand-total">
                                <span>Total:</span>
                                <span>Rs. {total.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Payment */}
                        <div className="purchase-payment">
                            <div className="payment-field">
                                <label>Paid Amount (Rs)</label>
                                <input
                                    type="number"
                                    value={paidAmount}
                                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                                    className="form-input paid-input"
                                />
                            </div>
                            <div className="payment-field">
                                <label>Payment Method</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="bank_transfer">🏦 Bank Transfer</option>
                                    <option value="cash">💵 Cash</option>
                                    <option value="cheque">🎫 Cheque</option>
                                    <option value="credit">🕒 Credit (Payable)</option>
                                </select>
                            </div>
                        </div>

                        {/* Balance */}
                        {balance !== 0 && (
                            <div className={`purchase-balance ${balance > 0 ? 'due' : 'overpaid'}`}>
                                <span>{balance > 0 ? '💳 Payable:' : '💰 Overpaid:'}</span>
                                <span>Rs. {Math.abs(balance).toLocaleString()}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="cart-actions">
                            <button className="btn btn-ghost" onClick={closeCart}>
                                Continue Shopping
                            </button>
                            <button
                                className="btn btn-success checkout-btn"
                                onClick={handleSubmit}
                                disabled={submitting || cart.length === 0 || !supplierId}
                            >
                                {submitting ? '⏳ Processing...' : '✓ Complete Purchase'}
                            </button>
                        </div>
                    </div>
                )}
            </aside>

            {/* Purchase-specific styles */}
            <style>{`
                /* ============================================
                   POS LAYOUT STYLES (Matching Sales)
                   ============================================ */
                .pos-layout {
                    display: flex;
                    height: calc(100vh - 60px);
                    background: var(--color-bg-primary);
                    overflow: hidden;
                    position: relative;
                }

                .pos-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: var(--space-4);
                    overflow: hidden;
                    gap: var(--space-3);
                }

                .pos-topbar {
                    display: flex;
                    align-items: flex-end;
                    gap: var(--space-4);
                }

                .pos-search {
                    position: relative;
                }

                .pos-search input {
                    width: 100%;
                    padding: 14px 20px 14px 48px;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    font-size: 1rem;
                    color: var(--color-text-primary);
                    transition: all 0.2s ease;
                }

                .pos-search input:focus {
                    outline: none;
                    border-color: var(--color-accent);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
                }

                .pos-search.focused input {
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2), 0 8px 32px rgba(0, 0, 0, 0.15);
                }

                .pos-search .search-icon {
                    position: absolute;
                    left: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 1.1rem;
                    pointer-events: none;
                }

                .pos-search .search-clear {
                    position: absolute;
                    right: 70px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: var(--color-text-muted);
                    cursor: pointer;
                    padding: 4px 8px;
                    font-size: 0.9rem;
                }

                .pos-search .search-clear:hover {
                    color: var(--color-danger);
                }

                .pos-search .search-hint {
                    position: absolute;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    padding: 4px 8px;
                    background: var(--color-bg-tertiary);
                    border-radius: 4px;
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    font-family: var(--font-mono);
                }

                .pos-products {
                    flex: 1;
                    overflow-y: auto;
                    background: var(--color-bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                }

                .product-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: var(--space-4);
                    padding: var(--space-4);
                }

                .pos-no-products {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--color-text-muted);
                    font-size: 1.1rem;
                }

                .pos-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    gap: var(--space-3);
                    color: var(--color-text-muted);
                }

                .loading-spinner {
                    font-size: 2rem;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Responsive */
                @media (max-width: 1024px) {
                    .pos-layout {
                        flex-direction: column;
                        height: auto;
                        min-height: 100vh;
                    }

                    .pos-main {
                        flex: none;
                        height: 60vh;
                        min-height: 400px;
                    }

                    .product-grid {
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: var(--space-3);
                    }
                }

                @media (max-width: 640px) {
                    .pos-main {
                        padding: var(--space-2);
                    }

                    .pos-topbar {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .product-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: var(--space-2);
                    }

                    .pos-search .search-hint {
                        display: none;
                    }
                }

                /* ============================================
                   PURCHASE CART ITEM STYLES
                   ============================================ */
                .purchase-cart-item {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    padding: var(--space-3);
                    margin-bottom: var(--space-2);
                    position: relative;
                }

                .purchase-cart-item .cart-item-remove {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    z-index: 10;
                }

                .purchase-cart-item .cart-item-remove:hover {
                    background: #ef4444;
                    border-color: #ef4444;
                    color: white;
                    transform: scale(1.1);
                }

                .purchase-cart-item .cart-item-info {
                    margin-bottom: var(--space-3);
                    padding-right: 40px;
                }

                .purchase-cart-item .cart-item-name {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: var(--color-text-primary);
                    margin-bottom: 2px;
                }

                .purchase-cart-item .cart-item-code {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    font-family: var(--font-mono);
                }

                .purchase-cart-controls {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-3);
                }

                .purchase-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .purchase-input-group label {
                    font-size: 0.65rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    font-weight: 600;
                }

                .purchase-input-group > input {
                    padding: 10px 12px;
                    font-size: 0.95rem;
                    text-align: right;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    color: var(--color-text-primary);
                    font-weight: 500;
                }

                .purchase-input-group > input:focus {
                    outline: none;
                    border-color: var(--color-accent);
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
                }

                .purchase-input-group .qty-controls {
                    display: flex;
                    gap: 0;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    overflow: hidden;
                }

                .purchase-input-group .qty-controls button {
                    width: 36px;
                    height: 38px;
                    background: var(--color-bg-tertiary);
                    border: none;
                    color: var(--color-text-primary);
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .purchase-input-group .qty-controls button:hover {
                    background: var(--color-accent);
                    color: white;
                }

                .purchase-input-group .qty-controls input {
                    flex: 1;
                    border: none;
                    background: transparent;
                    text-align: center;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--color-text-primary);
                    min-width: 40px;
                }

                .purchase-input-group .qty-controls input:focus {
                    outline: none;
                }

                .purchase-cart-item .cart-item-total {
                    text-align: right;
                    font-weight: 700;
                    font-size: 1.05rem;
                    color: var(--color-accent);
                    padding-top: var(--space-3);
                    margin-top: var(--space-3);
                    border-top: 1px dashed var(--color-border);
                }

                /* Adjustments Section */
                .purchase-adjustments {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--color-bg-secondary);
                    border-bottom: 1px solid var(--color-border);
                }

                .adjust-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .adjust-field label {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    font-weight: 600;
                }

                .adjust-input-row {
                    display: flex;
                    gap: 6px;
                }

                .adjust-input-row input,
                .adjust-field > input {
                    flex: 1;
                    min-width: 0;
                    padding: 8px 10px;
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    color: var(--color-text-primary);
                    font-size: 0.9rem;
                }

                .adjust-input-row select {
                    width: 55px;
                    flex-shrink: 0;
                    padding: 8px 4px;
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    color: var(--color-text-primary);
                    font-size: 0.85rem;
                }

                /* Totals */
                .cart-totals {
                    padding: var(--space-3);
                    background: var(--color-bg-tertiary);
                    margin: 0;
                }

                .cart-totals .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 6px 0;
                    font-size: 0.9rem;
                }

                .cart-totals .total-row.grand-total {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--color-accent);
                    border-top: 2px solid var(--color-border);
                    padding-top: var(--space-2);
                    margin-top: var(--space-2);
                }

                .cart-totals .total-row.discount {
                    color: var(--color-danger);
                }

                /* Payment Section */
                .purchase-payment {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--color-bg-secondary);
                    border-top: 1px solid var(--color-border);
                }

                .payment-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .payment-field label {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    font-weight: 600;
                }

                .payment-field input,
                .payment-field select {
                    padding: 10px 12px;
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    color: var(--color-text-primary);
                    font-size: 0.9rem;
                }

                .payment-field input {
                    text-align: right;
                    font-weight: 600;
                }

                /* Balance Display */
                .purchase-balance {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-3) var(--space-4);
                    margin: 0;
                    font-weight: 700;
                    font-size: 1rem;
                }

                .purchase-balance.due {
                    background: rgba(251, 191, 36, 0.12);
                    color: #f59e0b;
                }

                .purchase-balance.overpaid {
                    background: rgba(34, 197, 94, 0.12);
                    color: #22c55e;
                }

                /* Actions */
                .cart-actions {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--color-bg-primary);
                    border-top: 1px solid var(--color-border);
                }

                .cart-actions .btn-ghost {
                    padding: var(--space-3) var(--space-4);
                    font-weight: 500;
                }

                .cart-actions .checkout-btn {
                    padding: var(--space-3) var(--space-4);
                    font-size: 1rem;
                    font-weight: 600;
                }
            `}</style>
        </div>
    )
}

export default NewPurchase
