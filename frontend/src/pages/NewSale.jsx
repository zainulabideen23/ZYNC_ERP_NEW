import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, customersAPI, salesAPI, quotationsAPI, categoriesAPI } from '../services/api'
import { emit, DataSyncEvents } from '../utils/dataSync'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cart.store'
import {
    ProductCard,
    CustomerSelector,
    CartSidebar,
    BarcodeInput,
    CategoryTabs
} from '../components/pos'
import '../components/pos/pos.css'

function NewSale() {
    const navigate = useNavigate()
    const location = useLocation()
    const searchRef = useRef(null)

    // Data state
    const [products, setProducts] = useState([])
    const [customers, setCustomers] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    // UI state
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState(null)
    const [searchFocused, setSearchFocused] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [lastAddedProductId, setLastAddedProductId] = useState(null)
    const [cartOpen, setCartOpen] = useState(false) // Drawer state

    // Cart store
    const {
        items: cart,
        customerId,
        customerName,
        globalDiscount,
        globalDiscountType,
        taxRate,
        paymentMethod,
        paidAmount,
        quotationId,
        addItem,
        updateQuantity,
        removeItem,
        setCustomer,
        setGlobalDiscount,
        setTaxRate,
        setPaymentMethod,
        setPaidAmount,
        loadFromQuotation,
        clearCart,
        getSubtotal,
        getDiscountAmount,
        getTaxAmount,
        getTotal,
        getBalance,
        getReturnToCustomer,
        getSaleData
    } = useCartStore()

    // Computed values (from store methods)
    const subtotal = getSubtotal()
    const discountAmount = getDiscountAmount()
    const taxAmount = getTaxAmount()
    const total = getTotal()
    const balance = getBalance()
    const returnToCustomer = getReturnToCustomer()

    // Initial data load
    useEffect(() => {
        loadData()
    }, [])

    // Load quotation if navigated from quotations page
    useEffect(() => {
        if (location.state?.quotationId && customers.length > 0) {
            loadQuotation(location.state.quotationId)
        }
    }, [location.state?.quotationId, customers])

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Focus search with / or Ctrl+K
            if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) &&
                !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                e.preventDefault()
                searchRef.current?.focus()
            }
            // Escape to clear search
            if (e.key === 'Escape' && searchFocused) {
                setSearch('')
                searchRef.current?.blur()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [searchFocused])

    const loadData = async () => {
        try {
            setLoading(true)
            const [productsRes, customersRes, categoriesRes] = await Promise.all([
                productsAPI.list({ limit: 500 }),
                customersAPI.list({ limit: 500 }),
                categoriesAPI.list().catch(() => ({ data: [] })) // Categories are optional
            ])
            setProducts(productsRes.data || [])
            setCustomers(customersRes.data || [])
            setCategories(categoriesRes.data || categoriesRes || [])
        } catch (error) {
            toast.error('Failed to load data')
            console.error('Load error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadQuotation = async (id) => {
        try {
            const res = await quotationsAPI.get(id)
            loadFromQuotation(res.data)
            toast.success('Quotation loaded into cart')
        } catch (error) {
            toast.error('Failed to load quotation')
            console.error('Quotation error:', error)
        }
    }

    // Filter products by search and category
    const filteredProducts = useMemo(() => {
        let result = products

        // Category filter
        if (categoryFilter) {
            result = result.filter(p => p.category_id === categoryFilter)
        }

        // Search filter
        if (search) {
            const lowerSearch = search.toLowerCase()
            result = result.filter(p =>
                p.name.toLowerCase().includes(lowerSearch) ||
                p.code?.toLowerCase().includes(lowerSearch) ||
                p.barcode?.includes(search)
            )
        }

        return result.slice(0, 50) // Limit for performance
    }, [products, search, categoryFilter])

    // Get cart quantity for a product
    const getCartQuantity = useCallback((productId) => {
        return cart.find(item => item.product_id === productId)?.quantity || 0
    }, [cart])

    // Handle adding product to cart with stock validation
    const handleAddToCart = useCallback((product) => {
        const result = addItem(product, products)

        if (!result.success) {
            toast.error(result.message)
            return
        }

        // Track last added for flash animation sync
        setLastAddedProductId(product.id)
        setTimeout(() => setLastAddedProductId(null), 500)

        // Auto-open cart drawer only on first item
        if (cart.length === 0) {
            setCartOpen(true)
        }

        if (result.type === 'warning') {
            toast(result.message, { icon: '⚠️' })
        }
    }, [addItem, products, cart.length])

    // Handle barcode scan
    const handleBarcodeScan = useCallback((product, code) => {
        if (product) {
            handleAddToCart(product)
            toast.success(`Added: ${product.name}`)
            // Auto-open handled in handleAddToCart
        } else {
            toast.error(`Product not found: ${code}`)
        }
    }, [handleAddToCart])

    // Toggle cart drawer
    const toggleCart = useCallback(() => {
        setCartOpen(prev => !prev)
    }, [])

    const closeCart = useCallback(() => {
        setCartOpen(false)
    }, [])

    // Handle quantity update with stock validation
    const handleUpdateQuantity = useCallback((productId, qty, maxStock) => {
        const result = updateQuantity(productId, qty, maxStock)
        if (!result.success) {
            toast.error(result.message)
        }
    }, [updateQuantity])

    // Handle customer change
    const handleCustomerChange = useCallback((id, name) => {
        setCustomer(id, name)
    }, [setCustomer])

    // Handle discount change
    const handleDiscountChange = useCallback((value) => {
        setGlobalDiscount(value, globalDiscountType)
    }, [setGlobalDiscount, globalDiscountType])

    const handleDiscountTypeChange = useCallback((type) => {
        setGlobalDiscount(globalDiscount, type)
    }, [setGlobalDiscount, globalDiscount])

    // Handle checkout
    const handleCheckout = async () => {
        // Validations
        if (cart.length === 0) {
            toast.error('❌ Add at least one item')
            return
        }

        if (!customerId && balance > 0) {
            toast.error('❌ Walk-in customers cannot have credit sales')
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
            const saleData = getSaleData()
            const response = await salesAPI.create(saleData)

            if (response.data?.invoice_number) {
                // Update quotation status if converted
                if (quotationId) {
                    try {
                        await quotationsAPI.updateStatus(quotationId, 'converted')
                    } catch (e) {
                        console.warn('Failed to update quotation status:', e)
                    }
                }

                // Show success with change if applicable
                if (returnToCustomer > 0) {
                    toast.success(
                        <div>
                            <div>✓ Sale completed!</div>
                            <div style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                                Invoice: {response.data.invoice_number}
                            </div>
                            <div style={{ marginTop: 8, fontWeight: 700, color: '#10b981' }}>
                                💰 Return: Rs. {returnToCustomer.toLocaleString()}
                            </div>
                        </div>,
                        { duration: 6000 }
                    )
                } else {
                    toast.success(`✓ Sale completed! Invoice: ${response.data.invoice_number}`)
                }

                // Emit data sync event so other components can refresh
                emit(DataSyncEvents.SALE_CREATED, response.data)

                // Clear cart and navigate
                clearCart()
                navigate('/sales')
            }
        } catch (error) {
            toast.error(`❌ ${error.message}`)
            console.error('Sale error:', error)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="pos-loading">
                <div className="loading-spinner">⏳</div>
                <div>Loading POS...</div>
            </div>
        )
    }

    return (
        <div className="pos-layout">
            {/* Main Content Area */}
            <main className="pos-main">
                {/* Top Bar */}
                <div className="pos-topbar">
                    <CustomerSelector
                        customers={customers}
                        value={customerId}
                        customerName={customerName}
                        onChange={handleCustomerChange}
                    />

                    <div className="pos-topbar-actions">
                        <BarcodeInput
                            products={products}
                            onScan={handleBarcodeScan}
                        />
                    </div>
                </div>

                {/* Search Bar */}
                <div className={`pos-search ${searchFocused ? 'focused' : ''}`}>
                    <span className="search-icon">🔍</span>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search products by name, code, or barcode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        aria-label="Search products"
                    />
                    {search && (
                        <button
                            type="button"
                            className="search-clear"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                    <span className="search-hint">Press /</span>
                </div>

                {/* Category Tabs */}
                {categories.length > 0 && (
                    <CategoryTabs
                        categories={categories}
                        activeCategory={categoryFilter}
                        onChange={setCategoryFilter}
                    />
                )}

                {/* Product Grid */}
                <div className="pos-products">
                    {filteredProducts.length > 0 ? (
                        <div className="product-grid">
                            {filteredProducts.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    cartQuantity={getCartQuantity(product.id)}
                                    onAdd={handleAddToCart}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="pos-no-products">
                            {search || categoryFilter
                                ? '❌ No products match your search'
                                : '📦 No products available'}
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Cart Toggle Button (visible when cart is closed) */}
            <button
                type="button"
                className={`cart-toggle-fab ${cartOpen ? 'hidden' : ''} ${cart.length > 0 ? 'has-items' : ''}`}
                onClick={toggleCart}
                aria-label="Open cart"
            >
                <span className="fab-icon">🛒</span>
                {cart.length > 0 && (
                    <span className="fab-badge">{cart.length}</span>
                )}
            </button>

            {/* Cart Sidebar / Drawer */}
            <CartSidebar
                items={cart}
                subtotal={subtotal}
                discountAmount={discountAmount}
                taxAmount={taxAmount}
                total={total}
                balance={balance}
                returnToCustomer={returnToCustomer}
                globalDiscount={globalDiscount}
                globalDiscountType={globalDiscountType}
                taxRate={taxRate}
                paymentMethod={paymentMethod}
                paidAmount={paidAmount}
                lastAddedProductId={lastAddedProductId}
                isOpen={cartOpen}
                onClose={closeCart}
                onToggle={toggleCart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={removeItem}
                onSetDiscount={handleDiscountChange}
                onSetDiscountType={handleDiscountTypeChange}
                onSetTaxRate={setTaxRate}
                onSetPaymentMethod={setPaymentMethod}
                onSetPaidAmount={setPaidAmount}
                onCheckout={handleCheckout}
                isSubmitting={submitting}
            />

            {/* POS Layout Styles */}
            <style>{`
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
                    /* Allow full width when cart is closed */
                    transition: margin-right 0.3s ease;
                }

                /* Ultra-wide: dock cart as fixed panel */
                @media (min-width: 1440px) {
                    .pos-main {
                        margin-right: 0; /* Cart is always docked */
                    }
                }

                /* Floating Cart Toggle Button (FAB) */
                .cart-toggle-fab {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    border: none;
                    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    z-index: 100;
                }

                .cart-toggle-fab:hover {
                    transform: scale(1.08);
                    box-shadow: 0 6px 28px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.15);
                }

                .cart-toggle-fab:active {
                    transform: scale(0.95);
                }

                .cart-toggle-fab.hidden {
                    opacity: 0;
                    pointer-events: none;
                    transform: scale(0.5);
                }

                .cart-toggle-fab.has-items {
                    animation: fab-pulse 2s infinite;
                }

                @keyframes fab-pulse {
                    0%, 100% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1); }
                    50% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.6), 0 0 0 8px rgba(59, 130, 246, 0.05); }
                }

                .cart-toggle-fab .fab-icon {
                    font-size: 1.6rem;
                }

                .cart-toggle-fab .fab-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 24px;
                    height: 24px;
                    padding: 0 6px;
                    background: #ef4444;
                    color: white;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    font-family: var(--font-mono);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid var(--color-bg-primary);
                }

                .pos-topbar {
                    display: flex;
                    align-items: flex-end;
                    gap: var(--space-4);
                    margin-bottom: var(--space-4);
                }

                .pos-topbar-actions {
                    display: flex;
                    gap: var(--space-2);
                    margin-left: auto;
                }

                .pos-search {
                    position: relative;
                    margin-bottom: var(--space-3);
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
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: var(--space-3);
                    padding: var(--space-3);
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

                /* Responsive Layout */
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
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
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

                    .pos-topbar-actions {
                        margin-left: 0;
                        justify-content: flex-end;
                    }

                    .product-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: var(--space-2);
                    }

                    .pos-search input {
                        padding: 12px 16px 12px 40px;
                        font-size: 0.9rem;
                    }

                    .pos-search .search-hint {
                        display: none;
                    }
                }
            `}</style>
        </div>
    )
}

export default NewSale
