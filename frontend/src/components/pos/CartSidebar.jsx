import { useState, useEffect, useRef, useCallback } from 'react'
import { QuantityStepper } from './POSControls'
import QuickAmountButtons from './QuickAmountButtons'
import { PaymentToggle } from './POSControls'
import './pos.css'

/**
 * Cart Sidebar / Drawer Component
 * Slide-over drawer on screens < 1440px, docked panel on ultra-wide
 * Features: Auto-open on add, keyboard shortcuts, proper 3-panel layout
 */
export default function CartSidebar({
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
    onUpdateQuantity,
    onRemoveItem,
    onSetDiscount,
    onSetDiscountType,
    onSetTaxRate,
    onSetPaymentMethod,
    onSetPaidAmount,
    onCheckout,
    isSubmitting = false,
    lastAddedProductId = null,
    // Drawer mode props
    isOpen = true,
    onClose,
    onToggle
}) {
    const isEmpty = items.length === 0
    const [selectedItemId, setSelectedItemId] = useState(null)
    const [flashingItemId, setFlashingItemId] = useState(null)
    const [adjustOpen, setAdjustOpen] = useState(false)
    const itemRefs = useRef({})
    const sidebarRef = useRef(null)
    const checkoutBtnRef = useRef(null)

    // Flash effect when item is added/updated
    useEffect(() => {
        if (lastAddedProductId) {
            setFlashingItemId(lastAddedProductId)
            setSelectedItemId(lastAddedProductId)

            // Scroll to the item
            itemRefs.current[lastAddedProductId]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            })

            const timer = setTimeout(() => setFlashingItemId(null), 500)
            return () => clearTimeout(timer)
        }
    }, [lastAddedProductId])

    // Keyboard shortcuts for drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Escape to close drawer
            if (e.key === 'Escape' && isOpen && onClose) {
                e.preventDefault()
                onClose()
            }
            // F9 to toggle drawer
            if (e.key === 'F9' && onToggle) {
                e.preventDefault()
                onToggle()
            }
            // Enter to complete sale when cart is open and valid
            if (e.key === 'Enter' && isOpen && !isEmpty && !isSubmitting) {
                // Only if not in an input field
                if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                    e.preventDefault()
                    onCheckout()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, isEmpty, isSubmitting, onClose, onToggle, onCheckout])

    // Handle row click - select for editing
    const handleRowClick = (productId) => {
        setSelectedItemId(prev => prev === productId ? null : productId)
    }

    // Handle keyboard navigation
    const handleRowKeyDown = (e, productId, index) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleRowClick(productId)
        } else if (e.key === 'ArrowDown' && index < items.length - 1) {
            e.preventDefault()
            const nextId = items[index + 1].product_id
            setSelectedItemId(nextId)
            itemRefs.current[nextId]?.focus()
        } else if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault()
            const prevId = items[index - 1].product_id
            setSelectedItemId(prevId)
            itemRefs.current[prevId]?.focus()
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault()
            onRemoveItem(productId)
        }
    }

    // Handle overlay click to close
    const handleOverlayClick = useCallback((e) => {
        if (e.target === e.currentTarget && onClose) {
            onClose()
        }
    }, [onClose])

    return (
        <>
            {/* Backdrop overlay for drawer mode (only visible on non-ultra-wide) */}
            <div
                className={`cart-overlay ${isOpen ? 'open' : ''}`}
                onClick={handleOverlayClick}
                aria-hidden="true"
            />

            <aside
                ref={sidebarRef}
                className={`cart-sidebar ${isOpen ? 'open' : ''}`}
                aria-label="Shopping cart"
                aria-hidden={!isOpen}
            >
                {/* Cart Header - FIXED */}
                <div className="cart-header">
                    <h2>🛒 Cart</h2>
                    <div className="cart-header-right">
                        <span className="cart-count">{items.length} items</span>
                        {/* Close button for drawer mode */}
                        {onClose && (
                            <button
                                type="button"
                                className="cart-close-btn"
                                onClick={onClose}
                                aria-label="Close cart"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Cart Items - SCROLLABLE */}
                <div className="cart-items" role="list">
                    {isEmpty ? (
                        <div className="cart-empty">
                            <div className="cart-empty-icon">📦</div>
                            <div className="cart-empty-text">Cart is empty</div>
                            <div className="cart-empty-hint">Click products to add</div>
                        </div>
                    ) : (
                        items.map((item, index) => {
                            const isSelected = selectedItemId === item.product_id
                            const isFlashing = flashingItemId === item.product_id

                            return (
                                <div
                                    key={item.product_id}
                                    ref={el => itemRefs.current[item.product_id] = el}
                                    className={`cart-item ${isSelected ? 'selected' : ''} ${isFlashing ? 'flashing' : ''}`}
                                    onClick={() => handleRowClick(item.product_id)}
                                    onKeyDown={(e) => handleRowKeyDown(e, item.product_id, index)}
                                    role="listitem"
                                    tabIndex={0}
                                    aria-selected={isSelected}
                                >
                                    {/* Left accent bar for selected state */}
                                    <div className="cart-item-accent" aria-hidden="true" />

                                    <div className="cart-item-main">
                                        <div className="cart-item-thumb">
                                            {item.code?.substring(0, 3)}
                                        </div>
                                        <div className="cart-item-info">
                                            <div className="cart-item-name">{item.name}</div>
                                            <div className="cart-item-meta">
                                                <span className="cart-item-price">
                                                    Rs. {item.unit_price.toLocaleString()}
                                                </span>
                                                <span className="cart-item-qty-label">
                                                    × {item.quantity}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="cart-item-total">
                                            Rs. {(item.unit_price * item.quantity).toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Inline controls - only visible when selected */}
                                    <div
                                        className={`cart-item-controls ${isSelected ? 'visible' : ''}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <QuantityStepper
                                            value={item.quantity}
                                            onChange={(qty) => onUpdateQuantity(item.product_id, qty, item.max_stock)}
                                            max={item.max_stock}
                                        />
                                        <button
                                            type="button"
                                            className="cart-item-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onRemoveItem(item.product_id)
                                            }}
                                            aria-label={`Remove ${item.name}`}
                                        >
                                            🗑️ Remove
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Order Summary - REGION 3: Fixed Footer */}
                {!isEmpty && (
                    <div className="cart-summary">
                        {/* Subtotal - Always visible */}
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span className="mono">Rs. {subtotal.toLocaleString()}</span>
                        </div>

                        {/* Collapsible Adjust Section */}
                        <button
                            type="button"
                            className={`adjust-toggle ${adjustOpen ? 'open' : ''}`}
                            onClick={() => setAdjustOpen(!adjustOpen)}
                            aria-expanded={adjustOpen}
                        >
                            <span>⚙️ Adjust Discount / Tax</span>
                            <span className="adjust-toggle-icon">▼</span>
                        </button>

                        <div className={`adjust-content ${adjustOpen ? 'open' : ''}`}>
                            {/* Discount Input */}
                            <div className="summary-input-row">
                                <label>Discount</label>
                                <div className="discount-input-group">
                                    <input
                                        type="number"
                                        value={globalDiscount || ''}
                                        onChange={(e) => onSetDiscount(Number(e.target.value) || 0)}
                                        placeholder="0"
                                        min="0"
                                    />
                                    <select
                                        value={globalDiscountType}
                                        onChange={(e) => onSetDiscountType(e.target.value)}
                                    >
                                        <option value="amount">Rs</option>
                                        <option value="percent">%</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tax Input */}
                            <div className="summary-input-row">
                                <label>Tax Rate</label>
                                <div className="tax-input-group">
                                    <input
                                        type="number"
                                        value={taxRate || ''}
                                        onChange={(e) => onSetTaxRate(Number(e.target.value) || 0)}
                                        placeholder="0"
                                        min="0"
                                        step="0.5"
                                    />
                                    <span className="input-suffix">%</span>
                                </div>
                            </div>
                        </div>

                        {/* Applied discount/tax shown outside toggle */}
                        {discountAmount > 0 && (
                            <div className="summary-row discount">
                                <span>Discount</span>
                                <span>− Rs. {discountAmount.toLocaleString()}</span>
                            </div>
                        )}

                        {taxAmount > 0 && (
                            <div className="summary-row tax">
                                <span>Tax ({taxRate}%)</span>
                                <span>+ Rs. {Math.round(taxAmount).toLocaleString()}</span>
                            </div>
                        )}

                        {/* Total - Always visible */}
                        <div className="summary-total">
                            <span>Total</span>
                            <span className="mono">Rs. {Math.round(total).toLocaleString()}</span>
                        </div>

                        {/* Payment Section */}
                        <div className="payment-section">
                            <label>Payment Method</label>
                            <PaymentToggle value={paymentMethod} onChange={onSetPaymentMethod} />

                            <label>Amount Received</label>
                            <input
                                type="number"
                                className="paid-input"
                                value={paidAmount || ''}
                                onChange={(e) => onSetPaidAmount(Number(e.target.value) || 0)}
                                placeholder="0"
                                min="0"
                            />

                            {/* Quick Amount Buttons */}
                            {paymentMethod === 'cash' && (
                                <QuickAmountButtons
                                    total={total}
                                    onSelect={onSetPaidAmount}
                                    selectedAmount={paidAmount}
                                />
                            )}

                            {/* Balance Display */}
                            {paidAmount > 0 && (
                                <div className={`balance-display ${balance > 0 ? 'credit' : 'change'}`}>
                                    <div className="balance-label">
                                        {balance > 0 ? '💳 Due Amount' : '💰 Return to Customer'}
                                    </div>
                                    <div className="balance-amount">
                                        Rs. {Math.abs(Math.round(balance)).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Checkout Button */}
                        <button
                            type="button"
                            className="checkout-btn"
                            onClick={onCheckout}
                            disabled={isSubmitting || isEmpty}
                            ref={checkoutBtnRef}
                        >
                            {isSubmitting ? '⏳ Processing...' : '✓ Complete Sale'}
                        </button>

                        {/* Keyboard hints */}
                        <div className="cart-hints">
                            <span>Esc close</span>
                            <span>F9 toggle</span>
                            <span>Enter checkout</span>
                        </div>
                    </div>
                )}
            </aside>
        </>
    )
}
