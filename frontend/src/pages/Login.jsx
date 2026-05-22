import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'
import { authAPI } from '../services/api'
import { Building2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import './Login.css'

function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [tenant, setTenant] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!username || !password) {
            setError('Please enter username and password')
            return
        }

        setLoading(true)
        try {
            const response = await authAPI.login({ username, password, tenant: tenant || undefined })
            login(response.data.user, response.data.token, response.data.tenant)
            toast.success('Welcome back!')
            navigate('/')
        } catch (err) {
            setError(err.message || 'Invalid credentials')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand">
                    <div className="login-icon">
                        <Building2 size={28} color="#fff" />
                    </div>
                    <h1 className="login-title">ZYNC ERP</h1>
                    <p className="login-subtitle">Sign in to your company account</p>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label">Company Code</label>
                        <input
                            type="text"
                            className="form-input"
                            value={tenant}
                            onChange={(e) => setTenant(e.target.value.toLowerCase())}
                            placeholder="default"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                style={{ paddingRight: 40 }}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary login-btn"
                        disabled={loading}
                    >
                        {loading ? <div className="spinner" /> : 'Sign In'}
                    </button>
                </form>

                <div className="login-footer">
                    <p className="login-credentials">
                        Demo: <strong>admin</strong> / <strong>admin123</strong>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
