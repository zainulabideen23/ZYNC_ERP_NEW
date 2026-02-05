import './pos.css'

/**
 * Quantity Stepper Component
 * Plus/minus buttons with quantity display
 */
export function QuantityStepper({ value, onChange, min = 1, max }) {
    const handleDecrement = () => {
        onChange(Math.max(min - 1, value - 1)) // Allow going to 0 to remove
    }

    const handleIncrement = () => {
        if (max !== undefined && value >= max) return
        onChange(value + 1)
    }

    return (
        <div className="qty-stepper" role="spinbutton" aria-valuenow={value} aria-valuemin={min}>
            <button
                type="button"
                className="qty-btn"
                onClick={handleDecrement}
                aria-label="Decrease quantity"
            >
                −
            </button>
            <span className="qty-value">{value}</span>
            <button
                type="button"
                className="qty-btn"
                onClick={handleIncrement}
                disabled={max !== undefined && value >= max}
                aria-label="Increase quantity"
            >
                +
            </button>
        </div>
    )
}

/**
 * Payment Method Toggle Component
 * Segmented button for payment method selection
 */
export function PaymentToggle({ value, onChange }) {
    const methods = [
        { id: 'cash', label: '💵 Cash', shortLabel: '💵' },
        { id: 'bank_transfer', label: '🏦 Bank', shortLabel: '🏦' },
        { id: 'credit', label: '💳 Credit', shortLabel: '💳' }
    ]

    return (
        <div className="payment-toggle" role="radiogroup" aria-label="Payment method">
            {methods.map(method => (
                <button
                    key={method.id}
                    type="button"
                    className={`payment-option ${value === method.id ? 'active' : ''}`}
                    onClick={() => onChange(method.id)}
                    role="radio"
                    aria-checked={value === method.id}
                >
                    {method.label}
                </button>
            ))}
        </div>
    )
}

/**
 * Category Tabs for filtering products
 */
export function CategoryTabs({ categories, activeCategory, onChange }) {
    return (
        <div className="category-tabs" role="tablist">
            <button
                type="button"
                className={`category-tab ${!activeCategory ? 'active' : ''}`}
                onClick={() => onChange(null)}
                role="tab"
                aria-selected={!activeCategory}
            >
                All
            </button>
            {categories.map(cat => (
                <button
                    key={cat.id}
                    type="button"
                    className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => onChange(cat.id)}
                    role="tab"
                    aria-selected={activeCategory === cat.id}
                >
                    {cat.name}
                </button>
            ))}
        </div>
    )
}
