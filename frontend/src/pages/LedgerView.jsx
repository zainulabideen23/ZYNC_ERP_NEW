import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { customersAPI, suppliersAPI, accountsAPI } from '../services/api'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'

function LedgerView({ type }) { // type: 'customer' | 'supplier'
    const { id } = useParams()
    const navigate = useNavigate()
    const [entity, setEntity] = useState(null)
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [openingBalance, setOpeningBalance] = useState(0)
    const [closingBalance, setClosingBalance] = useState(0)
    const [filters, setFilters] = useState({
        from_date: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'), // Start of this year
        to_date: format(new Date(), 'yyyy-MM-dd')
    })

    // API Mapping
    const api = type === 'customer' ? customersAPI : (type === 'supplier' ? suppliersAPI : accountsAPI)
    const entityName = type === 'customer' ? 'Customer' : (type === 'supplier' ? 'Supplier' : 'Account')
    const backLink = type === 'customer' ? '/customers' : (type === 'supplier' ? '/suppliers' : '/accounts')

    useEffect(() => {
        loadLedger()
    }, [id, filters.from_date, filters.to_date])

    const loadLedger = async () => {
        setLoading(true)
        try {
            const response = await api.getLedger(id, {
                from_date: filters.from_date,
                to_date: filters.to_date
            })

            setEntity(response.data[type])
            setEntries(response.data.entries)
            setOpeningBalance(response.data.opening_balance)
            setClosingBalance(response.data.closing_balance)
        } catch (error) {
            toast.error(error.message || 'Failed to load ledger')
            navigate(backLink)
        } finally {
            setLoading(false)
        }
    }

    const printLedger = () => {
        window.print()
    }

    if (loading) return <div className="page-container text-center p-6">Loading Ledger...</div>

    return (
        <div className="page-container ledger-view">
            <header className="page-header no-print">
                <div className="flex items-center gap-4">
                    <button className="btn btn-ghost" onClick={() => navigate(backLink)}>← Back</button>
                    <h1 className="page-title">{entityName} Ledger</h1>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={printLedger}>🖨️ Print</button>
                    <div className="date-filters flex gap-2">
                        <input
                            type="date"
                            className="form-input"
                            value={filters.from_date}
                            onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                        />
                        <span className="self-center">-</span>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.to_date}
                            onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                        />
                    </div>
                </div>
            </header>

            {entity && (
                <div className="card mb-6 ledger-header-card">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold mb-1">{entity.name}</h2>
                            <div className="text-secondary text-sm space-y-1">
                                <p>{entity.city ? `${entity.city}` : ''} {entity.phone ? ` • ${entity.phone}` : ''}</p>
                                <p className="font-mono text-muted">{entity.code}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-muted">Current Balance</div>
                            <div className={`text-2xl font-bold ${closingBalance > 0 ? (type === 'customer' ? 'text-success' : 'text-danger') : 'text-primary'}`}>
                                Rs. {Math.abs(closingBalance).toLocaleString()} <span className="text-sm font-normal text-muted">{closingBalance >= 0 ? (type === 'customer' ? 'Dr (Receivable)' : 'Cr (Payable)') : (type === 'customer' ? 'Cr (Advance)' : 'Dr (Advance)')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card p-0 overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: '120px' }}>Date</th>
                            <th>Description</th>
                            <th>Ref</th>
                            <th className="text-right" style={{ width: '150px' }}>{type === 'customer' ? 'Debit (Out)' : (type === 'supplier' ? 'Debit (Paid)' : 'Debit')}</th>
                            <th className="text-right" style={{ width: '150px' }}>{type === 'customer' ? 'Credit (In)' : (type === 'supplier' ? 'Credit (Bill)' : 'Credit')}</th>
                            <th className="text-right" style={{ width: '180px' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Opening Balance Row */}
                        <tr className="bg-tertiary">
                            <td className="font-bold text-muted" colSpan="5">Opening Balance b/f</td>
                            <td className="text-right font-bold">Rs. {Math.abs(openingBalance).toLocaleString()} <span className="text-xs text-muted">{openingBalance >= 0 ? (type === 'customer' ? 'Dr' : 'Cr') : (type === 'customer' ? 'Cr' : 'Dr')}</span></td>
                        </tr>

                        {entries.length === 0 ? (
                            <tr><td colSpan="6" className="text-center p-8 text-muted">No transactions found for this period</td></tr>
                        ) : (
                            entries.map((entry) => (
                                <tr key={entry.id}>
                                    <td>{format(new Date(entry.entry_date), 'dd MMM yyyy')}</td>
                                    <td>
                                        <div className="font-medium">{entry.narration}</div>
                                        <div className="text-xs text-muted font-mono">{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="font-mono text-xs">{entry.reference_type} #{entry.reference_id}</td>

                                    {/* Debit Amount */}
                                    <td className="text-right">
                                        {entry.entry_type === 'debit' ? (
                                            <span className="font-medium">Rs. {parseFloat(entry.amount).toLocaleString()}</span>
                                        ) : '-'}
                                    </td>

                                    {/* Credit Amount */}
                                    <td className="text-right">
                                        {entry.entry_type === 'credit' ? (
                                            <span className="font-medium">Rs. {parseFloat(entry.amount).toLocaleString()}</span>
                                        ) : '-'}
                                    </td>

                                    {/* Running Balance */}
                                    <td className="text-right font-bold text-primary">
                                        Rs. {Math.abs(entry.running_balance).toLocaleString()} <span className="text-xs text-muted font-normal">{entry.running_balance >= 0 ? 'Dr' : 'Cr'}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .page-container { padding: 0; }
                    .card { border: none; box-shadow: none; padding: 0; }
                    body { background: white; color: black; }
                    .table th { background: #f0f0f0 !important; color: black !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    )
}

export default LedgerView
