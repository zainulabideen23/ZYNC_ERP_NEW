/**
 * Status Badge Component with Neon Glow Effect
 * PAID: Emerald green glow
 * OUT OF STOCK: Rose/red glow
 * PARTIAL: Amber/warning glow
 */
function StatusBadge({ status, label, customColor }) {
    const statusStyles = {
        paid: {
            bg: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            glow: '0 0 12px rgba(16, 185, 129, 0.5)'
        },
        out_of_stock: {
            bg: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            glow: '0 0 12px rgba(239, 68, 68, 0.5)'
        },
        partial: {
            bg: 'rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            glow: '0 0 12px rgba(251, 191, 36, 0.5)'
        },
        unpaid: {
            bg: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            glow: '0 0 12px rgba(239, 68, 68, 0.5)'
        },
        low_stock: {
            bg: 'rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            glow: '0 0 12px rgba(251, 191, 36, 0.5)'
        },
        in_stock: {
            bg: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            glow: '0 0 12px rgba(16, 185, 129, 0.5)'
        }
    }

    const style = statusStyles[status] || statusStyles.in_stock

    return (
        <span style={{
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: '8px',
            background: customColor?.bg || style.bg,
            color: customColor?.color || style.color,
            border: `1px solid ${customColor?.color || style.color}`,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: customColor?.glow || style.glow,
            transition: 'all 0.2s'
        }}>
            {label || status.replace(/_/g, ' ')}
        </span>
    )
}

export default StatusBadge
