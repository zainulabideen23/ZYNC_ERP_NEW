export default function PageLoader() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            background: 'var(--color-bg)',
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                {/* Spinner Ring */}
                <div style={{
                    position: 'relative',
                    width: 72, height: 72,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '50%',
                        border: '4px solid var(--border-surface)',
                        opacity: 0.3,
                    }} />
                    <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '50%',
                        border: '4px solid transparent',
                        borderTopColor: '#3b82f6',
                        borderRightColor: '#7c3aed',
                        borderBottomColor: '#ec4899',
                        animation: 'zyncSpin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    }} />
                    <div style={{
                        position: 'absolute', inset: '6px',
                        borderRadius: '50%',
                        border: '3px solid transparent',
                        borderLeftColor: '#3b82f6',
                        borderBottomColor: '#7c3aed',
                        animation: 'zyncSpin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse',
                    }} />
                    {/* Logo mark in center */}
                    <span style={{
                        fontSize: '20px',
                        fontWeight: 900,
                        letterSpacing: '-0.04em',
                        background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        zIndex: 1,
                    }}>Z</span>
                </div>

                {/* ZYNC Brand */}
                <div style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #ec4899 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'zyncPulse 2.5s ease-in-out infinite',
                    textShadow: '0 0 40px rgba(59,130,246,0.15)',
                }}>
                    ZYNC
                </div>

                {/* Subtitle */}
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-hint)',
                    fontWeight: 500,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    animation: 'zyncFade 2s ease-in-out infinite',
                }}>
                    Loading...
                </div>
            </div>

            <style>{`
                @keyframes zyncSpin {
                    to { transform: rotate(360deg); }
                }
                @keyframes zyncPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.85; transform: scale(1.03); }
                }
                @keyframes zyncFade {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    )
}
