import './pos.css'

/**
 * Quick Amount Buttons for fast cash payment entry
 * Shows exact amount and rounded amounts for quick selection
 */
export default function QuickAmountButtons({ total, onSelect, selectedAmount }) {
    if (total <= 0) return null

    // Generate smart suggestions
    const exact = Math.ceil(total)
    const suggestions = [
        exact,
        Math.ceil(total / 50) * 50,
        Math.ceil(total / 100) * 100,
        Math.ceil(total / 500) * 500,
        Math.ceil(total / 1000) * 1000,
    ]
        .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        .filter(v => v >= exact) // Only amounts >= total
        .slice(0, 4) // Max 4 buttons

    return (
        <div className="quick-amounts">
            {suggestions.map((amount, idx) => {
                const isSelected = selectedAmount === amount
                return (
                    <button
                        key={amount}
                        type="button"
                        className={`quick-amount-btn ${idx === 0 ? 'exact' : ''} ${isSelected ? 'active-green-border' : ''}`}
                        onClick={() => onSelect(amount)}
                        aria-label={`Pay Rs ${amount.toLocaleString()}`}
                        style={isSelected ? { borderColor: '#10b981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' } : {}}
                    >
                        {idx === 0 && <span className="quick-label">Exact</span>}
                        Rs. {amount.toLocaleString()}
                    </button>
                )
            })}
        </div>
    )
}
