import { useAuthStore } from '../store/auth.store'

/**
 * ImpersonationBanner
 *
 * Renders a bright orange banner at the top of the tenant app when
 * the current JWT has type: "impersonation".
 *
 * Decodes the JWT payload (without verification — just for display)
 * to check the `type` field.
 */
export default function ImpersonationBanner() {
    const { token, tenant, user, logout } = useAuthStore()

    if (!token) return null

    // Decode JWT payload without verification (just to read the type field)
    let payload = null
    try {
        const parts = token.split('.')
        if (parts.length === 3) {
            payload = JSON.parse(atob(parts[1]))
        }
    } catch {
        return null
    }

    if (!payload || payload.type !== 'impersonation') return null

    const handleExit = () => {
        logout()
        // Try to close the tab (works if we opened it)
        window.close()
        // Fallback: redirect to platform
        window.location.hash = '#/platform/login'
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: 'linear-gradient(90deg, #ea580c, #f97316, #ea580c)',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(234,88,12,0.4)',
        }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span>IMPERSONATION MODE</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 400 }}>|</span>
            <span style={{ fontWeight: 400 }}>Viewing: {tenant?.name || 'Unknown Tenant'}</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 400 }}>|</span>
            <span style={{ fontWeight: 400 }}>Logged in as: {user?.username || 'admin'}</span>
            <button
                onClick={handleExit}
                style={{
                    marginLeft: 12,
                    padding: '4px 14px',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
                Exit Impersonation
            </button>
        </div>
    )
}
