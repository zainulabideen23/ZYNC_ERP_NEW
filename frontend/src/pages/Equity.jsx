import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { equityAPI } from '../services/api'
import { useAuthStore } from '../store/auth.store'
import { 
    Plus, TrendingUp, TrendingDown, DollarSign, Calendar, 
    History, X, AlertTriangle, Lock
} from 'lucide-react'

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

function Equity() {
    const { user } = useAuthStore()
    const isAdmin = user?.role === 'admin'
    const [summary, setSummary] = useState(null)
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCapitalModal, setShowCapitalModal] = useState(false)
    const [showDrawingModal, setShowDrawingModal] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [capitalForm, setCapitalForm] = useState({
        amount: '', transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash', reference_number: '', notes: ''
    })
    const [drawingForm, setDrawingForm] = useState({
        amount: '', transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash', reference_number: '', notes: ''
    })
    const [closeForm, setCloseForm] = useState({
        fiscal_year_end: new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split('T')[0]
    })

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [summaryRes, transRes] = await Promise.all([
                equityAPI.getSummary(),
                equityAPI.getTransactions()
            ])
            setSummary(summaryRes.data || summaryRes)
            setTransactions(transRes.transactions || transRes.data?.transactions || [])
        } catch (error) {
            console.error('Load equity error:', error.message)
            toast.error(error.message || 'Failed to load equity data')
        } finally {
            setLoading(false)
        }
    }

    const handleCapitalSubmit = async (e) => {
        e.preventDefault()
        try {
            await equityAPI.recordCapital(capitalForm)
            toast.success('Capital contribution recorded!')
            setShowCapitalModal(false)
            setCapitalForm({ amount: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: 'cash', reference_number: '', notes: '' })
            loadData()
        } catch (error) {
            toast.error(error.message || 'Failed to record capital')
        }
    }

    const handleDrawingSubmit = async (e) => {
        e.preventDefault()
        try {
            await equityAPI.recordDrawing(drawingForm)
            toast.success('Owner drawing recorded!')
            setShowDrawingModal(false)
            setDrawingForm({ amount: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: 'cash', reference_number: '', notes: '' })
            loadData()
        } catch (error) {
            toast.error(error.message || 'Failed to record drawing')
        }
    }

    const handleCloseYear = async (e) => {
        e.preventDefault()
        try {
            const res = await equityAPI.closeYear(closeForm)
            toast.success(res.message || res.data?.message || 'Year closed')
            setShowCloseModal(false)
            loadData()
        } catch (error) {
            toast.error(error.message || 'Failed to close year')
        }
    }

    const stats = summary ? {
        capital: summary.accounts.find(a => a.code === '3001')?.current_balance || 0,
        drawings: summary.accounts.find(a => a.code === '3003')?.effective_balance || 0,
        retained: summary.accounts.find(a => a.code === '3002')?.current_balance || 0,
        periodIncome: summary.current_period_income || 0,
        total: summary.total_equity || 0
    } : { capital: 0, drawings: 0, retained: 0, periodIncome: 0, total: 0 }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={24} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Equity Management</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Track capital, drawings, and retained earnings</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowDrawingModal(true)} style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', 
                        background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600
                    }}>
                        <TrendingDown size={18} /> Record Drawing
                    </button>
                    <button onClick={() => setShowCapitalModal(true)} style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', 
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#fff', 
                        border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }}>
                        <Plus size={18} /> Add Capital
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Owner Capital (3001)', value: stats.capital, icon: DollarSign, color: '#10b981' },
                    { label: 'Owner Drawings (3003)', value: Math.abs(stats.drawings), icon: TrendingDown, color: '#ef4444', prefix: '-' },
                    { label: 'Retained Earnings (3002)', value: stats.retained, icon: History, color: '#f59e0b' },
                    { label: 'Total Equity', value: stats.total, icon: TrendingUp, color: '#8b5cf6' },
                ].map((stat, i) => (
                    <div key={i} style={{ 
                        background: 'var(--color-panel)', borderRadius: '16px', padding: '20px', 
                        border: '1px solid var(--border-surface)', display: 'flex', alignItems: 'center', gap: '16px'
                    }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <stat.icon size={24} color={stat.color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: 0 }}>{stat.label}</p>
                            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                                {stat.prefix === '-' ? '-' : ''}{formatCurrency(stat.value)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Current Period Income */}
            {stats.periodIncome !== 0 && (
                <div style={{ 
                    background: stats.periodIncome > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                    borderRadius: '12px', padding: '16px', marginBottom: '24px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={20} color={stats.periodIncome > 0 ? '#10b981' : '#ef4444'} />
                        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>Current Period Net {stats.periodIncome > 0 ? 'Profit' : 'Loss'}</span>
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: stats.periodIncome > 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(stats.periodIncome)}
                    </span>
                </div>
            )}

            {/* Equity Accounts Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-surface)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Equity Accounts</h2>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Code</th>
                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Account Name</th>
                            <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Balance</th>
                            <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Effective</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summary?.accounts.map((acc) => (
                            <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{acc.code}</td>
                                <td style={{ padding: '12px', fontSize: '14px', color: 'var(--color-text)' }}>{acc.name}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--color-text)' }}>{formatCurrency(acc.current_balance)}</td>
                                <td style={{ 
                                    padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 600,
                                    color: acc.effective_balance >= 0 ? '#10b981' : '#ef4444'
                                }}>{formatCurrency(acc.effective_balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Equity Transactions */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-surface)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Recent Equity Activity</h2>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Account</th>
                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Type</th>
                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Narration</th>
                            <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', color: 'var(--color-hint)', fontWeight: 600 }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--color-hint)', fontSize: '13px' }}>
                                    No equity activity recorded yet
                                </td>
                            </tr>
                        ) : transactions.map((transaction) => (
                            <tr key={transaction.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--color-text)' }}>{formatDate(transaction.journal_date)}</td>
                                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                                    <span style={{ fontWeight: 600 }}>{transaction.account_code}</span> {transaction.account_name}
                                </td>
                                <td style={{ padding: '12px', fontSize: '13px', color: transaction.entry_type === 'credit' ? '#10b981' : '#ef4444', textTransform: 'capitalize', fontWeight: 600 }}>
                                    {transaction.entry_type}
                                </td>
                                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--color-text-dim)' }}>{transaction.narration || '-'}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(transaction.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Year End Close */}
            {isAdmin && <div style={{ 
                background: 'var(--color-panel)', borderRadius: '16px', padding: '20px', 
                border: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Year-End Closing</h3>
                    <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Close income & expense accounts to retained earnings</p>
                </div>
                <button onClick={() => setShowCloseModal(true)} style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
                    background: 'var(--color-bg)', color: 'var(--color-text)', 
                    border: '1px solid var(--border-surface)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500
                }}>
                    <Lock size={16} /> Close Year
                </button>
            </div>}

            {/* Capital Contribution Modal */}
            {showCapitalModal && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowCapitalModal(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '500px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Capital Contribution</h2>
                            <button onClick={() => setShowCapitalModal(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <form onSubmit={handleCapitalSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Amount *</label>
                                    <input required type="number" value={capitalForm.amount} onChange={e => setCapitalForm({...capitalForm, amount: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="100000" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Date *</label>
                                    <input required type="date" value={capitalForm.transaction_date} onChange={e => setCapitalForm({...capitalForm, transaction_date: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Reference</label>
                                    <input type="text" value={capitalForm.reference_number} onChange={e => setCapitalForm({...capitalForm, reference_number: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="Optional reference" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="submit" style={{ 
                                    flex: 1, padding: '14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                                    color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px'
                                }}>Record Contribution</button>
                                <button type="button" onClick={() => setShowCapitalModal(false)} style={{ 
                                    padding: '14px 24px', background: 'transparent', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '10px', cursor: 'pointer', fontWeight: 500
                                }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Owner Drawing Modal */}
            {showDrawingModal && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowDrawingModal(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '500px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Owner Drawing</h2>
                            <button onClick={() => setShowDrawingModal(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <form onSubmit={handleDrawingSubmit} style={{ padding: '24px' }}>
                            <div style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', padding: '16px', marginBottom: '20px',
                                display: 'flex', alignItems: 'center', gap: '12px'
                            }}>
                                <AlertTriangle size={20} color="#ef4444" />
                                <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                                    Drawings reduce owner's equity in the business
                                </span>
                            </div>
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Amount *</label>
                                    <input required type="number" value={drawingForm.amount} onChange={e => setDrawingForm({...drawingForm, amount: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="50000" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Date *</label>
                                    <input required type="date" value={drawingForm.transaction_date} onChange={e => setDrawingForm({...drawingForm, transaction_date: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Reference</label>
                                    <input type="text" value={drawingForm.reference_number} onChange={e => setDrawingForm({...drawingForm, reference_number: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="Optional reference" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="submit" style={{ 
                                    flex: 1, padding: '14px', background: '#ef4444', 
                                    color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px'
                                }}>Record Drawing</button>
                                <button type="button" onClick={() => setShowDrawingModal(false)} style={{ 
                                    padding: '14px 24px', background: 'transparent', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '10px', cursor: 'pointer', fontWeight: 500
                                }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Year End Close Modal */}
            {showCloseModal && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowCloseModal(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '450px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Year-End Closing</h2>
                            <button onClick={() => setShowCloseModal(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <form onSubmit={handleCloseYear} style={{ padding: '24px' }}>
                            <div style={{ 
                                background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '16px', marginBottom: '20px'
                            }}>
                                <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: '0 0 8px 0' }}>
                                    This will:
                                </p>
                                <ul style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0, paddingLeft: '20px' }}>
                                    <li>Zero out all income accounts (4000 series)</li>
                                    <li>Zero out all expense accounts (5000-6000 series)</li>
                                    <li>Transfer net profit/loss to Retained Earnings</li>
                                </ul>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Fiscal Year End Date *</label>
                                <input required type="date" value={closeForm.fiscal_year_end} onChange={e => setCloseForm({...closeForm, fiscal_year_end: e.target.value})} 
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="submit" style={{ 
                                    flex: 1, padding: '14px', background: '#8b5cf6', 
                                    color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px'
                                }}>Close Year</button>
                                <button type="button" onClick={() => setShowCloseModal(false)} style={{ 
                                    padding: '14px 24px', background: 'transparent', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '10px', cursor: 'pointer', fontWeight: 500
                                }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default Equity
