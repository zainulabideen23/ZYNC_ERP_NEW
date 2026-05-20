import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
    Search,
    ScanLine,
    Command,
    UserRound,
    ShoppingCart,
    Minus,
    Plus,
    Trash2,
    X,
    AlertTriangle,
    CircleOff,
    CreditCard,
    Landmark,
    Wallet,
    Maximize2,
    Minimize2,
} from 'lucide-react'
import { productsAPI, customersAPI, salesAPI, quotationsAPI, categoriesAPI } from '../services/api'
import { emit, DataSyncEvents } from '../utils/dataSync'
import { useCartStore } from '../store/cart.store'
import './NewSale.css'

const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: Wallet },
    { id: 'bank_transfer', label: 'Bank', icon: Landmark },
    { id: 'credit', label: 'Credit', icon: CreditCard },
]

const formatCurrency = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`

function buildQuickAmounts(total) {
    const exact = Math.ceil(Number(total || 0))
    if (exact <= 0) return []

    return [
        exact,
        Math.ceil(exact / 100) * 100,
        Math.ceil(exact / 500) * 500,
        Math.ceil(exact / 1000) * 1000,
    ]
        .filter((amount, index, all) => all.indexOf(amount) === index)
        .slice(0, 4)
}

function StockBadge({ stock, minStock }) {
    if (stock <= 0) {
        return (
            <span className="pos-stock-badge is-out">
                <CircleOff size={12} />
                Out
            </span>
        )
    }

    if (stock <= minStock) {
        return (
            <span className="pos-stock-badge is-low">
                <AlertTriangle size={12} />
                Low
            </span>
        )
    }

    return <span className="pos-stock-badge is-healthy">In Stock</span>
}

function ProductCard({ product, cartQuantity, pulse, onAdd }) {
    const stock = Number(product.current_stock || 0)
    const minStock = Number(product.min_stock_level || 5)
    const isOut = stock <= 0

    return (
        <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={isOut}
            className={`pos-product-card${isOut ? ' is-disabled' : ''}${pulse ? ' is-pulse' : ''}`}
            aria-label={`${product.name}, ${formatCurrency(product.retail_price)}, stock ${stock}`}
        >
            <div className="pos-product-head">
                <h3 title={product.name}>{product.name}</h3>
                <StockBadge stock={stock} minStock={minStock} />
            </div>

            <p className="pos-product-sku">SKU: {product.code || 'N/A'}</p>

            <div className="pos-product-foot">
                <strong>{formatCurrency(product.retail_price)}</strong>
                {cartQuantity > 0 && <span className="pos-chip">In cart: {cartQuantity}</span>}
            </div>
        </button>
    )
}

function ProductSkeletonGrid() {
    return (
        <div className="pos-product-grid">
            {Array.from({ length: 12 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="pos-product-skeleton" aria-hidden="true">
                    <div className="pos-skeleton-title" />
                    <div className="pos-skeleton-sku" />
                    <div className="pos-skeleton-price" />
                </div>
            ))}
        </div>
    )
}

function CartPanel({
    isDrawer,
    items,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    balance,
    returnToCustomer,
    globalDiscount,
    globalDiscountType,
    taxRate,
    paymentMethod,
    paidAmount,
    bumpItemId,
    onClose,
    onUpdateQuantity,
    onRemoveItem,
    onSetDiscount,
    onSetDiscountType,
    onSetTaxRate,
    onSetPaymentMethod,
    onSetPaidAmount,
    onCheckout,
    isSubmitting,
}) {
    const [adjustOpen, setAdjustOpen] = useState(false)
    const [draftQuantities, setDraftQuantities] = useState({})
    const quantityInputRefs = useRef({})

    const quickAmounts = useMemo(() => buildQuickAmounts(total), [total])
    const totalUnits = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        [items]
    )

    const dueBalance = Number(balance || 0)
    const paymentState = paidAmount > 0
        ? (dueBalance > 0.001 ? 'insufficient' : (dueBalance < -0.001 ? 'change' : 'exact'))
        : null

    useEffect(() => {
        setDraftQuantities((previous) => {
            const next = {}
            for (const item of items) {
                const key = String(item.product_id)
                next[key] = String(item.quantity ?? 1)

                // Preserve in-progress edits for the currently focused quantity input.
                if (document.activeElement === quantityInputRefs.current[key] && previous[key] !== undefined) {
                    next[key] = previous[key]
                }
            }
            return next
        })
    }, [items])

    const commitQuantity = useCallback((item, rawValue) => {
        const key = String(item.product_id)
        const cleanValue = String(rawValue ?? '').trim()
        const parsed = Number.parseInt(cleanValue, 10)

        if (!Number.isFinite(parsed) || parsed <= 0) {
            setDraftQuantities((previous) => ({
                ...previous,
                [key]: String(item.quantity ?? 1),
            }))
            return false
        }

        const result = onUpdateQuantity(item.product_id, parsed, item.max_stock)
        if (result?.success === false) {
            setDraftQuantities((previous) => ({
                ...previous,
                [key]: String(item.quantity ?? 1),
            }))
            return false
        }

        setDraftQuantities((previous) => ({
            ...previous,
            [key]: String(parsed),
        }))
        return true
    }, [onUpdateQuantity])

    const focusQuantityInputByIndex = useCallback((index) => {
        const nextItem = items[index]
        if (!nextItem) return

        const input = quantityInputRefs.current[String(nextItem.product_id)]
        if (!input) return

        input.focus()
        input.select()
    }, [items])

    const stopAccidentalNumberChange = useCallback((event) => {
        if (document.activeElement === event.currentTarget) {
            event.currentTarget.blur()
        }
    }, [])

    const preventArrowStep = useCallback((event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
        }
    }, [])

    return (
        <aside className={`pos-cart-panel${isDrawer ? ' is-drawer' : ' is-desktop'}`} aria-label="Cart panel">
            <header className="pos-cart-head">
                <div>
                    <h2>Cart</h2>
                    <p>{items.length} item{items.length === 1 ? '' : 's'} · {totalUnits} units</p>
                </div>
                {onClose && (
                    <button type="button" onClick={onClose} className="pos-icon-btn" aria-label="Close cart drawer">
                        <X size={16} />
                    </button>
                )}
            </header>

            <div className="pos-cart-body">
                {items.length === 0 ? (
                    <div className="pos-empty-card">
                        <ShoppingCart size={28} />
                        <p>Cart is empty</p>
                        <span>Add products to begin checkout.</span>
                    </div>
                ) : (
                    <ul className="pos-cart-list">
                        {items.map((item) => (
                            <li
                                key={item.product_id}
                                className={`pos-cart-item${bumpItemId === item.product_id ? ' is-bump' : ''}`}
                            >
                                <div className="pos-cart-item-top">
                                    <div className="pos-cart-item-title">
                                        <p title={item.name}>{item.name}</p>
                                        <span>SKU: {item.code || 'N/A'}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="pos-icon-btn danger"
                                        onClick={() => onRemoveItem(item.product_id, item.name)}
                                        aria-label={`Remove ${item.name}`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="pos-cart-item-bottom">
                                    <span>{formatCurrency(item.unit_price)}</span>

                                    <div className="pos-qty-stepper">
                                        <button
                                            type="button"
                                            onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1, item.max_stock)}
                                            aria-label={`Decrease quantity for ${item.name}`}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <input
                                            ref={(node) => {
                                                const key = String(item.product_id)
                                                if (node) {
                                                    quantityInputRefs.current[key] = node
                                                } else {
                                                    delete quantityInputRefs.current[key]
                                                }
                                            }}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={draftQuantities[String(item.product_id)] ?? String(item.quantity ?? 1)}
                                            onChange={(event) => {
                                                const key = String(item.product_id)
                                                const onlyDigits = event.target.value.replace(/\D/g, '')
                                                setDraftQuantities((previous) => ({
                                                    ...previous,
                                                    [key]: onlyDigits,
                                                }))
                                            }}
                                            onFocus={(event) => event.target.select()}
                                            onBlur={(event) => {
                                                commitQuantity(item, event.target.value)
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key !== 'Enter') return

                                                event.preventDefault()
                                                const currentIndex = items.findIndex(
                                                    (entry) => String(entry.product_id) === String(item.product_id)
                                                )
                                                const didCommit = commitQuantity(item, event.currentTarget.value)
                                                if (!didCommit) return

                                                requestAnimationFrame(() => {
                                                    focusQuantityInputByIndex(currentIndex + 1)
                                                })
                                            }}
                                            aria-label={`Quantity for ${item.name}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1, item.max_stock)}
                                            aria-label={`Increase quantity for ${item.name}`}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="pos-cart-foot">
                <section className="pos-summary-card">
                    <div className="pos-row">
                        <span>Subtotal</span>
                        <strong>{formatCurrency(subtotal)}</strong>
                    </div>

                    <button
                        type="button"
                        className="pos-inline-toggle"
                        onClick={() => setAdjustOpen((open) => !open)}
                        aria-expanded={adjustOpen}
                    >
                        <span>Discount and Tax</span>
                        <span className={adjustOpen ? 'is-open' : ''}>▾</span>
                    </button>

                    {adjustOpen && (
                        <div className="pos-adjust-grid">
                            <div>
                                <label htmlFor="global-discount-value">Discount</label>
                                <div className="pos-dual-input">
                                    <input
                                        id="global-discount-value"
                                        type="number"
                                        min="0"
                                        value={globalDiscount || ''}
                                        onChange={(event) => onSetDiscount(Number(event.target.value) || 0)}
                                        onWheel={stopAccidentalNumberChange}
                                        onKeyDown={preventArrowStep}
                                        aria-label="Discount value"
                                    />
                                    <select
                                        value={globalDiscountType}
                                        onChange={(event) => onSetDiscountType(event.target.value)}
                                        aria-label="Discount type"
                                    >
                                        <option value="amount">Rs</option>
                                        <option value="percent">%</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="global-tax-rate">Tax Rate (%)</label>
                                <input
                                    id="global-tax-rate"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={taxRate || ''}
                                    onChange={(event) => onSetTaxRate(Number(event.target.value) || 0)}
                                    onWheel={stopAccidentalNumberChange}
                                    onKeyDown={preventArrowStep}
                                    aria-label="Tax rate"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pos-summary-meta">
                        {discountAmount > 0 && (
                            <div className="pos-row negative">
                                <span>Discount</span>
                                <strong>- {formatCurrency(discountAmount)}</strong>
                            </div>
                        )}
                        {taxAmount > 0 && (
                            <div className="pos-row warning">
                                <span>Tax</span>
                                <strong>+ {formatCurrency(taxAmount)}</strong>
                            </div>
                        )}
                    </div>
                </section>

                <section className="pos-total-card">
                    <p>Final Total</p>
                    <strong>{formatCurrency(total)}</strong>
                </section>

                <section className="pos-payment-card">
                    <label className="pos-label">Payment Method</label>
                    <div className="pos-payment-methods">
                        {PAYMENT_METHODS.map((method) => {
                            const Icon = method.icon
                            const active = paymentMethod === method.id
                            return (
                                <button
                                    key={method.id}
                                    type="button"
                                    className={`pos-payment-method${active ? ' is-active' : ''}`}
                                    onClick={() => onSetPaymentMethod(method.id)}
                                    aria-pressed={active}
                                >
                                    <Icon size={13} />
                                    {method.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="pos-field">
                        <label htmlFor="amount-received">Amount Received</label>
                        <input
                            id="amount-received"
                            className="pos-amount-input"
                            type="number"
                            min="0"
                            value={paidAmount || ''}
                            onChange={(event) => onSetPaidAmount(Number(event.target.value) || 0)}
                            onWheel={stopAccidentalNumberChange}
                            onKeyDown={preventArrowStep}
                            placeholder="0"
                            aria-label="Amount received"
                        />
                    </div>

                    {paymentMethod === 'cash' && quickAmounts.length > 0 && (
                        <div className="pos-quick-amounts">
                            {quickAmounts.map((amount) => {
                                const active = paidAmount === amount
                                return (
                                    <button
                                        key={`quick-${amount}`}
                                        type="button"
                                        className={`pos-quick-amount${active ? ' is-active' : ''}`}
                                        onClick={() => onSetPaidAmount(amount)}
                                    >
                                        {formatCurrency(amount)}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {paymentState && (
                        <div className={`pos-payment-state is-${paymentState}`} role="status">
                            {paymentState === 'insufficient' && `Insufficient amount: ${formatCurrency(balance)} due`}
                            {paymentState === 'exact' && 'Exact amount received'}
                            {paymentState === 'change' && `Change: ${formatCurrency(returnToCustomer)}`}
                        </div>
                    )}
                </section>

                <button
                    type="button"
                    className="pos-checkout-btn"
                    onClick={onCheckout}
                    disabled={isSubmitting || items.length === 0}
                >
                    {isSubmitting ? 'Processing...' : 'Checkout (Ctrl/Cmd + Enter)'}
                </button>
            </div>
        </aside>
    )
}

function NewSale() {
    const navigate = useNavigate()
    const location = useLocation()
    const isStandalonePOS = location.pathname === '/pos'

    const searchRef = useRef(null)
    const customerMenuRef = useRef(null)
    const barcodeInputRef = useRef(null)
    const scannerBufferRef = useRef('')
    const scannerTimerRef = useRef(null)

    const [products, setProducts] = useState([])
    const [customers, setCustomers] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    const [isDesktopCart, setIsDesktopCart] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : true
    ))
    const [cartOpen, setCartOpen] = useState(false)

    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [submitting, setSubmitting] = useState(false)

    const [customerMenuOpen, setCustomerMenuOpen] = useState(false)
    const [customerQuery, setCustomerQuery] = useState('')

    const [barcodeInputOpen, setBarcodeInputOpen] = useState(false)
    const [barcodeInput, setBarcodeInput] = useState('')

    const [pulseProductId, setPulseProductId] = useState(null)
    const [bumpItemId, setBumpItemId] = useState(null)
    const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))

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
        getSaleData,
    } = useCartStore()

    const subtotal = getSubtotal()
    const discountAmount = getDiscountAmount()
    const taxAmount = getTaxAmount()
    const total = getTotal()
    const balance = getBalance()
    const returnToCustomer = getReturnToCustomer()

    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer.id) === String(customerId)),
        [customers, customerId]
    )

    const customerDisplayName = selectedCustomer?.name || customerName || 'Walk-in Customer'

    const filteredCustomers = useMemo(() => {
        const query = customerQuery.trim().toLowerCase()
        if (!query) return customers.slice(0, 12)

        return customers
            .filter((customer) => {
                const name = String(customer.name || '').toLowerCase()
                const phone = String(customer.phone_number || '').toLowerCase()
                return name.includes(query) || phone.includes(query)
            })
            .slice(0, 12)
    }, [customers, customerQuery])

    const categoryOptions = useMemo(() => {
        const normalized = categories
            .filter((category) => category && category.id)
            .map((category) => ({ id: String(category.id), name: category.name }))

        return [{ id: 'all', name: 'All' }, ...normalized]
    }, [categories])

    const filteredProducts = useMemo(() => {
        const query = search.trim().toLowerCase()

        return products
            .filter((product) => {
                if (categoryFilter !== 'all' && String(product.category_id) !== String(categoryFilter)) {
                    return false
                }

                if (!query) return true

                const name = String(product.name || '').toLowerCase()
                const sku = String(product.code || '').toLowerCase()
                const barcode = String(product.barcode || '').toLowerCase()

                return name.includes(query) || sku.includes(query) || barcode.includes(query)
            })
            .slice(0, 120)
    }, [products, search, categoryFilter])

    const noProductsReason = useMemo(() => {
        if (search.trim()) return 'search'
        if (categoryFilter !== 'all') return 'category'
        return 'empty'
    }, [search, categoryFilter])

    const cartUnits = useMemo(
        () => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        [cart]
    )

    const lowStockCount = useMemo(
        () => filteredProducts.filter((product) => {
            const stock = Number(product.current_stock || 0)
            const minStock = Number(product.min_stock_level || 5)
            return stock > 0 && stock <= minStock
        }).length,
        [filteredProducts]
    )

    const getCartQuantity = useCallback((productId) => {
        const item = cart.find((entry) => String(entry.product_id) === String(productId))
        return item?.quantity || 0
    }, [cart])

    const openCartDrawerIfNeeded = useCallback(() => {
        if (!isDesktopCart) setCartOpen(true)
    }, [isDesktopCart])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [productsRes, customersRes, categoriesRes] = await Promise.all([
                productsAPI.list({ limit: 500 }),
                customersAPI.list({ limit: 500 }),
                categoriesAPI.list().catch(() => ({ data: [] })),
            ])

            setProducts(productsRes.data || [])
            setCustomers(customersRes.data || [])
            setCategories(categoriesRes.data || categoriesRes || [])
        } catch (error) {
            toast.error('Failed to load POS data')
            console.error('POS load error:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const loadQuotation = useCallback(async (quotationIdToLoad) => {
        try {
            const response = await quotationsAPI.get(quotationIdToLoad)
            loadFromQuotation(response.data)
            toast.success('Quotation loaded into cart')
            openCartDrawerIfNeeded()
        } catch (error) {
            toast.error('Failed to load quotation')
            console.error('Quotation load error:', error)
        }
    }, [loadFromQuotation, openCartDrawerIfNeeded])

    const processBarcode = useCallback((code) => {
        const cleanCode = String(code || '').trim()
        if (!cleanCode) return

        const found = products.find((product) => (
            String(product.barcode || '') === cleanCode
            || String(product.code || '').toLowerCase() === cleanCode.toLowerCase()
        ))

        if (!found) {
            toast.error(`Product not found: ${cleanCode}`)
            return
        }

        const result = addItem(found, products)
        if (!result.success) {
            toast.error(result.message)
            return
        }

        setPulseProductId(found.id)
        setBumpItemId(found.id)
        openCartDrawerIfNeeded()
        toast.success(`${found.name} added to cart`)

        if (result.type === 'warning') {
            toast(result.message, { icon: '!' })
        }

        setTimeout(() => {
            setPulseProductId(null)
            setBumpItemId(null)
        }, 420)
    }, [addItem, products, openCartDrawerIfNeeded])

    const handleAddToCart = useCallback((product) => {
        const result = addItem(product, products)

        if (!result.success) {
            toast.error(result.message)
            return
        }

        setPulseProductId(product.id)
        setBumpItemId(product.id)
        openCartDrawerIfNeeded()
        toast.success(`${product.name} added to cart`)

        if (result.type === 'warning') {
            toast(result.message, { icon: '!' })
        }

        setTimeout(() => {
            setPulseProductId(null)
            setBumpItemId(null)
        }, 420)
    }, [addItem, products, openCartDrawerIfNeeded])

    const handleUpdateQuantity = useCallback((productId, quantity, maxStock) => {
        const result = updateQuantity(productId, quantity, maxStock)
        if (!result.success) {
            toast.error(result.message)
            return result
        }

        setBumpItemId(productId)
        setTimeout(() => setBumpItemId(null), 300)
        return result
    }, [updateQuantity])

    const handleRemoveItem = useCallback((productId, productName) => {
        removeItem(productId)
        toast.success(`${productName} removed from cart`)
    }, [removeItem])

    const handleCheckout = useCallback(async () => {
        if (cart.length === 0) {
            toast.error('Add at least one product before checkout')
            return
        }

        if (!customerId && balance > 0) {
            toast.error('Walk-in customers cannot have credit sales')
            return
        }

        if (paidAmount < 0) {
            toast.error('Amount received cannot be negative')
            return
        }

        if (total <= 0) {
            toast.error('Sale total must be greater than 0')
            return
        }

        setSubmitting(true)

        try {
            const saleData = getSaleData()
            const response = await salesAPI.create(saleData)

            if (quotationId) {
                try {
                    await quotationsAPI.updateStatus(quotationId, 'converted')
                } catch (quotationError) {
                    console.warn('Failed to update quotation status:', quotationError)
                }
            }

            emit(DataSyncEvents.SALE_CREATED, response.data)

            if (returnToCustomer > 0) {
                toast.success(`Sale completed. Change: ${formatCurrency(returnToCustomer)}`)
            } else {
                toast.success(`Sale completed. Invoice: ${response.data?.invoice_number || 'N/A'}`)
            }

            clearCart()
            setCustomerMenuOpen(false)
            setBarcodeInputOpen(false)
            navigate(isStandalonePOS ? '/pos' : '/sales')
        } catch (error) {
            toast.error(`Checkout failed: ${error.message}`)
            console.error('Checkout error:', error)
        } finally {
            setSubmitting(false)
        }
    }, [
        cart.length,
        customerId,
        balance,
        paidAmount,
        total,
        getSaleData,
        quotationId,
        returnToCustomer,
        clearCart,
        isStandalonePOS,
        navigate,
    ])

    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen()
            } else {
                await document.exitFullscreen()
            }
        } catch (error) {
            toast.error('Fullscreen is not available in this browser context')
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (location.state?.quotationId && customers.length > 0) {
            loadQuotation(location.state.quotationId)
        }
    }, [location.state?.quotationId, customers.length, loadQuotation])

    useEffect(() => {
        const media = window.matchMedia('(min-width: 1280px)')
        const updateDesktopState = (event) => {
            setIsDesktopCart(event.matches)
            if (event.matches) {
                setCartOpen(false)
            }
        }

        setIsDesktopCart(media.matches)
        media.addEventListener('change', updateDesktopState)
        return () => media.removeEventListener('change', updateDesktopState)
    }, [])

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (customerMenuRef.current && !customerMenuRef.current.contains(event.target)) {
                setCustomerMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        return () => document.removeEventListener('mousedown', handlePointerDown)
    }, [])

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement))
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    useEffect(() => {
        const handleShortcuts = (event) => {
            const targetTag = event.target?.tagName
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)

            if (event.key === '/' && !isTyping) {
                event.preventDefault()
                searchRef.current?.focus()
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                handleCheckout()
            }

            if (event.key === 'Escape') {
                if (!isDesktopCart && cartOpen) {
                    setCartOpen(false)
                }
                setCustomerMenuOpen(false)
                setBarcodeInputOpen(false)
            }
        }

        window.addEventListener('keydown', handleShortcuts)
        return () => window.removeEventListener('keydown', handleShortcuts)
    }, [cartOpen, isDesktopCart, handleCheckout])

    useEffect(() => {
        const handleScannerInput = (event) => {
            const targetTag = event.target?.tagName
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)
            if (isTyping) return

            if (event.key === 'Enter') {
                if (scannerBufferRef.current.length >= 3) {
                    processBarcode(scannerBufferRef.current)
                }
                scannerBufferRef.current = ''
                clearTimeout(scannerTimerRef.current)
                return
            }

            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                scannerBufferRef.current += event.key
                clearTimeout(scannerTimerRef.current)
                scannerTimerRef.current = setTimeout(() => {
                    scannerBufferRef.current = ''
                }, 120)
            }
        }

        window.addEventListener('keydown', handleScannerInput)

        return () => {
            window.removeEventListener('keydown', handleScannerInput)
            clearTimeout(scannerTimerRef.current)
        }
    }, [processBarcode])

    const drawerOpen = !isDesktopCart && cartOpen

    return (
        <div className="pos-page">
            <div className="pos-shell">
                <section className="pos-hero">
                    <div className="pos-hero-copy">
                        <p className="pos-eyebrow">Retail Counter Workspace</p>
                        <h1>Point of Sale</h1>
                        <p>Professional checkout workspace built for high-speed billing in your dark ERP environment.</p>
                    </div>

                    <div className="pos-hero-metrics" aria-label="POS overview">
                        <div className="pos-metric-card">
                            <span>Cart Units</span>
                            <strong>{cartUnits}</strong>
                        </div>
                        <div className="pos-metric-card">
                            <span>Visible Products</span>
                            <strong>{filteredProducts.length}</strong>
                        </div>
                        <div className="pos-metric-card">
                            <span>Low Stock</span>
                            <strong>{lowStockCount}</strong>
                        </div>
                    </div>
                </section>

                <section className="pos-controls">
                    <div className="pos-control-row" ref={customerMenuRef}>
                        <div className="pos-customer-wrap">
                            <button
                                type="button"
                                className="pos-customer-trigger"
                                onClick={() => setCustomerMenuOpen((open) => !open)}
                                aria-expanded={customerMenuOpen}
                                aria-haspopup="listbox"
                                aria-label="Select customer"
                            >
                                <span className="left">
                                    <UserRound size={16} />
                                    <span>{customerDisplayName}</span>
                                </span>
                                <span className={`caret${customerMenuOpen ? ' is-open' : ''}`}>▾</span>
                            </button>

                            {customerMenuOpen && (
                                <div className="pos-customer-menu">
                                    <input
                                        type="text"
                                        value={customerQuery}
                                        onChange={(event) => setCustomerQuery(event.target.value)}
                                        placeholder="Search customer by name or phone"
                                        aria-label="Search customer"
                                    />

                                    <ul role="listbox">
                                        <li>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomer(null, null)
                                                    setCustomerMenuOpen(false)
                                                    setCustomerQuery('')
                                                }}
                                            >
                                                <span>Walk-in Customer</span>
                                                {!customerId && <span className="selected">Selected</span>}
                                            </button>
                                        </li>

                                        {filteredCustomers.map((customer) => (
                                            <li key={customer.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomer(customer.id, customer.name)
                                                        setCustomerMenuOpen(false)
                                                        setCustomerQuery('')
                                                    }}
                                                >
                                                    <span className="name-wrap">
                                                        <span>{customer.name}</span>
                                                        {customer.phone_number && <small>{customer.phone_number}</small>}
                                                    </span>
                                                    {String(customer.id) === String(customerId) && (
                                                        <span className="selected">Selected</span>
                                                    )}
                                                </button>
                                            </li>
                                        ))}

                                        {filteredCustomers.length === 0 && (
                                            <li className="empty">No customers found</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="pos-action-group">
                            {!barcodeInputOpen && (
                                <button
                                    type="button"
                                    className="pos-icon-btn"
                                    onClick={() => {
                                        setBarcodeInputOpen(true)
                                        setTimeout(() => barcodeInputRef.current?.focus(), 40)
                                    }}
                                    aria-label="Open barcode input"
                                >
                                    <ScanLine size={16} />
                                </button>
                            )}

                            {barcodeInputOpen && (
                                <form
                                    className="pos-barcode-form"
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                        processBarcode(barcodeInput)
                                        setBarcodeInput('')
                                        setBarcodeInputOpen(false)
                                    }}
                                >
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        value={barcodeInput}
                                        onChange={(event) => setBarcodeInput(event.target.value)}
                                        placeholder="Scan barcode"
                                        aria-label="Barcode input"
                                    />
                                    <button type="submit" aria-label="Submit barcode">
                                        <ScanLine size={16} />
                                    </button>
                                </form>
                            )}

                            <button
                                type="button"
                                className="pos-icon-btn"
                                onClick={toggleFullscreen}
                                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                            >
                                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="pos-categories" role="tablist" aria-label="Product categories">
                        {categoryOptions.map((category) => {
                            const active = String(categoryFilter) === String(category.id)
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    className={`pos-category-chip${active ? ' is-active' : ''}`}
                                    onClick={() => setCategoryFilter(category.id)}
                                    role="tab"
                                    aria-selected={active}
                                >
                                    {category.name}
                                </button>
                            )
                        })}
                    </div>
                </section>

                <section className="pos-content-grid">
                    <div className="pos-products-panel">
                        <header className="pos-panel-head">
                            <div className="pos-panel-title">
                                <h2>Products</h2>
                                <p>{filteredProducts.length} products visible in current filters</p>
                            </div>

                            <div className="pos-panel-actions">
                                <div className="pos-search-row">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search by product name, SKU, or barcode"
                                        aria-label="Search products"
                                    />
                                    <span className="search-hint">
                                        <Command size={12} />
                                        /
                                    </span>
                                </div>

                                <div className="pos-shortcut-list">
                                    <span>Ctrl/Cmd + Enter Checkout</span>
                                </div>
                            </div>
                        </header>

                        <div className="pos-products-scroll">
                            {loading ? (
                                <ProductSkeletonGrid />
                            ) : filteredProducts.length > 0 ? (
                                <div className="pos-product-grid">
                                    {filteredProducts.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            cartQuantity={getCartQuantity(product.id)}
                                            pulse={pulseProductId === product.id}
                                            onAdd={handleAddToCart}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="pos-empty-products">
                                    {noProductsReason === 'search' && <Search size={24} />}
                                    {noProductsReason === 'category' && <ShoppingCart size={24} />}
                                    {noProductsReason === 'empty' && <CircleOff size={24} />}

                                    <p>
                                        {noProductsReason === 'search' && 'No products match your search'}
                                        {noProductsReason === 'category' && 'No products in this category'}
                                        {noProductsReason === 'empty' && 'No products available'}
                                    </p>
                                    <span>
                                        {noProductsReason === 'search' && 'Try another name, SKU, or barcode.'}
                                        {noProductsReason === 'category' && 'Switch category or add products to this category.'}
                                        {noProductsReason === 'empty' && 'Create products first to start billing.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pos-cart-column">
                        <CartPanel
                            isDrawer={false}
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
                            bumpItemId={bumpItemId}
                            onUpdateQuantity={handleUpdateQuantity}
                            onRemoveItem={handleRemoveItem}
                            onSetDiscount={(value) => setGlobalDiscount(value, globalDiscountType)}
                            onSetDiscountType={(type) => setGlobalDiscount(globalDiscount, type)}
                            onSetTaxRate={setTaxRate}
                            onSetPaymentMethod={setPaymentMethod}
                            onSetPaidAmount={setPaidAmount}
                            onCheckout={handleCheckout}
                            isSubmitting={submitting}
                        />
                    </div>
                </section>
            </div>

            {!isDesktopCart && (
                <button
                    type="button"
                    className="pos-mobile-cart-btn"
                    onClick={() => setCartOpen(true)}
                    aria-label="Open cart"
                >
                    <ShoppingCart size={22} />
                    {cart.length > 0 && <span>{cart.length}</span>}
                </button>
            )}

            {drawerOpen && (
                <>
                    <button
                        type="button"
                        className="pos-drawer-overlay"
                        onClick={() => setCartOpen(false)}
                        aria-label="Close cart drawer"
                    />
                    <div className="pos-drawer-panel">
                        <CartPanel
                            isDrawer={true}
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
                            bumpItemId={bumpItemId}
                            onClose={() => setCartOpen(false)}
                            onUpdateQuantity={handleUpdateQuantity}
                            onRemoveItem={handleRemoveItem}
                            onSetDiscount={(value) => setGlobalDiscount(value, globalDiscountType)}
                            onSetDiscountType={(type) => setGlobalDiscount(globalDiscount, type)}
                            onSetTaxRate={setTaxRate}
                            onSetPaymentMethod={setPaymentMethod}
                            onSetPaidAmount={setPaidAmount}
                            onCheckout={handleCheckout}
                            isSubmitting={submitting}
                        />
                    </div>
                </>
            )}
        </div>
    )
}

export default NewSale
