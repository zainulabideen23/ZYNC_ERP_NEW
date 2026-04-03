import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { usersAPI } from '../services/api'
import { useAuthStore } from '../store/auth.store'
import { formatPakistaniPhone, getPhoneError } from '../utils/phoneFormat'
import {
    Search, Pencil, KeyRound, UserX, Eye, EyeOff, Info,
    Loader2, Plus, Check, X, ShieldAlert, CheckCircle, AlertCircle
} from 'lucide-react'

/* ─── Helpers ─── */
const ROLE_COLORS = {
    admin:   { bg: 'rgba(244,63,94,0.2)', text: '#fb7185', border: 'rgba(244,63,94,0.3)', solid: '#f43f5e' },
    manager: { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)', solid: '#3b82f6' },
    cashier: { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)', solid: '#64748b' },
}

const ROLE_DESCRIPTIONS = {
    admin:   'Full system access including users, settings and backups',
    manager: 'Can manage products, sales, purchases and expenses',
    cashier: 'Can create sales and register new customers only',
}

const getInitials = (name) => {
    if (!name) return '??'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const getPasswordStrength = (pw) => {
    if (!pw) return { level: 0, label: '' }
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { level: 1, label: 'Weak', color: '#ef4444', width: '33%' }
    if (score <= 3) return { level: 2, label: 'Medium', color: '#eab308', width: '66%' }
    return { level: 3, label: 'Strong', color: '#22c55e', width: '100%' }
}

/* ─── Avatar Component ─── */
function UserAvatar({ name, role, size = 32 }) {
    const c = ROLE_COLORS[role] || ROLE_COLORS.cashier
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', backgroundColor: c.solid,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.375, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
            {getInitials(name)}
        </div>
    )
}

/* ─── Toggle Switch ─── */
function ToggleSwitch({ checked, onChange, disabled }) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: disabled ? 'default' : 'pointer',
                backgroundColor: checked ? '#22c55e' : '#475569', position: 'relative',
                transition: 'background-color 0.2s', opacity: disabled ? 0.5 : 1, padding: 0,
            }}
            aria-label={checked ? 'Active' : 'Inactive'}
        >
            <span style={{
                position: 'absolute', top: 2, left: checked ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
        </button>
    )
}

/* ─── Confirmation Dialog ─── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }} onClick={onCancel}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                padding: 24, maxWidth: 400, width: '90%',
            }}>
                <p style={{ color: '#e2e8f0', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>{message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button onClick={onCancel} style={{
                        padding: '8px 20px', borderRadius: 8, border: '1px solid #475569',
                        background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 13,
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none',
                        background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}>Confirm</button>
                </div>
            </div>
        </div>
    )
}

/* ─── Main Component ─── */
function Users() {
    const { user: currentUser } = useAuthStore()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    // Modals
    const [showModal, setShowModal] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    // Filters
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')

    // Toggle confirm
    const [confirmToggle, setConfirmToggle] = useState(null) // { user, newState }

    // Form
    const [formData, setFormData] = useState({
        username: '', password: '', full_name: '', email: '', phone: '', role: 'cashier', is_active: true
    })
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [usernameError, setUsernameError] = useState('')
    const [passwordData, setPasswordData] = useState({ id: null, newPassword: '' })
    const [showResetPassword, setShowResetPassword] = useState(false)

    useEffect(() => { loadUsers() }, [])

    const loadUsers = async () => {
        try {
            const response = await usersAPI.list()
            setUsers(response.data)
        } catch (error) {
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    /* ─ Filtered Users ─ */
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const q = search.toLowerCase()
            const matchSearch = !q || u.username.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q)
            const matchRole = roleFilter === 'all' || u.role === roleFilter
            const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active)
            return matchSearch && matchRole && matchStatus
        })
    }, [users, search, roleFilter, statusFilter])

    const isFiltering = search || roleFilter !== 'all' || statusFilter !== 'all'

    /* ─ Counts ─ */
    const counts = useMemo(() => ({
        total: users.length,
        admin: users.filter(u => u.role === 'admin').length,
        manager: users.filter(u => u.role === 'manager').length,
        cashier: users.filter(u => u.role === 'cashier').length,
        active: users.filter(u => u.is_active).length,
    }), [users])

    /* ─ Submit ─ */
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!isFormValid) return

        setSubmitting(true)
        try {
            const payload = { ...formData }
            // For phone: prepend +92 if user typed raw digits
            if (payload.phone && !payload.phone.startsWith('+92')) {
                payload.phone = '+92' + payload.phone
            }
            if (editingUser) {
                delete payload.password
                await usersAPI.update(editingUser.id, payload)
                toast.success('User updated successfully')
            } else {
                await usersAPI.create(payload)
                toast.success('User created successfully')
            }
            setShowModal(false)
            resetForm()
            loadUsers()
        } catch (error) {
            toast.error(error.message || 'Operation failed')
        } finally {
            setSubmitting(false)
        }
    }

    const handlePasswordReset = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            await usersAPI.resetPassword(passwordData.id, passwordData.newPassword)
            toast.success('Password reset successfully')
            setShowPasswordModal(false)
            setPasswordData({ id: null, newPassword: '' })
            setShowResetPassword(false)
        } catch (error) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    /* ─ Toggle active/inactive ─ */
    const handleToggleActive = async (user, newState) => {
        setConfirmToggle(null)
        try {
            await usersAPI.update(user.id, { is_active: newState })
            toast.success(newState ? '✓ User activated' : '⛔ User deactivated')
            loadUsers()
        } catch (error) {
            toast.error(error.message)
        }
    }

    const openEditModal = (user) => {
        setEditingUser(user)
        setFormData({
            username: user.username,
            full_name: user.full_name,
            email: user.email || '',
            phone: user.phone ? user.phone.replace('+92', '') : '',
            role: user.role,
            is_active: user.is_active,
            password: ''
        })
        setConfirmPassword('')
        setUsernameError('')
        setShowPassword(false)
        setShowConfirmPassword(false)
        setShowModal(true)
    }

    const openPasswordModal = (user) => {
        setPasswordData({ id: user.id, newPassword: '' })
        setShowResetPassword(false)
        setShowPasswordModal(true)
    }

    const resetForm = () => {
        setFormData({ username: '', password: '', full_name: '', email: '', phone: '', role: 'cashier', is_active: true })
        setConfirmPassword('')
        setEditingUser(null)
        setUsernameError('')
        setShowPassword(false)
        setShowConfirmPassword(false)
    }

    /* ─ Username validation ─ */
    const validateUsername = (val) => {
        if (!val) { setUsernameError(''); return }
        if (val.length < 3) { setUsernameError('Minimum 3 characters required'); return }
        if (val.includes(' ')) { setUsernameError('Username cannot contain spaces'); return }
        if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameError('Only letters, numbers and underscores allowed'); return }
        setUsernameError('')
    }

    /* ─ Styles ─ */
    const S = {
        page: { padding: '24px 32px', minHeight: '100vh', color: '#e2e8f0' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
        title: { fontSize: 24, fontWeight: 700, color: '#f1f5f9' },
        addBtn: {
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10,
            border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'background 0.2s',
        },
        summaryBar: { display: 'flex', gap: 20, fontSize: 13, color: '#94a3b8', marginBottom: 16, flexWrap: 'wrap' },
        filterBar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
        searchWrap: {
            position: 'relative', flex: '1 1 280px', maxWidth: 360,
        },
        searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' },
        searchInput: {
            width: '100%', padding: '9px 12px 9px 38px', borderRadius: 8,
            border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
            fontSize: 13, outline: 'none',
        },
        select: {
            padding: '9px 12px', borderRadius: 8, border: '1px solid #334155',
            background: '#0f172a', color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: 'pointer',
        },
        table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
        th: {
            textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
            borderBottom: '1px solid #1e293b',
        },
        td: { padding: '12px 16px', borderBottom: '1px solid rgba(30,41,59,0.5)', fontSize: 13, verticalAlign: 'middle' },
        card: { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' },
        iconBtn: {
            width: 32, height: 32, borderRadius: 8, border: '1px solid #334155',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
        },
        roleBadge: (role) => {
            const c = ROLE_COLORS[role] || ROLE_COLORS.cashier
            return {
                display: 'inline-block', padding: '3px 12px', borderRadius: 999,
                fontSize: 11, fontWeight: 500, background: c.bg, color: c.text,
                border: `1px solid ${c.border}`, textTransform: 'capitalize',
            }
        },
    }

    const pwStrength = getPasswordStrength(formData.password)
    const passwordsMatch = formData.password && confirmPassword && formData.password === confirmPassword
    const passwordsMismatch = formData.password && confirmPassword && formData.password !== confirmPassword
    const phoneDisplay = formData.phone ? formData.phone.replace(/^\+92/, '') : ''

    const isFormValid = useMemo(() => {
        // Username: min 3 chars, no spaces, alphanumeric + underscore only
        if (!formData.username || formData.username.length < 3) return false
        if (/\s/.test(formData.username)) return false
        if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) return false
        if (usernameError) return false

        // Full name required
        if (!formData.full_name.trim()) return false

        // Password + confirm (create mode only)
        if (!editingUser) {
            if (!formData.password || formData.password.length < 6) return false
            if (formData.password !== confirmPassword) return false
        }

        // Email required
        if (!formData.email || !formData.email.trim()) return false

        // Phone required and must be valid
        if (!formData.phone || getPhoneError(formData.phone)) return false

        return true
    }, [formData, confirmPassword, usernameError, editingUser])

    if (loading) return (
        <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />
        </div>
    )

    if (currentUser?.role !== 'admin') {
        return (
            <div style={S.page}>
                <div style={{ ...S.card, padding: 40, textAlign: 'center', color: '#f87171' }}>
                    <ShieldAlert size={40} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                    <p style={{ fontWeight: 600 }}>Access Denied</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Admin privileges required.</p>
                </div>
            </div>
        )
    }

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <h1 style={S.title}>User Management</h1>
                <button style={S.addBtn} onClick={() => { resetForm(); setShowModal(true) }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}>
                    <Plus size={16} /> Add User
                </button>
            </div>

            {/* Summary Bar */}
            <div style={S.summaryBar}>
                <span>{counts.total} total users</span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#fb7185' }}>{counts.admin} admin</span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#60a5fa' }}>{counts.manager} manager</span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#94a3b8' }}>{counts.cashier} cashier</span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#4ade80' }}>{counts.active} active</span>
            </div>

            {/* Filters */}
            <div style={S.filterBar}>
                <div style={S.searchWrap}>
                    <Search size={16} style={S.searchIcon} />
                    <input
                        style={S.searchInput}
                        placeholder="Search by name or username..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                        onBlur={e => e.currentTarget.style.borderColor = '#334155'}
                    />
                </div>
                <select style={S.select} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="all">Role: All</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                </select>
                <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all">Status: All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                {isFiltering && (
                    <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
                        {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Table */}
            <div style={S.card}>
                {filteredUsers.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <UserX size={48} style={{ color: '#334155', margin: '0 auto 16px' }} />
                        <p style={{ fontWeight: 600, color: '#94a3b8', fontSize: 15 }}>No users found</p>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={S.table}>
                            <thead>
                                <tr style={{ background: '#0f172a' }}>
                                    <th style={{ ...S.th, width: 48 }}></th>
                                    <th style={S.th}>Username</th>
                                    <th style={S.th}>Full Name</th>
                                    <th style={S.th}>Role</th>
                                    <th style={S.th}>Status</th>
                                    <th style={S.th}>Last Login</th>
                                    <th style={{ ...S.th, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((u) => (
                                    <tr key={u.id}
                                        style={{ opacity: u.is_active ? 1 : 0.55, transition: 'opacity 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.4)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={S.td}>
                                            <UserAvatar name={u.full_name} role={u.role} />
                                        </td>
                                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13, fontWeight: 500 }}>
                                            {u.username}
                                        </td>
                                        <td style={S.td}>
                                            <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                                            {u.email && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{u.email}</div>}
                                        </td>
                                        <td style={S.td}>
                                            <span style={S.roleBadge(u.role)}>{u.role}</span>
                                        </td>
                                        <td style={S.td}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                fontSize: 12, color: u.is_active ? '#4ade80' : '#64748b',
                                            }}>
                                                <span style={{
                                                    width: 6, height: 6, borderRadius: '50%',
                                                    background: u.is_active ? '#22c55e' : '#475569',
                                                }} />
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={S.td}>
                                            {u.last_login
                                                ? <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(u.last_login).toLocaleString()}</span>
                                                : <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Never logged in</span>
                                            }
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                                <button style={S.iconBtn} title="Edit User" onClick={() => openEditModal(u)}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#e2e8f0' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
                                                    <Pencil size={14} />
                                                </button>
                                                <button style={S.iconBtn} title="Reset Password" onClick={() => openPasswordModal(u)}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#eab308' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
                                                    <KeyRound size={14} />
                                                </button>
                                                <ToggleSwitch
                                                    checked={u.is_active}
                                                    disabled={u.id === currentUser?.id}
                                                    onChange={() => {
                                                        if (u.is_active) {
                                                            setConfirmToggle({ user: u, newState: false })
                                                        } else {
                                                            handleToggleActive(u, true)
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Deactivate Confirmation */}
            {confirmToggle && (
                <ConfirmDialog
                    message={`Deactivate "${confirmToggle.user.username}"? They will be immediately logged out.`}
                    onConfirm={() => handleToggleActive(confirmToggle.user, confirmToggle.newState)}
                    onCancel={() => setConfirmToggle(null)}
                />
            )}

            {/* ═══════════ Create / Edit Modal ═══════════ */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => { setShowModal(false); resetForm() }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
                        width: '95%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        animation: 'modalSlide 0.2s ease-out',
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
                        }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                                {editingUser ? 'Edit User' : 'Create User'}
                            </h2>
                            <button onClick={() => { setShowModal(false); resetForm() }} style={{
                                background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                            }}><X size={18} /></button>
                        </div>

                        {/* Scrollable body */}
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
                            <div style={{ padding: '8px 24px 20px', overflowY: 'auto', flex: 1 }}>

                                {/* === ACCOUNT DETAILS === */}
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 0, marginBottom: 12 }}>
                                    Account Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Username *</label>
                                        <input
                                            type="text"
                                            value={formData.username}
                                            onChange={e => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '') })}
                                            onBlur={e => validateUsername(e.target.value)}
                                            disabled={!!editingUser}
                                            required
                                            placeholder="e.g. johndoe"
                                            style={{
                                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                                border: `1px solid ${usernameError ? '#ef4444' : (!editingUser && formData.username.length >= 3) ? 'rgba(34,197,94,0.5)' : '#334155'}`,
                                                background: editingUser ? '#0f172a80' : '#0f172a', color: '#e2e8f0',
                                                fontSize: 13, outline: 'none', opacity: editingUser ? 0.6 : 1,
                                            }}
                                        />
                                        {usernameError && (
                                            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <AlertCircle size={12} /> {usernameError}
                                            </div>
                                        )}
                                        {!usernameError && formData.username.length >= 3 && !editingUser && (
                                            <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <CheckCircle size={12} /> Looks good
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Full Name *</label>
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                            required
                                            placeholder="e.g. John Doe"
                                            style={{
                                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                                border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                                fontSize: 13, outline: 'none',
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* === SECURITY === */}
                                {!editingUser && (
                                    <>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 24, marginBottom: 12 }}>
                                            Security
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Password *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={formData.password}
                                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                        required
                                                        placeholder="Min 6 characters"
                                                        minLength={6}
                                                        style={{
                                                            width: '100%', padding: '9px 38px 9px 12px', borderRadius: 8,
                                                            border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                                            fontSize: 13, outline: 'none',
                                                        }}
                                                    />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                                        background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                                                        padding: 4, display: 'flex',
                                                    }}>
                                                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                                {/* Strength bar */}
                                                {formData.password && (
                                                    <div style={{ marginTop: 6 }}>
                                                        <div style={{ height: 6, borderRadius: 999, background: '#334155', overflow: 'hidden' }}>
                                                            <div style={{
                                                                height: '100%', width: pwStrength.width, background: pwStrength.color,
                                                                borderRadius: 999, transition: 'width 0.3s, background 0.3s',
                                                            }} />
                                                        </div>
                                                        <p style={{ fontSize: 11, color: pwStrength.color, marginTop: 4 }}>
                                                            {pwStrength.label}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Confirm Password *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        required
                                                        placeholder="Re-enter password"
                                                        style={{
                                                            width: '100%', padding: '9px 38px 9px 12px', borderRadius: 8,
                                                            border: `1px solid ${passwordsMismatch ? '#ef4444' : passwordsMatch ? '#22c55e' : '#334155'}`,
                                                            background: '#0f172a', color: '#e2e8f0', fontSize: 13, outline: 'none',
                                                        }}
                                                    />
                                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{
                                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                                        background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                                                        padding: 4, display: 'flex',
                                                    }}>
                                                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                                {passwordsMatch && (
                                                    <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <CheckCircle size={12} /> Passwords match
                                                    </div>
                                                )}
                                                {passwordsMismatch && (
                                                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <AlertCircle size={12} /> Passwords do not match
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Edit mode: last login info */}
                                {editingUser && editingUser.last_login && (
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Info size={13} />
                                        Last login: {new Date(editingUser.last_login).toLocaleString()}
                                    </div>
                                )}

                                {/* === CONTACT === */}
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 24, marginBottom: 12 }}>
                                    Contact <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}></span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="user@example.com"
                                            style={{
                                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                                border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                                fontSize: 13, outline: 'none',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Phone</label>
                                        <div style={{ display: 'flex' }}>
                                            <span style={{
                                                padding: '9px 10px', borderRadius: '8px 0 0 8px',
                                                border: '1px solid #334155', borderRight: 'none',
                                                background: '#334155', color: '#94a3b8', fontSize: 13,
                                                display: 'flex', alignItems: 'center', userSelect: 'none',
                                            }}>+92</span>
                                            <input
                                                type="text"
                                                value={phoneDisplay}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
                                                    setFormData({ ...formData, phone: raw ? '+92' + raw : '' })
                                                }}
                                                placeholder="3001234567"
                                                maxLength={10}
                                                style={{
                                                    flex: 1, padding: '9px 12px', borderRadius: '0 8px 8px 0',
                                                    border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                                    fontSize: 13, outline: 'none', minWidth: 0,
                                                }}
                                            />
                                        </div>
                                        {formData.phone && getPhoneError(formData.phone) && (
                                            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                                                {getPhoneError(formData.phone)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* === ACCESS === */}
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 24, marginBottom: 12 }}>
                                    Access
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: editingUser ? '1fr 1fr' : '1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            style={{
                                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                                border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                                fontSize: 13, outline: 'none', cursor: 'pointer',
                                            }}
                                        >
                                            <option value="cashier">Cashier</option>
                                            <option value="manager">Manager</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                            <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                                            {ROLE_DESCRIPTIONS[formData.role]}
                                        </div>
                                    </div>
                                    {editingUser && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Status</label>
                                            <select
                                                value={String(formData.is_active)}
                                                onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                                style={{
                                                    width: '100%', padding: '9px 12px', borderRadius: 8,
                                                    border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                                    fontSize: 13, outline: 'none', cursor: 'pointer',
                                                }}
                                            >
                                                <option value="true">Active</option>
                                                <option value="false">Inactive</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div style={{
                                padding: '16px 24px', borderTop: '1px solid #334155',
                                display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
                            }}>
                                <button type="button" onClick={() => { setShowModal(false); resetForm() }} style={{
                                    padding: '9px 22px', borderRadius: 8, border: '1px solid #475569',
                                    background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 13,
                                }}>Cancel</button>
                                <button type="submit" disabled={submitting || !isFormValid} style={{
                                    padding: '9px 22px', borderRadius: 8, border: 'none',
                                    background: (submitting || !isFormValid) ? '#1e40af' : '#3b82f6', color: '#fff',
                                    cursor: (submitting || !isFormValid) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 6, opacity: (submitting || !isFormValid) ? 0.5 : 1,
                                }}>
                                    {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                                    {submitting ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════ Password Reset Modal ═══════════ */}
            {showPasswordModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setShowPasswordModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
                        padding: 24, width: '90%', maxWidth: 400,
                        animation: 'modalSlide 0.2s ease-out',
                    }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' }}>Reset Password</h2>
                        <form onSubmit={handlePasswordReset}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>New Password *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showResetPassword ? 'text' : 'password'}
                                        value={passwordData.newPassword}
                                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        minLength={6}
                                        required
                                        placeholder="Min 6 characters"
                                        style={{
                                            width: '100%', padding: '9px 38px 9px 12px', borderRadius: 8,
                                            border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                            fontSize: 13, outline: 'none',
                                        }}
                                    />
                                    <button type="button" onClick={() => setShowResetPassword(!showResetPassword)} style={{
                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                        background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                                        padding: 4, display: 'flex',
                                    }}>
                                        {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Must be at least 6 characters</div>
                            </div>
                            <div style={{
                                display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20,
                                paddingTop: 16, borderTop: '1px solid #334155',
                            }}>
                                <button type="button" onClick={() => setShowPasswordModal(false)} style={{
                                    padding: '9px 22px', borderRadius: 8, border: '1px solid #475569',
                                    background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 13,
                                }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{
                                    padding: '9px 22px', borderRadius: 8, border: 'none',
                                    background: '#eab308', color: '#0f172a', cursor: submitting ? 'not-allowed' : 'pointer',
                                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                                    opacity: submitting ? 0.7 : 1,
                                }}>
                                    {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                                    {submitting ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Spin keyframe (injected once) */}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}

export default Users
