import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { platformTenantsAPI } from '../../services/platform.api'
import { Search, Plus, Eye, Pencil, Power, X, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ClientsList() {
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all') // all | active | inactive
    const [editModal, setEditModal] = useState(null) // tenant being edited
    const [confirmToggle, setConfirmToggle] = useState(null) // toggle confirm dialog
    const navigate = useNavigate()

    useEffect(() => { loadTenants() }, [])

    const loadTenants = async () => {
        try {
            const res = await platformTenantsAPI.list()
            setTenants(res.data)
        } catch (err) {
            toast.error('Failed to load clients')
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() => {
        let list = tenants
        if (filter === 'active') list = list.filter(t => t.is_active)
        if (filter === 'inactive') list = list.filter(t => !t.is_active)
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
        }
        return list
    }, [tenants, filter, search])

    const handleToggle = async () => {
        if (!confirmToggle) return
        try {
            if (confirmToggle.is_active) {
                await platformTenantsAPI.deactivate(confirmToggle.id)
                toast.success(`${confirmToggle.name} deactivated`)
            } else {
                await platformTenantsAPI.activate(confirmToggle.id)
                toast.success(`${confirmToggle.name} activated`)
            }
            setConfirmToggle(null)
            loadTenants()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const formatDate = (d) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const getStatusInfo = (t) => {
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

    const filterBtns = [
        { key: 'all', label: 'All' },
        { key: 'active', label: 'Active' },
        { key: 'inactive', label: 'Inactive' },
    ]

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Clients</h1>
                <button
                    onClick={() => navigate('/platform/clients/new')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 18px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #0891B2, #0891B2)',
                        border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                    }}
                >
                    <Plus size={16} /> New Client
                </button>
            </div>

            {/* Search + Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or slug..."
                        style={{
                            width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                            background: 'var(--color-bg)', border: '1px solid var(--border-surface)',
                            color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {filterBtns.map(b => (
                        <button
                            key={b.key}
                            onClick={() => setFilter(b.key)}
                            style={{
                                padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                border: '1px solid var(--border-surface)',
                                background: filter === b.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                color: filter === b.key ? '#0891B2' : 'var(--color-muted)',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {b.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>Loading...</div>
            ) : (
                <div style={{
                    borderRadius: 12, overflow: 'hidden',
                    border: '1px solid var(--border-surface)',
                    background: 'var(--color-panel)',
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                {['Client Name', 'Slug', 'Plan', 'Users', 'Status', 'Expires', 'Actions'].map(h => (
                                    <th key={h} style={{
                                        textAlign: 'left', padding: '12px 14px', fontSize: 11,
                                        fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase',
                                        letterSpacing: 0.5, background: 'var(--color-panel-2)',
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(t => {
                                const status = getStatusInfo(t)
                                const pc = planColors[t.plan] || planColors.basic
                                return (
                                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                        <td style={tdS}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8,
                                                    background: 'rgba(99,102,241,0.1)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    <Building2 size={15} color="#c084fc" />
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{t.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 12, color: '#c084fc' }}>{t.slug}</td>
                                        <td style={tdS}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                                                background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`,
                                                textTransform: 'capitalize',
                                            }}>{t.plan}</span>
                                        </td>
                                        <td style={tdS}>{t.user_count || 0} / {t.max_users}</td>
                                        <td style={tdS}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                                                background: status.bg, color: status.color, border: `1px solid ${status.border}`,
                                            }}>{status.label}</span>
                                        </td>
                                        <td style={{ ...tdS, color: 'var(--color-muted)' }}>{formatDate(t.expires_at)}</td>
                                        <td style={tdS}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <IconBtn title="View" onClick={() => navigate(`/platform/clients/${t.id}`)}>
                                                    <Eye size={14} />
                                                </IconBtn>
                                                <IconBtn title="Edit" onClick={() => setEditModal(t)}>
                                                    <Pencil size={14} />
                                                </IconBtn>
                                                <IconBtn
                                                    title={t.is_active ? 'Deactivate' : 'Activate'}
                                                    onClick={() => setConfirmToggle(t)}
                                                    color={t.is_active ? '#f87171' : '#4ade80'}
                                                >
                                                    <Power size={14} />
                                                </IconBtn>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} style={{ ...tdS, textAlign: 'center', color: 'var(--color-muted)', padding: 30 }}>
                                    No clients found
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {editModal && (
                <EditModal
                    tenant={editModal}
                    onClose={() => setEditModal(null)}
                    onSaved={() => { setEditModal(null); loadTenants() }}
                />
            )}

            {/* Confirm Toggle Dialog */}
            {confirmToggle && (
                <ConfirmDialog
                    title={confirmToggle.is_active ? 'Deactivate Client' : 'Activate Client'}
                    message={`Are you sure you want to ${confirmToggle.is_active ? 'deactivate' : 'activate'} "${confirmToggle.name}"?`}
                    confirmLabel={confirmToggle.is_active ? 'Deactivate' : 'Activate'}
                    danger={confirmToggle.is_active}
                    onConfirm={handleToggle}
                    onCancel={() => setConfirmToggle(null)}
                />
            )}
        </div>
    )
}

// ─── Edit Modal ───
function EditModal({ tenant, onClose, onSaved }) {
    const [name, setName] = useState(tenant.name)
    const [plan, setPlan] = useState(tenant.plan)
    const [maxUsers, setMaxUsers] = useState(tenant.max_users)
    const [expiresAt, setExpiresAt] = useState(tenant.expires_at ? tenant.expires_at.split('T')[0] : '')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            await platformTenantsAPI.update(tenant.id, {
                name,
                plan,
                max_users: parseInt(maxUsers),
                expires_at: expiresAt || null,
            })
            toast.success('Client updated')
            onSaved()
        } catch (err) {
            toast.error(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={overlayS}>
            <div style={modalS}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Edit Client</h3>
                    <button onClick={onClose} style={closeBtn}><X size={18} /></button>
                </div>

                <Field label="Client Name" value={name} onChange={setName} />
                <div style={{ marginBottom: 14 }}>
                    <label style={labelS}>Plan</label>
                    <select value={plan} onChange={e => setPlan(e.target.value)} style={inputS}>
                        <option value="basic">Basic</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                </div>
                <Field label="Max Users" value={maxUsers} onChange={setMaxUsers} type="number" />
                <Field label="Expires At" value={expiresAt} onChange={setExpiresAt} type="date" />

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button onClick={onClose} style={cancelBtnS}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={saveBtnS}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Confirm Dialog ───
function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
    return (
        <div style={overlayS}>
            <div style={{ ...modalS, maxWidth: 400 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 12px' }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 20px' }}>{message}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={cancelBtnS}>Cancel</button>
                    <button
                        onClick={onConfirm}
                        style={{
                            ...saveBtnS,
                            background: danger
                                ? 'linear-gradient(135deg, #dc2626, #ef4444)'
                                : 'linear-gradient(135deg, #16a34a, #22c55e)',
                            boxShadow: danger
                                ? '0 4px 12px rgba(220,38,38,0.3)'
                                : '0 4px 12px rgba(34,197,94,0.3)',
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Shared Sub-Components ───
function Field({ label, value, onChange, type = 'text' }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={labelS}>{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={inputS}
            />
        </div>
    )
}

function IconBtn({ children, onClick, title, color = '#94a3b8' }) {
    return (
        <button
            title={title}
            onClick={onClick}
            style={{
                width: 30, height: 30, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.12)',
                color, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
        >
            {children}
        </button>
    )
}

// ─── Styles ───
const tdS = { padding: '12px 14px', fontSize: 13, color: 'var(--color-text)' }

const overlayS = {
    position: 'fixed', inset: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
}

const modalS = {
    width: '100%', maxWidth: 440, padding: 24, borderRadius: 14,
    background: 'var(--color-panel)',
    border: '1px solid var(--border-surface)',
    boxShadow: 'var(--elevation-3)',
}

const labelS = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 5 }

const inputS = {
    width: '100%', padding: '9px 12px', borderRadius: 7, fontSize: 13,
    background: 'var(--color-bg)', border: '1px solid var(--border-surface)',
    color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

const closeBtn = {
    background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 4,
}

const cancelBtnS = {
    padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500,
    background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)',
    color: 'var(--color-muted)', cursor: 'pointer',
}

const saveBtnS = {
    padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
    background: 'linear-gradient(135deg, #0891B2, #0891B2)', border: 'none',
    color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
}
