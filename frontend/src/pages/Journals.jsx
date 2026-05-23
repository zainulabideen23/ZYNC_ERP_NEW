import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { journalsAPI, accountsAPI } from '../services/api'
import BankTransferModal from '../components/BankTransferModal'
import { FileText, Plus, Eye, ChevronRight, TrendingUp, TrendingDown, Check, X, ArrowRightLeft } from 'lucide-react'

function Journals() {
    const [journals, setJournals] = useState([])
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [viewingJournal, setViewingJournal] = useState(null)

    const [submitting, setSubmitting] = useState(false)
    const submittingRef = useRef(false)
    const [formData, setFormData] = useState({
        journal_date: format(new Date(), 'yyyy-MM-dd'),
        narration: '',
        entries: [
            { account_id: '', entry_type: 'debit', amount: '', narration: '' },
            { account_id: '', entry_type: 'credit', amount: '', narration: '' }
        ]
    })

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            const [jRes, aRes] = await Promise.all([
                journalsAPI.list(),
                accountsAPI.list()
            ])
            setJournals(jRes.data)
            setAccounts(aRes.data)
        } catch (error) {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const handleAddRow = () => {
        setFormData({ ...formData, entries: [...formData.entries, { account_id: '', entry_type: 'debit', amount: '', narration: '' }] })
    }

    const handleRemoveRow = (index) => {
        setFormData({ ...formData, entries: formData.entries.filter((_, i) => i !== index) })
    }

    const handleEntryChange = (index, field, value) => {
        const newEntries = [...formData.entries]
        newEntries[index][field] = value
        setFormData({ ...formData, entries: newEntries })
    }

    const totalDebits = formData.entries.filter(e => e.entry_type === 'debit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const totalCredits = formData.entries.filter(e => e.entry_type === 'credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submittingRef.current) return
        if (!isBalanced) {
            toast.error(`Journal is not balanced! Difference: Rs. ${Math.abs(totalDebits - totalCredits).toLocaleString()}`)
            return
        }
        submittingRef.current = true
        setSubmitting(true)
        try {
            await journalsAPI.create(formData)
            toast.success('Journal entry created')
            setShowModal(false)
            setFormData({
                journal_date: format(new Date(), 'yyyy-MM-dd'),
                narration: '',
                entries: [
                    { account_id: '', entry_type: 'debit', amount: '', narration: '' },
                    { account_id: '', entry_type: 'credit', amount: '', narration: '' }
                ]
            })
            loadData()
        } catch (error) {
            toast.error(error.message)
        } finally {
            submittingRef.current = false
            setSubmitting(false)
        }
    }

    const handleViewJournal = async (id) => {
        try {
            const res = await journalsAPI.get(id)
            setViewingJournal(res.data)
        } catch (error) {
            toast.error('Failed to load journal details')
        }
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const StatusBadge = ({ isBalanced }) => (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '6px',
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em',
            backgroundColor: isBalanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isBalanced ? '#10b981' : '#f59e0b'
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isBalanced ? '#10b981' : '#f59e0b' }} />
            {isBalanced ? 'POSTED' : 'DRAFT'}
        </span>
    )

    const TypeBadge = ({ type }) => (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '4px',
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
            backgroundColor: 'var(--color-panel-2)', color: 'var(--color-muted)', textTransform: 'uppercase'
        }}>
            {type || 'GENERAL'}
        </span>
    )

    const MetricCard = ({ label, value, icon: Icon, color, subtext }) => (
        <div style={{ background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '12px', padding: '20px', flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: `radial-gradient(circle, ${color}15 0%, transparent 70%)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', position: 'relative' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{subtext}</div>
        </div>
    )

    const aggregates = {
        total: journals.length,
        posted: journals.filter(j => j.is_balanced !== false).length,
        drafts: journals.filter(j => j.is_balanced === false).length
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} color="var(--blue)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>General Journals</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Record and manage journal entries</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowTransferModal(true)} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-text-dim)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRightLeft size={16} />
                        Bank Transfer
                    </button>
                    <button onClick={() => setShowModal(true)} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}>
                        <Plus size={16} />
                        New Entry
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard label="Total Entries" value={aggregates.total} icon={FileText} color="#3b82f6" subtext="All time" />
                <MetricCard label="Posted" value={aggregates.posted} icon={Check} color="#10b981" subtext="Balanced" />
                <MetricCard label="Drafts" value={aggregates.drafts} icon={X} color="#f59e0b" subtext="Pending" />
            </div>

            {/* Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Journal #</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Narration</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ width: '100px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && journals.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '200px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '60px', height: '20px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '60px', height: '24px', background: 'var(--color-panel-2)', borderRadius: '6px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} /></td>
                                    </tr>
                                ))}
                            </>
                        ) : journals.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FileText size={24} color="var(--color-hint)" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No journal entries found</p>
                                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Create your first journal entry</p>
                                    </div>
                                </div>
                            </td></tr>
                        ) : journals.map((j, index) => (
                            <tr key={j.id} style={{ borderBottom: index < journals.length - 1 ? '1px solid var(--border-light)' : 'none', background: 'var(--color-panel)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                    {format(new Date(j.journal_date), 'dd MMM yyyy')}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--blue)' }}>
                                        {j.journal_number || '-'}
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text)' }}>
                                    {j.description || j.narration || '-'}
                                </td>
                                <td style={{ padding: '14px 16px' }}><TypeBadge type={j.reference_type || j.journal_type} /></td>
                                <td style={{ padding: '14px 16px' }}><StatusBadge isBalanced={j.is_balanced !== false} /></td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <button onClick={() => handleViewJournal(j.id)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }} aria-label={`View details for journal ${j.journal_number}`}>
                                        <Eye size={14} /> Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{journals.length > 0 ? `Showing ${journals.length} entries` : 'No results'}</span>
                </div>
            </div>

            {/* Create Journal Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', width: '95%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={18} color="var(--blue)" />
                                </div>
                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>New Journal Entry</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Date</label>
                                        <input type="date" value={formData.journal_date} onChange={e => setFormData({ ...formData, journal_date: e.target.value })} required style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Global Narration</label>
                                        <input type="text" value={formData.narration} onChange={e => setFormData({ ...formData, narration: e.target.value })} placeholder="Main description..." required style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entries</h4>
                                        <button type="button" onClick={handleAddRow} style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Plus size={14} /> Add Row
                                        </button>
                                    </div>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border-surface)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--color-panel-2)', position: 'sticky', top: 0 }}>
                                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Account</th>
                                                    <th style={{ width: '100px', padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Type</th>
                                                    <th style={{ width: '130px', padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Amount</th>
                                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>Narration</th>
                                                    <th style={{ width: '50px', padding: '10px 12px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {formData.entries.map((entry, index) => (
                                                    <tr key={index} style={{ borderBottom: index < formData.entries.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <select value={entry.account_id} onChange={e => handleEntryChange(index, 'account_id', e.target.value)} required style={{ height: '36px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }}>
                                                                <option value="">Select...</option>
                                                                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <select value={entry.entry_type} onChange={e => handleEntryChange(index, 'entry_type', e.target.value)} style={{ height: '36px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }}>
                                                                <option value="debit">DEBIT</option>
                                                                <option value="credit">CREDIT</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <input type="number" value={entry.amount} onChange={e => handleEntryChange(index, 'amount', e.target.value)} onWheel={e => e.target.blur()} required style={{ height: '36px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%', textAlign: 'right' }} />
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <input type="text" value={entry.narration} onChange={e => handleEntryChange(index, 'narration', e.target.value)} placeholder="Entry notes..." style={{ height: '36px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <button type="button" onClick={() => handleRemoveRow(index)} disabled={formData.entries.length <= 2} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: formData.entries.length <= 2 ? 'not-allowed' : 'pointer', opacity: formData.entries.length <= 2 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <X size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--color-panel-2)', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '32px' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Total Debits</div>
                                            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(totalDebits)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Total Credits</div>
                                            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(totalCredits)}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: isBalanced ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {isBalanced ? <Check size={16} /> : <X size={16} />}
                                            {isBalanced ? 'Balanced' : `Out of Balance: ${formatCurrency(Math.abs(totalDebits - totalCredits))}`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={!isBalanced || submitting} style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: isBalanced && !submitting ? 'var(--blue)' : 'var(--color-panel-2)', color: isBalanced && !submitting ? '#fff' : 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: isBalanced && !submitting ? 'pointer' : 'not-allowed', boxShadow: isBalanced && !submitting ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none' }}>
                                    {submitting ? 'Saving...' : 'Create Journal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Journal Details Modal */}
            {viewingJournal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setViewingJournal(null)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', width: '95%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={18} color="var(--blue)" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Journal Details</h2>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--blue)' }}>{viewingJournal.journal_number}</span>
                                </div>
                            </div>
                            <button onClick={() => setViewingJournal(null)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ padding: '14px', background: 'var(--color-panel-2)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Date</div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{format(new Date(viewingJournal.journal_date), 'dd MMMM yyyy')}</div>
                                </div>
                                <div style={{ padding: '14px', background: 'var(--color-panel-2)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Source</div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{(viewingJournal.reference_type || viewingJournal.journal_type || 'general').toUpperCase()}</div>
                                </div>
                                <div style={{ gridColumn: '1 / -1', padding: '14px', background: 'var(--color-panel-2)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Narration</div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{viewingJournal.description || viewingJournal.narration || '-'}</div>
                                </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-panel-2)', borderRadius: '10px', overflow: 'hidden' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Debit</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Narration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingJournal.entries.map((entry, idx) => (
                                        <tr key={idx} style={{ borderBottom: idx < viewingJournal.entries.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{entry.account_name}</div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-hint)' }}>{entry.account_code}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: entry.entry_type === 'debit' ? 'var(--color-text)' : 'var(--color-hint)' }}>
                                                {entry.entry_type === 'debit' ? formatCurrency(entry.amount) : '-'}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: entry.entry_type === 'credit' ? 'var(--color-text)' : 'var(--color-hint)' }}>
                                                {entry.entry_type === 'credit' ? formatCurrency(entry.amount) : '-'}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-dim)' }}>{entry.narration || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-surface)' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Total</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(viewingJournal.entries.filter(e => e.entry_type === 'debit').reduce((s, e) => s + parseFloat(e.amount), 0))}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(viewingJournal.entries.filter(e => e.entry_type === 'credit').reduce((s, e) => s + parseFloat(e.amount), 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <BankTransferModal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} onSuccess={() => loadData()} />
        </div>
    )
}

export default Journals
