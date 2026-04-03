import { useState, useEffect } from 'react'
import { settingsAPI } from '../../../services/api'
import { onboardingAPI } from '../../../services/api'
import { useAuthStore } from '../../../store/auth.store'
import toast from 'react-hot-toast'
import { ChevronRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const MONTHS = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
]

const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: '0.85rem',
    background: 'var(--color-bg)', border: '1px solid var(--border-surface)', borderRadius: 10,
    color: 'var(--color-text)', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
}

const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase',
    letterSpacing: '0.03em',
}

function Step1Company({ onContinue, saving, setSaving }) {
    const { updateOnboardingStep } = useAuthStore()
    const [form, setForm] = useState({
        name: '', ntn_number: '', strn_number: '',
        default_tax_rate: '', phone: '', email: '', website: '',
        city: '', address: '',
        financial_year_start: 1, financial_year_end: 12,
        bank_name: '', bank_account_number: '', bank_iban: '', bank_branch_code: '',
    })
    const [loadingData, setLoadingData] = useState(true)
    const [showBank, setShowBank] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const res = await settingsAPI.getCompanyInfo()
                if (res.data) {
                    setForm(prev => ({
                        ...prev,
                        name: res.data.name || '',
                        ntn_number: res.data.ntn_number || '',
                        strn_number: res.data.strn_number || '',
                        default_tax_rate: res.data.default_tax_rate || '',
                        phone: res.data.phone || '',
                        email: res.data.email || '',
                        website: res.data.website || '',
                        city: res.data.city || '',
                        address: res.data.address || '',
                        financial_year_start: res.data.financial_year_start || 1,
                        financial_year_end: res.data.financial_year_end || 12,
                        bank_name: res.data.bank_name || '',
                        bank_account_number: res.data.bank_account_number || '',
                        bank_iban: res.data.bank_iban || '',
                        bank_branch_code: res.data.bank_branch_code || '',
                    }))
                    // If bank data existed, expand the section
                    if (res.data.bank_name || res.data.bank_account_number || res.data.bank_iban) {
                        setShowBank(true)
                    }
                }
            } catch (err) {
                // First time — no data yet
            } finally {
                setLoadingData(false)
            }
        })()
    }, [])

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handleFocus = (e) => {
        e.target.style.borderColor = 'var(--color-accent)'
        e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.15)'
    }
    const handleBlur = (e) => {
        e.target.style.borderColor = 'var(--border-surface)'
        e.target.style.boxShadow = 'none'
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            await settingsAPI.updateCompanyInfo({
                ...form,
                default_tax_rate: form.default_tax_rate ? parseFloat(form.default_tax_rate) : 0,
            })
            await onboardingAPI.updateStep(2)
            updateOnboardingStep(2)
            onContinue()
        } catch (err) {
            toast.error(err.message || 'Failed to save company info')
        } finally {
            setSaving(false)
        }
    }

    if (loadingData) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <Loader2 size={28} style={{ color: 'var(--color-accent)', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                Tell us about your business
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: 28 }}>
                This information appears on your invoices and reports
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                {/* Business Name */}
                <div>
                    <label style={labelStyle}>Business Name *</label>
                    <input
                        style={inputStyle} value={form.name}
                        onChange={e => handleChange('name', e.target.value)}
                        placeholder="Your company name"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* NTN */}
                <div>
                    <label style={labelStyle}>NTN Number</label>
                    <input
                        style={inputStyle} value={form.ntn_number}
                        onChange={e => handleChange('ntn_number', e.target.value)}
                        placeholder="National Tax Number"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* STRN */}
                <div>
                    <label style={labelStyle}>STRN Number</label>
                    <input
                        style={inputStyle} value={form.strn_number}
                        onChange={e => handleChange('strn_number', e.target.value)}
                        placeholder="Sales Tax Registration"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* Tax Rate */}
                <div>
                    <label style={labelStyle}>Default Tax Rate (%)</label>
                    <input
                        type="number" step="0.01" min="0" max="100"
                        style={inputStyle} value={form.default_tax_rate}
                        onChange={e => handleChange('default_tax_rate', e.target.value)}
                        placeholder="e.g. 17"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* Phone */}
                <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                        style={inputStyle} value={form.phone}
                        onChange={e => handleChange('phone', e.target.value)}
                        placeholder="+92-300-1234567"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* Email */}
                <div>
                    <label style={labelStyle}>Email</label>
                    <input
                        type="email"
                        style={inputStyle} value={form.email}
                        onChange={e => handleChange('email', e.target.value)}
                        placeholder="info@company.com"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* City */}
                <div>
                    <label style={labelStyle}>City</label>
                    <input
                        style={inputStyle} value={form.city}
                        onChange={e => handleChange('city', e.target.value)}
                        placeholder="Lahore"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* Website */}
                <div>
                    <label style={labelStyle}>Website</label>
                    <input
                        style={inputStyle} value={form.website}
                        onChange={e => handleChange('website', e.target.value)}
                        placeholder="www.company.com"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* Address — full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Address</label>
                    <input
                        style={inputStyle} value={form.address}
                        onChange={e => handleChange('address', e.target.value)}
                        placeholder="Full business address"
                        onFocus={handleFocus} onBlur={handleBlur}
                    />
                </div>

                {/* Financial Year Start */}
                <div>
                    <label style={labelStyle}>Financial Year Start</label>
                    <select
                        value={form.financial_year_start}
                        onChange={e => handleChange('financial_year_start', parseInt(e.target.value))}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        onFocus={handleFocus} onBlur={handleBlur}
                    >
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>

                {/* Financial Year End */}
                <div>
                    <label style={labelStyle}>Financial Year End</label>
                    <select
                        value={form.financial_year_end}
                        onChange={e => handleChange('financial_year_end', parseInt(e.target.value))}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        onFocus={handleFocus} onBlur={handleBlur}
                    >
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Collapsible Bank Details ── */}
            <button
                type="button"
                onClick={() => setShowBank(!showBank)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginTop: 20, marginBottom: showBank ? 12 : 0,
                    padding: '8px 0', fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--color-hint)', background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'color 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-muted)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-hint)'}
            >
                {showBank ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Bank Details {!showBank && <span style={{ fontWeight: 400 }}>(optional — can be added later)</span>}
            </button>

            {showBank && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                    <div>
                        <label style={labelStyle}>Bank Name</label>
                        <input
                            style={inputStyle} value={form.bank_name}
                            onChange={e => handleChange('bank_name', e.target.value)}
                            placeholder="e.g. HBL, Meezan, JazzCash"
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Account Number</label>
                        <input
                            style={inputStyle} value={form.bank_account_number}
                            onChange={e => handleChange('bank_account_number', e.target.value)}
                            placeholder="Account number"
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>IBAN</label>
                        <input
                            style={inputStyle} value={form.bank_iban}
                            onChange={e => handleChange('bank_iban', e.target.value)}
                            placeholder="PK00XXXX..."
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Branch Code</label>
                        <input
                            style={inputStyle} value={form.bank_branch_code}
                            onChange={e => handleChange('bank_branch_code', e.target.value)}
                            placeholder="Branch code"
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                    </div>
                </div>
            )}

            {/* Save & Continue */}
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '11px 24px', borderRadius: 10, fontSize: '0.88rem',
                        fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                        background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                        opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-accent)'}
                >
                    {saving ? (
                        <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                    ) : (
                        <>Save & Continue <ChevronRight size={16} /></>
                    )}
                </button>
            </div>
        </div>
    )
}

export default Step1Company
