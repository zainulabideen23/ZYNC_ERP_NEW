import { memo, useState, useEffect, useRef } from 'react'
import './pos.css'

/**
 * Product Card Component for POS Grid
 * Displays product info with stock status and in-cart indicator
 * Features: Just-added pulse animation, persistent in-cart pill, selection states
 */
const ProductCard = memo(function ProductCard({ 
    product, 
    cartQuantity = 0, 
    onAdd, 
    isFocused = false,
    isSelected = false,
    priceLabel = 'Price',
    priceValue,
    allowOutOfStock = false  // For purchases, allow clicking out-of-stock items
}) {
    const [justAdded, setJustAdded] = useState(false)
    const prevQuantityRef = useRef(cartQuantity)
    
    const stock = product.current_stock || 0
    const isOutOfStock = stock <= 0
    const isLowStock = stock > 0 && stock <= (product.min_stock_level || 5)
    const inCart = cartQuantity > 0
    
    // For purchases, out of stock items are still clickable
    const isDisabled = isOutOfStock && !allowOutOfStock

    // Detect when quantity increases (item just added)
    useEffect(() => {
        if (cartQuantity > prevQuantityRef.current) {
            setJustAdded(true)
            const timer = setTimeout(() => setJustAdded(false), 400)
            return () => clearTimeout(timer)
        }
        prevQuantityRef.current = cartQuantity
    }, [cartQuantity])

    const handleClick = () => {
        if (!isDisabled) {
            onAdd(product)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
        }
    }

    // Build class names - don't apply out-of-stock styling if allowOutOfStock is true
    const classNames = [
        'product-card',
        inCart && 'in-cart',
        isDisabled && 'out-of-stock',
        isLowStock && !isOutOfStock && 'low-stock',
        isFocused && 'focused',
        isSelected && 'selected',
        justAdded && 'just-added'
    ].filter(Boolean).join(' ')

    const displayPrice = priceValue !== undefined ? priceValue : product.retail_price

    return (
        <button
            className={classNames}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            aria-label={`${product.name}, Rs ${product.retail_price}, ${isOutOfStock ? 'out of stock' : `${stock} in stock`}${inCart ? `, ${cartQuantity} in cart` : ''}`}
            aria-pressed={isSelected}
            tabIndex={0}
        >
            {/* In-cart pill indicator - Strong visual, top-right */}
            {inCart && (
                <div className="in-cart-pill" aria-label={`${cartQuantity} in cart`}>
                    <span className="pill-icon">🛒</span>
                    <span className="pill-qty">{cartQuantity}</span>
                </div>
            )}

            {/* Product name */}
            <div className="product-name" title={product.name}>
                {product.name}
            </div>

            {/* Product code */}
            <div className="product-code">
                {product.code}
            </div>

            {/* Stock badge */}
            <div className={`stock-badge ${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock'}`}>
                {isOutOfStock ? '✕ Out of Stock' : isLowStock ? `⚠ Low: ${stock}` : `Stock: ${stock}`}
            </div>

            {/* Price */}
            <div className="product-price">
                {priceLabel !== 'Price' && <span className="price-label">{priceLabel}: </span>}
                Rs. {Number(displayPrice).toLocaleString()}
            </div>

            {/* Just-added flash overlay */}
            {justAdded && <div className="added-flash" aria-hidden="true" />}
        </button>
    )
})

export default ProductCard
