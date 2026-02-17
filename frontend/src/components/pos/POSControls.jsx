import { useState, useEffect } from 'react'
import './pos.css'

/**
 * Quantity Stepper Component
 * Plus/minus buttons with editable quantity input
 */
export function QuantityStepper({ value, onChange, min = 1, max }) {
    const [inputValue, setInputValue] = useState(value.toString())

    // Sync inputValue when value prop changes externally
    useEffect(() => {
        setInputValue(value.toString())
    }, [value])

    const handleDecrement = () => {
        const newValue = Math.max(min - 1, value - 1) // Allow going to 0 to remove
        onChange(newValue)
        setInputValue(newValue.toString())
    }

    const handleIncrement = () => {
        if (max !== undefined && value >= max) return
        const newValue = value + 1
        onChange(newValue)
        setInputValue(newValue.toString())
    }

    const handleInputChange = (e) => {
        const val = e.target.value
        setInputValue(val)

        // Parse and validate on each change
        const parsed = parseInt(val, 10)
        if (!isNaN(parsed) && parsed >= 0) {
            const clamped = max !== undefined ? Math.min(parsed, max) : parsed
            onChange(clamped)
        }
    }

    const handleInputBlur = () => {
        // On blur, ensure the input shows the actual value
        const parsed = parseInt(inputValue, 10)
        if (isNaN(parsed) || parsed < 0) {
            setInputValue(value.toString())
        } else {
            const clamped = max !== undefined ? Math.min(parsed, max) : parsed
            setInputValue(clamped.toString())
            onChange(clamped)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur()
        }
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
            <input
                type="number"
                className="qty-input"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                min={0}
                max={max}
                aria-label="Quantity"
            />
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
