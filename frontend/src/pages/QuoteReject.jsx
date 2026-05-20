import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { quotationPublicAPI } from '../services/api'

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`
const formatDate = (value) => {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString()
}

function QuoteReject() {
    const { token } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [notes, setNotes] = useState('')
    const [payload, setPayload] = useState(null)

    useEffect(() => {
        const loadQuote = async () => {
            try {
                setLoading(true)
                const response = await quotationPublicAPI.getByToken(token)
                setPayload(response.data)
            } catch (err) {
                setError(err.message || 'Unable to load quotation link')
            } finally {
                setLoading(false)
            }
        }

        loadQuote()
    }, [token])

    const quotation = payload?.quotation
    const blockedReason = useMemo(() => {
        if (!payload) return ''
        if (payload.token_expired) return 'This response link has expired. Please request a fresh quotation email.'
        if (payload.token_used) return 'This quotation has already been responded to.'
        if (!payload.token_valid) return 'This response link is no longer valid.'
        return ''
    }, [payload])

    const handleConfirmReject = async () => {
        if (!payload?.token_valid) return

        try {
            setSubmitting(true)
            const response = await quotationPublicAPI.respond(token, {
                response: 'reject',
                notes: notes.trim() || undefined,
            })

            navigate(`/quote/confirm/${encodeURIComponent(token)}?response=reject`, {
                replace: true,
                state: {
                    responseResult: response.data,
                    quotation,
                },
            })
        } catch (err) {
            setError(err.message || 'Failed to submit quotation response')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                <div style={{ marginBottom: '14px', color: '#475569', fontSize: '14px' }}>
                    Quotation Response
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
                    {loading && <p style={{ margin: 0, color: '#64748b' }}>Loading quotation...</p>}

                    {!loading && error && (
                        <div>
                            <h2 style={{ margin: '0 0 8px 0', color: '#b91c1c' }}>Unable to Continue</h2>
                            <p style={{ margin: 0, color: '#475569' }}>{error}</p>
                        </div>
                    )}

                    {!loading && !error && quotation && (
                        <>
                            <h2 style={{ margin: '0 0 8px 0', color: '#7f1d1d' }}>Reject Quotation</h2>
                            <p style={{ margin: '0 0 16px 0', color: '#475569' }}>
                                If you are declining this quotation, please confirm below and optionally share a reason.
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                <InfoRow label="Quotation #" value={quotation.quotation_number} />
                                <InfoRow label="Customer" value={quotation.customer_name || '-'} />
                                <InfoRow label="Date" value={formatDate(quotation.quotation_date)} />
                                <InfoRow label="Valid Until" value={formatDate(quotation.valid_until)} />
                                <InfoRow label="Total" value={formatCurrency(quotation.total_amount)} />
                                <InfoRow label="Status" value={String(quotation.status || '-').toUpperCase()} />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#334155', fontSize: '13px', fontWeight: 600 }}>
                                    Reason / Notes (optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                    placeholder="Share why this quotation is being rejected"
                                    style={{
                                        width: '100%',
                                        borderRadius: '10px',
                                        border: '1px solid #cbd5e1',
                                        padding: '10px',
                                        resize: 'vertical',
                                        fontSize: '14px',
                                    }}
                                />
                            </div>

                            {blockedReason ? (
                                <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b', marginBottom: '16px' }}>
                                    {blockedReason}
                                </div>
                            ) : null}

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={handleConfirmReject}
                                    disabled={submitting || Boolean(blockedReason)}
                                    style={{
                                        border: 'none',
                                        borderRadius: '10px',
                                        background: '#dc2626',
                                        color: '#fff',
                                        padding: '10px 16px',
                                        fontWeight: 600,
                                        cursor: submitting || blockedReason ? 'not-allowed' : 'pointer',
                                        opacity: submitting || blockedReason ? 0.7 : 1,
                                    }}
                                >
                                    {submitting ? 'Submitting...' : 'Confirm Reject'}
                                </button>

                                <Link
                                    to={`/quote/accept/${encodeURIComponent(token)}`}
                                    style={{
                                        borderRadius: '10px',
                                        border: '1px solid #cbd5e1',
                                        color: '#475569',
                                        padding: '10px 16px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                    }}
                                >
                                    Accept Instead
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function InfoRow({ label, value }) {
    return (
        <div style={{ padding: '10px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '12px' }}>{label}</div>
            <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>{value}</div>
        </div>
    )
}

export default QuoteReject
