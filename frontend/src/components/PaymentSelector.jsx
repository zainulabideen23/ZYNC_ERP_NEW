/**
 * Payment Method Selector - Segmented toggle buttons
 * Cash | Card | Credit style
 */
function PaymentSelector({ value, onChange, disabled = false }) {
    const methods = [
        { value: 'cash', label: '💵 Cash', icon: '💵' },
        { value: 'bank', label: '🏦 Card', icon: '🏦' },
        { value: 'cheque', label: '🎫 Cheque', icon: '🎫' }
    ]

    return (
        <div style={{
            display: 'inline-flex',
            background: 'var(--color-bg-tertiary)',
            borderRadius: '12px',
            padding: '4px',
            border: '1px solid var(--color-border)',
            width: '100%'
        }}>
            {methods.map((method) => (
                <button
                    key={method.value}
                    onClick={() => !disabled && onChange(method.value)}
                    disabled={disabled}
                    style={{
                        flex: 1,
                        padding: '10px 16px',
                        border: 'none',
                        background: value === method.value ? 'var(--color-accent)' : 'transparent',
                        color: value === method.value ? '#fff' : 'var(--color-text)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: value === method.value ? 600 : 400,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: disabled ? 0.5 : 1
                    }}
                >
                    {method.label}
                </button>
            ))}
        </div>
    )
}

export default PaymentSelector
