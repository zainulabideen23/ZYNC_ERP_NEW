import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { expensesAPI, accountsAPI } from '../services/api'
import { format } from 'date-fns'
import { Receipt, Plus, Search, X, DollarSign, Calendar, CreditCard, Trash2 } from 'lucide-react'

function Expenses() {
    const [expenses, setExpenses] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [dateRange, setDateRange] = useState({
        from: format(new Date(), 'yyyy-MM-01'),
        to: format(new Date(), 'yyyy-MM-dd')
    })
    const [formData, setFormData] = useState({
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        category_id: '',
        amount: '',
        payment_method: 'cash',
        description: ''
    })
    const [categoryName, setCategoryName] = useState('')

    useEffect(() => { loadData() }, [dateRange])

    const loadData = async () => {
        setLoading(true)
        try {
            const [data, cats] = await Promise.all([
                expensesAPI.list({ from_date: dateRange.from, to_date: dateRange.to }),
                expensesAPI.getCategories()
            ])
            setExpenses(data.data)
            setCategories(cats.data)
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await expensesAPI.create(formData)
            toast.success('Expense recorded')
            setShowModal(false)
            setFormData({ ...formData, amount: '', description: '' })
            loadData()
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleCreateCategory = async (e) => {
        e.preventDefault()
        if (!categoryName) return
        try {
            await expensesAPI.createCategory({ name: categoryName })
            toast.success('Category created')
            const cats = await expensesAPI.getCategories()
            setCategories(cats.data)
            setShowCategoryModal(false)
            setCategoryName('')
        } catch (error) {
            toast.error(error.message)
        }
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`
    const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)

    const StatusBadge = ({ method }) => {
        const colors = { cash: '#10b981', bank_transfer: '#3b82f6', cheque: '#f59e0b' }
        const labels = { cash: 'Cash', bank_transfer: 'Bank', cheque: 'Cheque' }
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '4px',
                fontSize: '11px', fontWeight: 500,
                backgroundColor: colors[method] + '20', color: colors[method]
            }}>
                {method ? labels[method] || method : '-'}
            </span>
        )
    }

    const MetricCard = ({ label, value, icon: Icon, color, subtext, accent }) => (
        <div style={{ background: accent ? 'linear-gradient(135deg, ' + color + ' 0%, ' + color + 'cc' : 'var(--color-panel)', borderRadius: '12px', padding: '20px', flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', border: accent ? 'none' : '1px solid var(--border-surface)' }}>
            {accent && <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', position: 'relative' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: accent ? 'rgba(255,255,255,0.7)' : 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: accent ? 'rgba(255,255,255,0.2)' : color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={accent ? '#fff' : color} />
                </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: accent ? '#fff' : 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ fontSize: '12px', color: accent ? 'rgba(255,255,255,0.7)' : 'var(--color-hint)' }}>{subtext}</div>
        </div>
    )

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Receipt size={20} color="#ef4444" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Expenses</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Track and manage business expenses</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                    <Plus size={16} />
                    New Expense
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard label="Total Expenses" value={formatCurrency(totalAmount)} icon={DollarSign} color="#ef4444" subtext={`${format(new Date(dateRange.from), 'MMM d')} — ${format(new Date(dateRange.to), 'MMM d, yyyy')}`} accent />
                <MetricCard label="Transactions" value={expenses.length} icon={Receipt} color="#64748b" subtext="This period" />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-panel)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-surface)' }}>
                <Calendar size={15} style={{ color: 'var(--color-hint)' }} />
                <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} style={{ height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', colorScheme: 'dark' }} />
                <span style={{ color: 'var(--color-hint)', fontSize: '12px' }}>to</span>
                <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} style={{ height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', colorScheme: 'dark' }} />
            </div>

            {/* Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Number</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recorded By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && expenses.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '20px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '150px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '50px', height: '20px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                    </tr>
                                ))}
                            </>
                        ) : expenses.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Receipt size={24} color="var(--color-hint)" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No expenses found for this period</p>
                                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Add your first expense to get started</p>
                                    </div>
                                    <button onClick={() => setShowModal(true)} style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Plus size={14} /> New Expense
                                    </button>
                                </div>
                            </td></tr>
                        ) : expenses.map((expense, index) => (
                            <tr key={expense.id} style={{ borderBottom: index < expenses.length - 1 ? '1px solid var(--border-light)' : 'none', background: 'var(--color-panel)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                    {format(new Date(expense.expense_date), 'dd MMM yyyy')}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)' }}>
                                        {expense.expense_number || '-'}
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 500, background: 'var(--color-panel-2)', padding: '4px 10px', borderRadius: '6px', color: 'var(--color-text)' }}>
                                        {expense.category_name}
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text)' }}>
                                    {expense.description || '-'}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <StatusBadge method={expense.payment_method} />
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>
                                    {formatCurrency(expense.amount)}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                    {expense.created_by_name || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{expenses.length > 0 ? `Showing ${expenses.length} expenses` : 'No results'}</span>
                </div>
            </div>

            {/* Create Expense Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', width: '95%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Receipt size={18} color="#ef4444" />
                                </div>
                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Record Expense</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Date <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="date" value={formData.expense_date} onChange={e => setFormData({ ...formData, expense_date: e.target.value })} required style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%', colorScheme: 'dark' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                                            Category <span style={{ color: '#ef4444' }}>*</span>
                                            <button type="button" onClick={() => setShowCategoryModal(true)} style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '12px' }}>+ Add New</button>
                                        </label>
                                        <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })} required style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%', cursor: 'pointer' }}>
                                            <option value="">Select...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Amount (Rs.) <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required min="0" step="0.01" placeholder="0.00" style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Payment Method</label>
                                        <select value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%', cursor: 'pointer' }}>
                                            <option value="cash">Cash</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="cheque">Cheque</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Description</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows="2" placeholder="Add details about this expense..." style={{ background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%', resize: 'vertical' }} />
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                                    Save Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Category Modal */}
            {showCategoryModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }} onClick={() => setShowCategoryModal(false)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '12px', width: '95%', maxWidth: '400px', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Add Expense Category</h3>
                            <button onClick={() => setShowCategoryModal(false)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={14} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateCategory}>
                            <div style={{ padding: '20px 24px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Category Name</label>
                                <input type="text" value={categoryName} onChange={e => setCategoryName(e.target.value)} required autoFocus placeholder="e.g. Office Supplies" style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowCategoryModal(false)} style={{ height: '38px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ height: '38px', padding: '0 14px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Expenses
