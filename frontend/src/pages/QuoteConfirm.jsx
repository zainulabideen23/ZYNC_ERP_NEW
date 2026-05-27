import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { quotationPublicAPI } from '../services/api'

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`
const formatDateTime = (value) => {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

function QuoteConfirm() {
    const { token } = useParams()
    const [searchParams] = useSearchParams()
    const location = useLocation()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [payload, setPayload] = useState(null)

    const responseIntent = String(searchParams.get('response') || '').toLowerCase()

    useEffect(() => {
        const loadQuote = async () => {
            try {
                setLoading(true)
                const response = await quotationPublicAPI.getByToken(token)
                setPayload(response.data)
            } catch (err) {
                setError(err.message || 'Unable to load confirmation data')
            } finally {
                setLoading(false)
            }
        }

        loadQuote()
    }, [token])

    const quotation = payload?.quotation || location.state?.quotation

    const heading = useMemo(() => {
        const status = String(quotation?.status || '').toLowerCase()
        if (status === 'accepted' || responseIntent === 'accept') return 'Quotation Accepted'
        if (status === 'rejected' || responseIntent === 'reject') return 'Quotation Rejected'
        return 'Quotation Response Received'
    }, [quotation?.status, responseIntent])

    const toneColor = useMemo(() => {
        const status = String(quotation?.status || '').toLowerCase()
        if (status === 'accepted' || responseIntent === 'accept') return '#16a34a'
        if (status === 'rejected' || responseIntent === 'reject') return '#dc2626'
        return '#059669'
    }, [quotation?.status, responseIntent])

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
            <div style={{ maxWidth: '740px', margin: '0 auto' }}>
                <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
                    {loading && <p style={{ margin: 0, color: '#64748b' }}>Loading confirmation...</p>}

                    {!loading && error && (
                        <>
                            <h2 style={{ margin: '0 0 8px 0', color: '#b91c1c' }}>Unable to Confirm Response</h2>
                            <p style={{ margin: '0 0 14px 0', color: '#475569' }}>{error}</p>
                            <p style={{ margin: 0, color: '#64748b' }}>
                                If you need help, please contact the sender of this quotation.
                            </p>
                        </>
                    )}

                    {!loading && !error && (
                        <>
                            <h2 style={{ margin: '0 0 8px 0', color: toneColor }}>{heading}</h2>
                            <p style={{ margin: '0 0 18px 0', color: '#475569' }}>
                                Thank you. Your response has been recorded successfully.
                            </p>

                            {quotation && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                    <InfoRow label="Quotation #" value={quotation.quotation_number || '-'} />
                                    <InfoRow label="Customer" value={quotation.customer_name || '-'} />
                                    <InfoRow label="Status" value={String(quotation.status || '-').toUpperCase()} />
                                    <InfoRow label="Total" value={formatCurrency(quotation.total_amount)} />
                                    <InfoRow label="Responded At" value={formatDateTime(quotation.responded_at)} />
                                    <InfoRow label="Company" value={quotation.company_name || 'ZYNC ERP'} />
                                </div>
                            )}

                            {quotation?.customer_response_notes ? (
                                <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Your Notes</div>
                                    <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{quotation.customer_response_notes}</div>
                                </div>
                            ) : null}

                            <Link
                                to="/login"
                                style={{
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    color: '#475569',
                                    padding: '10px 14px',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    display: 'inline-block',
                                }}
                            >
                                Close
                            </Link>
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
            <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>{value || '-'}</div>
        </div>
    )
}

export default QuoteConfirm
