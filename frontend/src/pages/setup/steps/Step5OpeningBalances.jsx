import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Landmark, Loader2, ChevronRight } from 'lucide-react'
import { accountsAPI } from '../../../services/api'

const ACCOUNT_CONFIG = [
    { code: '1001', label: 'Cash in Hand', hint: 'Opening cash available today' },
    { code: '1002', label: 'Bank Account', hint: 'Starting bank balance' },
    { code: '3001', label: 'Owner Capital', hint: 'Initial owner investment' },
]

const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-surface)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
}

function Step5OpeningBalances({ onContinue, onSkip, saving, setSaving }) {
    const [loading, setLoading] = useState(true)
    const [accountsByCode, setAccountsByCode] = useState({})
    const [values, setValues] = useState({
        '1001': '0',
        '1002': '0',
        '3001': '0',
    })

    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const res = await accountsAPI.list()
                const grouped = Array.isArray(res?.data) ? res.data : []
                const flatAccounts = grouped.flatMap((group) => group.accounts || [])
                const byCode = Object.fromEntries(flatAccounts.map((account) => [account.code, account]))
                setAccountsByCode(byCode)

                setValues((prev) => {
                    const next = { ...prev }
                    for (const config of ACCOUNT_CONFIG) {
                        const account = byCode[config.code]
                        if (account && account.opening_balance !== undefined && account.opening_balance !== null) {
                            next[config.code] = String(account.opening_balance)
                        }
                    }
                    return next
                })
            } catch (error) {
                toast.error('Failed to load accounts for opening balances')
            } finally {
                setLoading(false)
            }
        }

        loadAccounts()
    }, [])

    const missingAccounts = useMemo(() => {
        return ACCOUNT_CONFIG.filter((cfg) => !accountsByCode[cfg.code]).map((cfg) => cfg.label)
    }, [accountsByCode])

    const handleSaveAndContinue = async () => {
        try {
            setSaving(true)

            const updates = ACCOUNT_CONFIG
                .map((config) => ({ config, account: accountsByCode[config.code] }))
                .filter((item) => item.account)
                .map(({ config, account }) => {
                    const parsed = Number(values[config.code] || 0)
                    const openingBalance = Number.isFinite(parsed) ? parsed : 0
                    return accountsAPI.update(account.id, { opening_balance: openingBalance })
                })

            if (updates.length > 0) {
                await Promise.all(updates)
                toast.success('Opening balances saved')
            }

            await onContinue()
        } catch (error) {
            toast.error(error.message || 'Failed to save opening balances')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <Loader2 size={28} style={{ color: 'var(--color-accent)', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                Opening balances (optional)
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: 20 }}>
                Set starting balances for your key accounts. You can also skip this and configure later.
            </p>

            {missingAccounts.length > 0 && (
                <div style={{
                    marginBottom: 16,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(245,158,11,0.25)',
                    background: 'rgba(245,158,11,0.08)',
                    color: '#fbbf24',
                    fontSize: 12,
                }}>
                    Missing account setup for: {missingAccounts.join(', ')}. You can still continue.
                </div>
            )}

            <div style={{ display: 'grid', gap: 12 }}>
                {ACCOUNT_CONFIG.map((config) => {
                    const account = accountsByCode[config.code]
                    return (
                        <div
                            key={config.code}
                            style={{
                                padding: 14,
                                borderRadius: 10,
                                border: '1px solid var(--border-surface)',
                                background: 'var(--color-bg)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Landmark size={14} color="var(--color-muted)" />
                                    <span style={{ color: 'var(--color-text)', fontSize: 13, fontWeight: 600 }}>{config.label}</span>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--color-hint)' }}>Code: {config.code}</span>
                            </div>
                            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--color-muted)' }}>{config.hint}</div>
                            <input
                                type="number"
                                step="0.01"
                                value={values[config.code]}
                                onChange={(e) => setValues((prev) => ({ ...prev, [config.code]: e.target.value }))}
                                disabled={!account}
                                placeholder="0"
                                style={{
                                    ...inputStyle,
                                    opacity: account ? 1 : 0.6,
                                    cursor: account ? 'text' : 'not-allowed',
                                }}
                            />
                        </div>
                    )
                })}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                    onClick={onSkip}
                    disabled={saving}
                    style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-surface)',
                        background: 'transparent',
                        color: 'var(--color-muted)',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    Skip for now
                </button>

                <button
                    onClick={handleSaveAndContinue}
                    disabled={saving}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '11px 24px',
                        borderRadius: 10,
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: '#fff',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        background: 'var(--color-accent)',
                        border: 'none',
                        fontFamily: 'inherit',
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? 'Saving...' : 'Save and continue'}
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    )
}

export default Step5OpeningBalances
