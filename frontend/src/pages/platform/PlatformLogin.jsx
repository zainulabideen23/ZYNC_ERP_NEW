import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatformAuthStore } from '../../store/platform.auth.store'
import { platformAuthAPI } from '../../services/platform.api'
import { Shield, Eye, EyeOff } from 'lucide-react'

export default function PlatformLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { login } = usePlatformAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await platformAuthAPI.login(email.trim(), password)
            login(res.data.admin, res.data.token)
            navigate('/platform/dashboard')
        } catch (err) {
            setError(err.message || 'Invalid credentials')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
        }}>
            <div style={{
                width: 400,
                padding: 40,
                borderRadius: 16,
                background: 'var(--color-panel)',
                border: '1px solid var(--border-surface)',
                boxShadow: 'var(--elevation-3)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 14,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 16,
                        boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
                    }}>
                        <Shield size={28} color="#fff" />
                    </div>
                    <h1 style={{
                        fontSize: 22, fontWeight: 700, color: 'var(--color-text)',
                        margin: 0, letterSpacing: 0.3,
                    }}>
                        ZYNC Platform Admin
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '8px 0 0' }}>
                        Sign in to manage tenants
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#fca5a5',
                        fontSize: 13,
                        marginBottom: 20,
                    }}>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{
                            display: 'block', fontSize: 13, fontWeight: 500,
                            color: 'var(--color-muted)', marginBottom: 6,
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@zyncerp.com"
                            required
                            style={{
                                width: '100%', padding: '10px 14px',
                                borderRadius: 8, fontSize: 14,
                                background: 'var(--color-bg)',
                                border: '1px solid var(--border-surface)',
                                color: 'var(--color-text)', outline: 'none',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box', fontFamily: 'inherit',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{
                            display: 'block', fontSize: 13, fontWeight: 500,
                            color: 'var(--color-muted)', marginBottom: 6,
                        }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{
                                    width: '100%', padding: '10px 40px 10px 14px',
                                    borderRadius: 8, fontSize: 14,
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--border-surface)',
                                    color: 'var(--color-text)', outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box', fontFamily: 'inherit',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: 10, top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none', border: 'none',
                                    color: 'var(--color-muted)', cursor: 'pointer', padding: 2,
                                }}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '12px',
                            borderRadius: 8, fontSize: 14, fontWeight: 600,
                            background: loading
                                ? 'rgba(99,102,241,0.4)'
                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none', color: '#fff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)',
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center', fontSize: 11, color: 'var(--color-hint)',
                    marginTop: 24, marginBottom: 0,
                }}>
                    This area is restricted to platform administrators only.
                </p>
            </div>
        </div>
    )
}
