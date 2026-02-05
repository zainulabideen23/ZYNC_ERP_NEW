import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { journalsAPI, accountsAPI } from '../services/api'

function Journals() {
    const [journals, setJournals] = useState([])
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [viewingJournal, setViewingJournal] = useState(null)

    // New Journal State
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
        setFormData({
            ...formData,
            entries: [...formData.entries, { account_id: '', entry_type: 'debit', amount: '', narration: '' }]
        })
    }

    const handleRemoveRow = (index) => {
        setFormData({
            ...formData,
            entries: formData.entries.filter((_, i) => i !== index)
        })
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
        if (!isBalanced) {
            toast.error(`Journal is not balanced! Difference: Rs. ${Math.abs(totalDebits - totalCredits).toLocaleString()}`)
            return
        }

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

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">General Journals</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Journal Entry</button>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Journal #</th>
                                <th>Narration</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {journals.map((j) => (
                                <tr key={j.id}>
                                    <td>{format(new Date(j.journal_date), 'dd/MM/yyyy')}</td>
                                    <td className="font-mono">{j.journal_number || '-'}</td>
                                    <td>{j.description || j.narration || '-'}</td>
                                    <td><span className="badge badge-secondary">{(j.reference_type || j.journal_type || 'GENERAL').toUpperCase()}</span></td>
                                    <td><span className="badge badge-success">{j.is_balanced !== false ? 'POSTED' : 'DRAFT'}</span></td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleViewJournal(j.id)}>View Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Journal Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
                        <h2>New Journal Entry</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-2 mb-6" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-input" value={formData.journal_date} onChange={e => setFormData({ ...formData, journal_date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Global Narration</label>
                                    <input type="text" className="form-input" value={formData.narration} onChange={e => setFormData({ ...formData, narration: e.target.value })} placeholder="Main description..." required />
                                </div>
                            </div>

                            <div className="table-container mb-6" style={{ maxHeight: '400px', overflow: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Account</th>
                                            <th style={{ width: '120px' }}>Type</th>
                                            <th style={{ width: '150px' }}>Amount</th>
                                            <th>Narration</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.entries.map((entry, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <select className="form-select" value={entry.account_id} onChange={e => handleEntryChange(index, 'account_id', e.target.value)} required>
                                                        <option value="">Select Account...</option>
                                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select className="form-select" value={entry.entry_type} onChange={e => handleEntryChange(index, 'entry_type', e.target.value)}>
                                                        <option value="debit">DEBIT</option>
                                                        <option value="credit">CREDIT</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <input type="number" className="form-input text-right" value={entry.amount} onChange={e => handleEntryChange(index, 'amount', e.target.value)} required />
                                                </td>
                                                <td>
                                                    <input type="text" className="form-input" value={entry.narration} onChange={e => handleEntryChange(index, 'narration', e.target.value)} placeholder="Entry notes..." />
                                                </td>
                                                <td>
                                                    <button type="button" className="btn btn-ghost" onClick={() => handleRemoveRow(index)} disabled={formData.entries.length <= 2}>✕</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <button type="button" className="btn btn-secondary btn-sm mb-6" onClick={handleAddRow}>+ Add Row</button>

                            <div className="card bg-tertiary" style={{ padding: 'var(--space-4)' }}>
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-6">
                                        <div>
                                            <div className="text-secondary text-xs uppercase">Total Debits</div>
                                            <div className="text-lg font-bold">Rs. {totalDebits.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-secondary text-xs uppercase">Total Credits</div>
                                            <div className="text-lg font-bold">Rs. {totalCredits.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-bold ${isBalanced ? 'text-success' : 'text-danger'}`}>
                                            {isBalanced ? '✓ Balanced' : `✕ Out of Balance: Rs. ${Math.abs(totalDebits - totalCredits).toLocaleString()}`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button type="submit" className="btn btn-primary" disabled={!isBalanced}>Post Journal</button>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Journal Details Modal */}
            {viewingJournal && (
                <div className="modal-overlay" onClick={() => setViewingJournal(null)}>
                    <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2>Journal Details - {viewingJournal.journal_number}</h2>
                            <button className="btn btn-ghost" onClick={() => setViewingJournal(null)}>✕</button>
                        </div>
                        <div className="grid grid-2 mb-6 text-sm text-secondary">
                            <div><strong>Date:</strong> {format(new Date(viewingJournal.journal_date), 'dd MMMM yyyy')}</div>
                            <div><strong>Source:</strong> {viewingJournal.journal_type.toUpperCase()}</div>
                            <div className="col-span-2"><strong>Narration:</strong> {viewingJournal.narration}</div>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Account</th>
                                        <th className="text-right">Debit</th>
                                        <th className="text-right">Credit</th>
                                        <th>Narration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingJournal.entries.map((entry, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="font-medium">{entry.account_name}</div>
                                                <div className="text-xs text-muted font-mono">{entry.account_code}</div>
                                            </td>
                                            <td className="text-right">
                                                {entry.entry_type === 'debit' ? `Rs. ${Number(entry.amount).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="text-right">
                                                {entry.entry_type === 'credit' ? `Rs. ${Number(entry.amount).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="text-sm text-secondary">{entry.narration}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold">
                                        <td>Total</td>
                                        <td className="text-right">Rs. {viewingJournal.entries.filter(e => e.entry_type === 'debit').reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</td>
                                        <td className="text-right">Rs. {viewingJournal.entries.filter(e => e.entry_type === 'credit').reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
                .badge-secondary { background: var(--color-bg-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
                .badge-success { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; padding: 28px; width: 95%; max-height: 90vh; overflow-y: auto; }
                .bg-tertiary { background: var(--color-bg-tertiary); }
                .col-span-2 { grid-column: span 2; }
            `}</style>
        </div>
    )
}

export default Journals
