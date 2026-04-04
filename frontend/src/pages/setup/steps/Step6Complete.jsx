import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/auth.store'
import { onboardingAPI } from '../../../services/api'
import toast from 'react-hot-toast'
import {
    CheckCircle, AlertTriangle, ArrowRight, Loader2,
    Building2, Tag, Award, Ruler, Landmark
} from 'lucide-react'

function Step6Complete({ skippedSteps }) {
    const navigate = useNavigate()
    const { markOnboarded } = useAuthStore()
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(true)
    const [finishing, setFinishing] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const res = await onboardingAPI.status()
                setStatus(res.data)
            } catch (err) {
                // fallback
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    const handleFinish = async () => {
        try {
            setFinishing(true)
            await onboardingAPI.complete()
            markOnboarded()
            navigate('/')
        } catch (err) {
            toast.error('Failed to complete setup')
        } finally {
            setFinishing(false)
        }
    }

    const steps = [
        {
            key: 'company_info', label: 'Company info', icon: Building2,
            done: status?.completed_steps?.company_info,
            detail: status?.completed_steps?.company_info ? 'Saved' : 'Skipped',
        },
        {
            key: 'categories', label: 'Categories', icon: Tag,
            done: status?.completed_steps?.categories,
            detail: status?.completed_steps?.categories ? `${status.counts?.categories || 0} added` : 'Skipped',
        },
        {
            key: 'brands', label: 'Brands', icon: Award,
            done: status?.completed_steps?.brands,
            detail: status?.completed_steps?.brands ? `${status.counts?.brands || 0} added` : 'Skipped',
        },
        {
            key: 'units', label: 'Units', icon: Ruler,
            done: status?.completed_steps?.units,
            detail: status?.completed_steps?.units ? `${status.counts?.units || 0} ready` : 'Skipped',
        },
        {
            key: 'opening_balances', label: 'Opening balances', icon: Landmark,
            done: !skippedSteps?.has?.(5) && (status?.completed_steps?.opening_balances || false),
            detail: skippedSteps?.has?.(5)
                ? 'Skipped'
                : (status?.completed_steps?.opening_balances ? 'Configured' : 'Not set'),
        },
    ]

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <Loader2 size={28} style={{ color: 'var(--color-accent)', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 4 }}><CheckCircle size={48} color="var(--color-success)" /></div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                You're all set!
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: 28 }}>
                Your business is configured and ready to go
            </p>

            {/* Summary card */}
            <div style={{
                background: 'var(--color-bg)', borderRadius: 12,
                border: '1px solid var(--border-surface)', overflow: 'hidden',
                textAlign: 'left', maxWidth: 400, margin: '0 auto 28px',
            }}>
                <div style={{
                    padding: '12px 18px', borderBottom: '1px solid var(--border-surface)',
                    fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                    Setup Summary
                </div>
                {steps.map((step, idx) => {
                    const Icon = step.icon
                    const isLast = idx === steps.length - 1
                    return (
                        <div key={step.key} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 18px',
                            borderBottom: isLast ? 'none' : '1px solid var(--border-surface)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {step.done ? (
                                    <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                                ) : (
                                    <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
                                )}
                                <Icon size={15} style={{ color: 'var(--color-muted)' }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{step.label}</span>
                            </div>
                            <span style={{
                                fontSize: '0.78rem', fontWeight: 500,
                                color: step.done ? 'var(--color-success)' : '#fbbf24',
                            }}>
                                {step.detail}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* CTA */}
            <button
                onClick={handleFinish}
                disabled={finishing}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '13px 32px', borderRadius: 12, fontSize: '0.95rem',
                    fontWeight: 700, color: '#fff', cursor: finishing ? 'not-allowed' : 'pointer',
                    background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                    opacity: finishing ? 0.6 : 1,
                    boxShadow: '0 4px 20px rgba(37,99,235,0.2)',
                    transition: 'opacity 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!finishing) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-accent)'}
            >
                {finishing ? (
                    <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Finishing…</>
                ) : (
                    <>Go to Dashboard <ArrowRight size={18} /></>
                )}
            </button>
        </div>
    )
}

export default Step6Complete
