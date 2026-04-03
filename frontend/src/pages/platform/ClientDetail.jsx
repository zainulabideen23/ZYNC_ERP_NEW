import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { platformTenantsAPI } from '../../services/platform.api'
import {
    ArrowLeft, Building2, Users, ShoppingCart, Package, DollarSign,
    Receipt, Power, UserCheck, AlertTriangle, X, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ClientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [tenant, setTenant] = useState(null)
    const [loading, setLoading] = useState(true)
    const [impersonateModal, setImpersonateModal] = useState(false)
    const [impersonating, setImpersonating] = useState(false)
    const [toggleLoading, setToggleLoading] = useState(false)

    useEffect(() => { loadTenant() }, [id])

    const loadTenant = async () => {
        try {
            const res = await platformTenantsAPI.get(id)
            setTenant(res.data)
        } catch (err) {
            toast.error('Failed to load client')
            navigate('/platform/clients')
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async () => {
        setToggleLoading(true)
        try {
            if (tenant.is_active) {
                await platformTenantsAPI.deactivate(id)
                toast.success('Client deactivated')
            } else {
                await platformTenantsAPI.activate(id)
                toast.success('Client activated')
            }
            loadTenant()
        } catch (err) {
            toast.error(err.message)
        } finally {
            setToggleLoading(false)
        }
    }

    const handleImpersonate = async () => {
        setImpersonating(true)
        try {
            const res = await platformTenantsAPI.impersonate(id)
            const { token } = res.data
            // Open tenant app in new tab with impersonation token
            const url = `${window.location.origin}/#/impersonate?token=${encodeURIComponent(token)}`
            window.open(url, '_blank')
            setImpersonateModal(false)
            toast.success('Impersonation tab opened')
        } catch (err) {
            toast.error(err.message || 'Failed to impersonate')
        } finally {
            setImpersonating(false)
        }
    }

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>Loading...</div>
    }

    if (!tenant) return null

    const status = getStatusInfo(tenant)
    const planColor = planColors[tenant.plan] || planColors.basic

    const stats = [
        { label: 'Users', value: tenant.user_count || 0, max: tenant.max_users, icon: Users, color: '#818cf8', bg: 'rgba(99,102,241,0.1)' },
        { label: 'Products', value: tenant.product_count || 0, icon: Package, color: '#22d3ee', bg: 'rgba(6,182,212,0.1)' },
        { label: 'Sales', value: tenant.sale_count || 0, icon: ShoppingCart, color: '#4ade80', bg: 'rgba(34,197,94,0.1)' },
        { label: 'Purchases', value: tenant.purchase_count || 0, icon: Receipt, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        { label: 'Revenue', value: formatCurrency(tenant.total_revenue), icon: DollarSign, color: '#a78bfa', bg: 'rgba(168,85,247,0.1)' },
        { label: 'Customers', value: tenant.customer_count || 0, icon: UserCheck, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
    ]

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button onClick={() => navigate('/platform/clients')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{tenant.name}</h1>
                        <span style={{
                            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            background: status.bg, color: status.color, border: `1px solid ${status.border}`,
                        }}>{status.label}</span>
                        <span style={{
                            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            background: planColor.bg, color: planColor.color, border: `1px solid ${planColor.border}`,
                            textTransform: 'capitalize',
                        }}>{tenant.plan}</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{tenant.slug}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={handleToggle}
                        disabled={toggleLoading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: tenant.is_active
                                ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                            border: `1px solid ${tenant.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                            color: tenant.is_active ? '#f87171' : '#4ade80',
                            cursor: toggleLoading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <Power size={14} /> {toggleLoading ? '...' : tenant.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                        onClick={() => setImpersonateModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            border: 'none', color: '#fff', cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                        }}
                    >
                        <ExternalLink size={14} /> Impersonate
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14, marginBottom: 24,
            }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        padding: 16, borderRadius: 12,
                        background: 'var(--color-panel)',
                        border: '1px solid var(--border-surface)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>{s.label}</span>
                            <div style={{
                                width: 30, height: 30, borderRadius: 8, background: s.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <s.icon size={15} color={s.color} />
                            </div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
                            {s.value}
                            {s.max != null && (
                                <span style={{ fontSize: 13, color: 'var(--color-muted)', fontWeight: 400 }}> / {s.max}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Details Card */}
            <div style={{
                padding: 20, borderRadius: 12, marginBottom: 24,
                background: 'var(--color-panel)', border: '1px solid var(--border-surface)',
            }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginTop: 0, marginBottom: 16 }}>
                    Client Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                    <DetailRow label="ID" value={tenant.id} mono />
                    <DetailRow label="Slug" value={tenant.slug} mono />
                    <DetailRow label="Plan" value={tenant.plan} capitalize />
                    <DetailRow label="Max Users" value={tenant.max_users} />
                    <DetailRow label="Created" value={formatDate(tenant.created_at)} />
                    <DetailRow label="Expires" value={formatDate(tenant.expires_at)} />
                    <DetailRow label="Last Activity" value={tenant.last_active ? formatDate(tenant.last_active) : 'Never'} />
                    <DetailRow label="Status" value={status.label} statusColor={status.color} />
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{
                padding: 20, borderRadius: 12,
                background: 'var(--color-panel)', border: '1px solid var(--border-surface)',
            }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginTop: 0, marginBottom: 16 }}>
                    Quick Actions
                </h3>
                <div style={{ display: 'flex', gap: 10 }}>
                    <ActionButton icon={ExternalLink} label="Impersonate" color="#f59e0b"
                        onClick={() => setImpersonateModal(true)} />
                    <ActionButton icon={Power} label={tenant.is_active ? 'Deactivate' : 'Activate'}
                        color={tenant.is_active ? '#f87171' : '#4ade80'} onClick={handleToggle} />
                </div>
            </div>

            {/* Impersonation Warning Modal */}
            {impersonateModal && (
                <div style={overlayS}>
                    <div style={modalS}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 8,
                                    background: 'rgba(245,158,11,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <AlertTriangle size={20} color="#f59e0b" />
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Impersonation Warning</h3>
                            </div>
                            <button onClick={() => setImpersonateModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 4 }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{
                            padding: 14, borderRadius: 8, marginBottom: 16,
                            background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.2)',
                        }}>
                            <p style={{ fontSize: 13, color: '#fbbf24', margin: '0 0 8px', fontWeight: 500 }}>
                                You are about to impersonate this client's admin account.
                            </p>
                            <ul style={{ fontSize: 12, color: 'var(--color-muted)', margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                                <li>A new tab will open with the client's ERP view</li>
                                <li>All actions will be logged</li>
                                <li>The session will expire in 2 hours</li>
                                <li>An orange banner will indicate impersonation mode</li>
                            </ul>
                        </div>

                        <div style={{
                            padding: 10, borderRadius: 8, marginBottom: 20,
                            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.1)',
                        }}>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Client: </span>
                            <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>{tenant.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 8 }}>({tenant.slug})</span>
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setImpersonateModal(false)} style={cancelBtnS}>Cancel</button>
                            <button onClick={handleImpersonate} disabled={impersonating} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                border: 'none', color: '#fff', cursor: impersonating ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                            }}>
                                {impersonating ? 'Opening...' : 'Confirm & Impersonate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Helpers ───
function getStatusInfo(t) {
    if (!t.is_active) return { label: 'Inactive', color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' }
    if (t.expires_at) {
        const days = Math.ceil((new Date(t.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
        if (days <= 0) return { label: 'Expired', color: '#dc2626', bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.3)' }
        if (days <= 30) return { label: 'Expiring', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
    }
    return { label: 'Active', color: '#4ade80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)' }
}

const planColors = {
    basic: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
    professional: { bg: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
    enterprise: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(v) {
    if (!v) return 'Rs 0'
    return `Rs ${Number(v).toLocaleString()}`
}

// ─── Sub-Components ───
function DetailRow({ label, value, mono, capitalize, statusColor }) {
    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{
                fontSize: 13, fontWeight: 500,
                color: statusColor || 'var(--color-text)',
                fontFamily: mono ? 'monospace' : 'inherit',
                textTransform: capitalize ? 'capitalize' : 'none',
            }}>{value || '—'}</div>
        </div>
    )
}

function ActionButton({ icon: Icon, label, color, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: `${color}15`, border: `1px solid ${color}30`,
                color, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${color}25`}
            onMouseLeave={e => e.currentTarget.style.background = `${color}15`}
        >
            <Icon size={15} /> {label}
        </button>
    )
}

// ─── Styles ───
const overlayS = {
    position: 'fixed', inset: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
}

const modalS = {
    width: '100%', maxWidth: 480, padding: 24, borderRadius: 14,
    background: 'var(--color-panel)',
    border: '1px solid var(--border-surface)',
    boxShadow: 'var(--elevation-3)',
}

const cancelBtnS = {
    padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)',
    color: 'var(--color-muted)', cursor: 'pointer',
}
