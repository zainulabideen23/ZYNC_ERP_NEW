import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { platformTenantsAPI } from '../../services/platform.api'
import { Building2, ArrowLeft, Copy, Check, UserPlus, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NewClient() {
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null) // success result
    const [copied, setCopied] = useState({})

    // Form state
    const [form, setForm] = useState({
        name: '',
        slug: '',
        plan: 'basic',
        max_users: 5,
        expires_at: '',
        admin_name: '',
        admin_username: '',
        admin_email: '',
        admin_password: '',
        confirm_password: '',
    })

    const [errors, setErrors] = useState({})

    const updateField = (field, value) => {
        setForm(f => {
            const updated = { ...f, [field]: value }
            // Auto-generate slug from name
            if (field === 'name') {
                updated.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            }
            return updated
        })
        if (errors[field]) setErrors(e => ({ ...e, [field]: null }))
    }

    const validateStep1 = () => {
        const errs = {}
        if (!form.name.trim()) errs.name = 'Client name is required'
        if (!form.slug.trim()) errs.slug = 'Slug is required'
        else if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = 'Slug must be lowercase letters, numbers, hyphens only'
        if (!form.plan) errs.plan = 'Plan is required'
        if (!form.max_users || form.max_users < 1) errs.max_users = 'Must be at least 1'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const validateStep2 = () => {
        const errs = {}
        if (!form.admin_name.trim()) errs.admin_name = 'Full name is required'
        if (!form.admin_username.trim()) errs.admin_username = 'Username is required'
        if (!form.admin_email.trim()) errs.admin_email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(form.admin_email)) errs.admin_email = 'Invalid email'
        if (!form.admin_password) errs.admin_password = 'Password is required'
        else if (form.admin_password.length < 6) errs.admin_password = 'Minimum 6 characters'
        if (form.admin_password !== form.confirm_password) errs.confirm_password = 'Passwords do not match'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const handleSubmit = async () => {
        if (!validateStep2()) return
        setLoading(true)
        try {
            const res = await platformTenantsAPI.create({
                name: form.name,
                slug: form.slug,
                plan: form.plan,
                max_users: parseInt(form.max_users),
                expires_at: form.expires_at || null,
                admin_name: form.admin_name,
                admin_username: form.admin_username,
                admin_email: form.admin_email,
                admin_password: form.admin_password,
            })
            setResult({
                tenant: res.data?.tenant || { name: form.name, slug: form.slug, plan: form.plan },
                admin: {
                    username: form.admin_username,
                    email: form.admin_email,
                    password: form.admin_password,
                },
            })
            setStep(3)
        } catch (err) {
            toast.error(err.message || 'Failed to create client')
        } finally {
            setLoading(false)
        }
    }

    const copyText = (key, text) => {
        navigator.clipboard.writeText(text)
        setCopied(c => ({ ...c, [key]: true }))
        setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000)
    }

    const planOptions = [
        { value: 'basic', label: 'Basic', desc: 'Standard features, ideal for small businesses' },
        { value: 'professional', label: 'Professional', desc: 'Advanced features with priority support' },
        { value: 'enterprise', label: 'Enterprise', desc: 'Full access with custom integrations' },
    ]

    const planColors = {
        basic: { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', active: 'rgba(148,163,184,0.35)' },
        professional: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)', active: 'rgba(6,182,212,0.4)' },
        enterprise: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', active: 'rgba(168,85,247,0.4)' },
    }

    return (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                {step < 3 && (
                    <button
                        onClick={() => step === 1 ? navigate('/platform/clients') : setStep(1)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                    {step === 3 ? 'Client Created!' : 'New Client'}
                </h1>
            </div>

            {/* Steps indicator */}
            {step < 3 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                    {[1, 2].map(s => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: s <= step ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(51,65,85,0.5)',
                                color: s <= step ? '#fff' : '#64748b',
                                border: `1px solid ${s <= step ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.1)'}`,
                            }}>{s}</div>
                            <span style={{ fontSize: 13, color: s <= step ? '#e2e8f0' : '#64748b', fontWeight: 500 }}>
                                {s === 1 ? 'Client Info' : 'Admin Account'}
                            </span>
                            {s === 1 && <ChevronRight size={14} style={{ color: '#475569', marginLeft: 'auto' }} />}
                        </div>
                    ))}
                </div>
            )}

            {/* Step 1: Client Info */}
            {step === 1 && (
                <div style={cardS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Building2 size={18} color="#818cf8" />
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Client Information</h3>
                    </div>

                    <FormField label="Client Name *" error={errors.name}>
                        <input value={form.name} onChange={e => updateField('name', e.target.value)}
                            placeholder="e.g. Acme Corporation" style={inputS} />
                    </FormField>

                    <FormField label="Slug *" error={errors.slug} hint="Unique identifier, auto-generated from name">
                        <input value={form.slug} onChange={e => updateField('slug', e.target.value)}
                            placeholder="acme-corporation" style={{ ...inputS, fontFamily: 'monospace' }} />
                    </FormField>

                    <div style={{ marginBottom: 14 }}>
                        <label style={labelS}>Plan *</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {planOptions.map(p => {
                                const c = planColors[p.value]
                                const selected = form.plan === p.value
                                return (
                                    <button
                                        key={p.value}
                                        onClick={() => updateField('plan', p.value)}
                                        style={{
                                            flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                                            textAlign: 'center', transition: 'all 0.15s',
                                            background: selected ? c.active : c.bg,
                                            border: `1.5px solid ${selected ? c.border : 'rgba(99,102,241,0.1)'}`,
                                        }}
                                    >
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{p.label}</div>
                                        <div style={{ fontSize: 10, color: '#64748b' }}>{p.desc}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <FormField label="Max Users *" error={errors.max_users} style={{ flex: 1 }}>
                            <input type="number" min={1} value={form.max_users}
                                onChange={e => updateField('max_users', e.target.value)} onWheel={e => e.target.blur()} style={inputS} />
                        </FormField>
                        <FormField label="Expiry Date" style={{ flex: 1 }}>
                            <input type="date" value={form.expires_at}
                                onChange={e => updateField('expires_at', e.target.value)} style={inputS} />
                        </FormField>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => { if (validateStep1()) setStep(2) }} style={primaryBtnS}>
                            Next: Admin Account <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Admin Account */}
            {step === 2 && (
                <div style={cardS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <UserPlus size={18} color="#818cf8" />
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Admin Account</h3>
                    </div>

                    <FormField label="Full Name *" error={errors.admin_name}>
                        <input value={form.admin_name} onChange={e => updateField('admin_name', e.target.value)}
                            placeholder="Admin Full Name" style={inputS} />
                    </FormField>

                    <FormField label="Username *" error={errors.admin_username}>
                        <input value={form.admin_username} onChange={e => updateField('admin_username', e.target.value)}
                            placeholder="admin" style={inputS} />
                    </FormField>

                    <FormField label="Email *" error={errors.admin_email}>
                        <input type="email" value={form.admin_email} onChange={e => updateField('admin_email', e.target.value)}
                            placeholder="admin@company.com" style={inputS} />
                    </FormField>

                    <FormField label="Password *" error={errors.admin_password}>
                        <input type="password" value={form.admin_password} onChange={e => updateField('admin_password', e.target.value)}
                            placeholder="Minimum 6 characters" style={inputS} />
                    </FormField>

                    <FormField label="Confirm Password *" error={errors.confirm_password}>
                        <input type="password" value={form.confirm_password} onChange={e => updateField('confirm_password', e.target.value)}
                            placeholder="Re-enter password" style={inputS} />
                    </FormField>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                        <button onClick={() => setStep(1)} style={secondaryBtnS}>
                            <ArrowLeft size={16} /> Back
                        </button>
                        <button onClick={handleSubmit} disabled={loading} style={primaryBtnS}>
                            {loading ? 'Creating...' : 'Create Client'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Success */}
            {step === 3 && result && (
                <div style={cardS}>
                    {/* Success icon */}
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                            background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Check size={28} color="#4ade80" />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Client Created Successfully</h3>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Share these credentials with the client admin</p>
                    </div>

                    {/* Credentials card */}
                    <div style={{
                        padding: 16, borderRadius: 10, marginBottom: 16,
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.15)',
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', marginBottom: 10, textTransform: 'uppercase' }}>
                            Client Details
                        </div>
                        <CopyRow label="Name" value={result.tenant.name} copied={copied} onCopy={copyText} />
                        <CopyRow label="Slug" value={result.tenant.slug} copied={copied} onCopy={copyText} mono />
                        <CopyRow label="Plan" value={result.tenant.plan} copied={copied} onCopy={copyText} />
                    </div>

                    <div style={{
                        padding: 16, borderRadius: 10, marginBottom: 20,
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(245,158,11,0.2)',
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 10, textTransform: 'uppercase' }}>
                            Admin Credentials
                        </div>
                        <CopyRow label="Username" value={result.admin.username} copied={copied} onCopy={copyText} mono />
                        <CopyRow label="Email" value={result.admin.email} copied={copied} onCopy={copyText} />
                        <CopyRow label="Password" value={result.admin.password} copied={copied} onCopy={copyText} mono />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => navigate('/platform/clients')} style={{ ...secondaryBtnS, flex: 1 }}>
                            View All Clients
                        </button>
                        <button onClick={() => navigate(`/platform/clients/${result.tenant.id || ''}`)} style={{ ...primaryBtnS, flex: 1 }}>
                            View Client Details
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Sub-Components ───
function FormField({ label, error, hint, style, children }) {
    return (
        <div style={{ marginBottom: 14, ...style }}>
            <label style={labelS}>{label}</label>
            {children}
            {hint && !error && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{hint}</div>}
            {error && <div style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{error}</div>}
        </div>
    )
}

function CopyRow({ label, value, copied, onCopy, mono }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <div>
                <span style={{ fontSize: 11, color: '#64748b', marginRight: 8 }}>{label}:</span>
                <span style={{ fontSize: 13, color: '#e2e8f0', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 500 }}>{value}</span>
            </div>
            <button
                onClick={() => onCopy(label, value)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: copied[label] ? '#4ade80' : '#64748b' }}
            >
                {copied[label] ? <Check size={14} /> : <Copy size={14} />}
            </button>
        </div>
    )
}

// ─── Styles ───
const cardS = {
    padding: 24, borderRadius: 14,
    background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(99,102,241,0.1)',
}

const labelS = { display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 5 }

const inputS = {
    width: '100%', padding: '9px 12px', borderRadius: 7, fontSize: 13,
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.2)',
    color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
}

const primaryBtnS = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
    color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
}

const secondaryBtnS = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    background: 'rgba(51,65,85,0.5)', border: '1px solid rgba(99,102,241,0.15)',
    color: '#94a3b8', cursor: 'pointer', justifyContent: 'center',
}
