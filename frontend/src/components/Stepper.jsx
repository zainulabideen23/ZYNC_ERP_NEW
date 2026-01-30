/**
 * Custom Stepper Component - Pill-shaped with +/- buttons
 * No browser default number arrows
 */
function Stepper({ value, onChange, min = 1, max = 999, disabled = false }) {
    const handleIncrement = () => {
        if (value < max) onChange(value + 1)
    }

    const handleDecrement = () => {
        if (value > min) onChange(value - 1)
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--color-bg-tertiary)',
            borderRadius: '24px',
            padding: '4px',
            border: '1px solid var(--color-border)',
            width: 'fit-content'
        }}>
            <button
                onClick={handleDecrement}
                disabled={disabled || value <= min}
                className="btn btn-ghost btn-sm"
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    padding: 0,
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value <= min ? 0.4 : 1
                }}
            >
                −
            </button>
            <input
                type="number"
                value={value}
                onChange={(e) => {
                    const val = parseInt(e.target.value) || min
                    if (val >= min && val <= max) onChange(val)
                }}
                disabled={disabled}
                style={{
                    width: '60px',
                    textAlign: 'center',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '1rem',
                    fontWeight: 600,
                    outline: 'none'
                }}
                className="no-spinner"
            />
            <button
                onClick={handleIncrement}
                disabled={disabled || value >= max}
                className="btn btn-ghost btn-sm"
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    padding: 0,
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value >= max ? 0.4 : 1
                }}
            >
                +
            </button>
        </div>
    )
}

export default Stepper
