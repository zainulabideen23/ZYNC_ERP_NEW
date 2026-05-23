import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { suppliersAPI } from '../services/api'
import { formatPakistaniPhone } from '../utils/phoneFormat'
import { Truck, Plus, Search, X, Edit, FileText, Phone, User, ArrowUpRight, Activity } from 'lucide-react'

function Suppliers() {
    const [suppliers, setSuppliers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [insightsOpen, setInsightsOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const submittingRef = useRef(false)
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [selectedSupplier, setSelectedSupplier] = useState(null)
    const [supplierDashboard, setSupplierDashboard] = useState(null)
    const [supplierStatement, setSupplierStatement] = useState(null)
    const [formData, setFormData] = useState({
        code: '', name: '', phone_number: '', email: '',
        address_line1: '', city: '', contact_person: '',
        opening_balance: '0'
    })

    useEffect(() => { loadData() }, [search])

    const loadData = async () => {
        try {
            const response = await suppliersAPI.list({ search, limit: 100 })
            setSuppliers(response.data || [])
        } catch (error) {
            toast.error('Failed to load suppliers')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submittingRef.current) return
        submittingRef.current = true
        setSubmitting(true)
        try {
            const data = {
                ...formData,
                opening_balance: parseFloat(formData.opening_balance || 0)
            }
            if (editing) {
                await suppliersAPI.update(editing.id, data)
                toast.success('Supplier updated')
            } else {
                await suppliersAPI.create(data)
                toast.success('Supplier created')
            }
            setShowModal(false)
            setFormData({ code: '', name: '', phone_number: '', email: '', address_line1: '', city: '', contact_person: '', opening_balance: '0' })
            setEditing(null)
            loadData()
        } catch (error) {
            toast.error(error.message)
        } finally {
            submittingRef.current = false
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setFormData({ code: '', name: '', phone_number: '', email: '', address_line1: '', city: '', contact_person: '', opening_balance: '0' })
        setEditing(null)
    }

    const loadSupplierInsights = async (supplier, statementParams = { page: 1, limit: 20 }) => {
        if (!supplier?.id) return

        setInsightsLoading(true)
        try {
            const [dashboardRes, statementRes] = await Promise.all([
                suppliersAPI.getDashboard(supplier.id, { as_of_date: new Date().toISOString().split('T')[0] }),
                suppliersAPI.getStatement(supplier.id, statementParams),
            ])

            setSupplierDashboard(dashboardRes.data || null)
            setSupplierStatement(statementRes.data || null)
        } catch (error) {
            toast.error(error.message || 'Failed to load supplier insights')
            setSupplierDashboard(null)
            setSupplierStatement(null)
        } finally {
            setInsightsLoading(false)
        }
    }

    const openSupplierInsights = async (supplier) => {
        setSelectedSupplier(supplier)
        setInsightsOpen(true)
        await loadSupplierInsights(supplier)
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`
    const getSupplierBalance = (supplier) => Number(supplier.ledger_balance ?? supplier.current_balance ?? 0)

    const MetricCard = ({ label, value, icon: Icon, color, subtext }) => (
        <div style={{
            background: 'var(--color-panel)',
            border: '1px solid var(--border-surface)',
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            minWidth: 0,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = color + '40'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-surface)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
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
        total: suppliers.length,
        totalBalance: suppliers.reduce((sum, s) => sum + getSupplierBalance(s), 0)
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={20} color="#f59e0b" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Suppliers</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Manage your supplier network</p>
                    </div>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true) }} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)' }}>
                    <Plus size={16} />
                    Add Supplier
                </button>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard label="Total Suppliers" value={aggregates.total} icon={Truck} color="#f59e0b" subtext="In database" />
                <MetricCard label="Total Payable" value={formatCurrency(aggregates.totalBalance)} icon={ArrowUpRight} color="#ef4444" subtext="Outstanding balance" />
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-panel)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-surface)' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                    <input type="text" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--orange)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                </div>
            </div>

            {/* Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</th>
                            <th style={{ width: '160px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && suppliers.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '50px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '28px', height: '28px', background: 'var(--color-panel-2)', borderRadius: '6px' }} /><div style={{ width: '100px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></div></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '90px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '120px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} /></td>
                                    </tr>
                                ))}
                            </>
                        ) : suppliers.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Truck size={24} color="var(--color-hint)" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No suppliers found</p>
                                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Add your first supplier to get started</p>
                                    </div>
                                </div>
                            </td></tr>
                        ) : suppliers.map((s, index) => (
                            <tr key={s.id} style={{ borderBottom: index < suppliers.length - 1 ? '1px solid var(--border-light)' : 'none', background: 'var(--color-panel)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}>
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)' }}>{s.code || '-'}</span>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>
                                            {s.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{s.name}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                        <Phone size={12} color="var(--color-hint)" />
                                        {s.phone_number || '-'}
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                        <User size={12} color="var(--color-hint)" />
                                        {s.contact_person || '-'}
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: getSupplierBalance(s) > 0 ? '#ef4444' : 'var(--color-text)' }}>
                                    {formatCurrency(getSupplierBalance(s))}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => { setEditing(s); setFormData({ code: s.code || '', name: s.name, phone_number: s.phone_number || '', email: s.email || '', address_line1: s.address_line1 || '', city: s.city || '', contact_person: s.contact_person || '', opening_balance: '0' }); setShowModal(true) }} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} aria-label={`Edit ${s.name}`}>
                                            <Edit size={14} /> Edit
                                        </button>
                                        <button
                                            onClick={() => openSupplierInsights(s)}
                                            style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.35)', background: 'rgba(59, 130, 246, 0.12)', color: '#93c5fd', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            aria-label={`View insights for ${s.name}`}
                                        >
                                            <Activity size={14} /> Insights
                                        </button>
                                        <Link to={`/suppliers/${s.id}/ledger`} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: 'none', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }} aria-label={`View ledger for ${s.name}`}>
                                            <FileText size={14} /> Ledger
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{suppliers.length > 0 ? `Showing ${suppliers.length} suppliers` : 'No results'}</span>
                </div>
            </div>

            {/* Supplier Insights Drawer */}
            {insightsOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.72)', zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }}
                    onClick={() => setInsightsOpen(false)}
                >
                    <div
                        style={{ width: 'min(680px, 100%)', height: '100%', background: 'var(--color-panel)', borderLeft: '1px solid var(--border-surface)', display: 'flex', flexDirection: 'column' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text)' }}>{selectedSupplier?.name || 'Supplier'} Insights</h3>
                                <p style={{ margin: '4px 0 0', color: 'var(--color-hint)', fontSize: '12px' }}>Dashboard + statement from new supplier analytics endpoints</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => loadSupplierInsights(selectedSupplier)}
                                    style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '12px', cursor: 'pointer' }}
                                >
                                    Refresh
                                </button>
                                <button
                                    onClick={() => setInsightsOpen(false)}
                                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer' }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {insightsLoading ? (
                                <div style={{ color: 'var(--color-hint)', fontSize: '13px' }}>Loading supplier insights...</div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
                                        <InsightCard label="Outstanding" value={formatCurrency(supplierDashboard?.kpis?.outstanding_amount || 0)} />
                                        <InsightCard label="Total Purchases" value={formatCurrency(supplierDashboard?.kpis?.total_purchase_amount || 0)} />
                                        <InsightCard label="Total Paid" value={formatCurrency(supplierDashboard?.kpis?.total_paid || 0)} />
                                        <InsightCard label="Credit Usage" value={supplierDashboard?.kpis?.credit_usage_percent !== null && supplierDashboard?.kpis?.credit_usage_percent !== undefined ? `${Number(supplierDashboard.kpis.credit_usage_percent).toFixed(1)}%` : 'No limit'} />
                                    </div>

                                    {supplierDashboard?.aging?.buckets && (
                                        <div style={{ border: '1px solid var(--border-surface)', borderRadius: '10px', padding: '12px', background: 'var(--color-panel-2)' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Aging Buckets</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                                                <BucketCard title="0-30" amount={supplierDashboard.aging.buckets.current_0_30?.amount} />
                                                <BucketCard title="31-60" amount={supplierDashboard.aging.buckets.overdue_31_60?.amount} />
                                                <BucketCard title="61-90" amount={supplierDashboard.aging.buckets.overdue_61_90?.amount} />
                                                <BucketCard title="90+" amount={supplierDashboard.aging.buckets.overdue_90_plus?.amount} />
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ border: '1px solid var(--border-surface)', borderRadius: '10px', overflow: 'hidden' }}>
                                        <div style={{ padding: '10px 12px', background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)', fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                                            Statement Entries
                                        </div>
                                        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                            {(supplierStatement?.entries || []).length === 0 ? (
                                                <div style={{ padding: '14px', color: 'var(--color-hint)', fontSize: '13px' }}>No statement entries found for selected window.</div>
                                            ) : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                                            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', color: 'var(--color-muted)' }}>Date</th>
                                                            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', color: 'var(--color-muted)' }}>Reference</th>
                                                            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', color: 'var(--color-muted)' }}>Debit</th>
                                                            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', color: 'var(--color-muted)' }}>Credit</th>
                                                            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', color: 'var(--color-muted)' }}>Running</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(supplierStatement.entries || []).map((entry) => (
                                                            <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                                <td style={{ padding: '8px 10px', fontSize: '12px' }}>{entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : '-'}</td>
                                                                <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--color-text-dim)' }}>{entry.reference_label || entry.reference_type || '-'}</td>
                                                                <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{entry.entry_type === 'debit' ? formatCurrency(entry.amount) : '—'}</td>
                                                                <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{entry.entry_type === 'credit' ? formatCurrency(entry.amount) : '—'}</td>
                                                                <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(entry.running_balance)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Truck size={18} color="#f59e0b" />
                                </div>
                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Name *</label>
                                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Phone</label>
                                        <input type="text" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: formatPakistaniPhone(e.target.value) })} placeholder="+923001234567" maxLength={13} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Contact Person</label>
                                        <input type="text" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Email</label>
                                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Address</label>
                                    <textarea value={formData.address_line1} onChange={e => setFormData({ ...formData, address_line1: e.target.value })} rows="2" style={{ background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>City</label>
                                        <input type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    {!editing && (
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Opening Balance</label>
                                            <input type="number" value={formData.opening_balance} onChange={e => setFormData({ ...formData, opening_balance: e.target.value })} onWheel={e => e.target.blur()} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: submitting ? 'var(--color-panel-2)' : '#f59e0b', color: submitting ? 'var(--color-muted)' : '#fff', fontSize: '13px', fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.3)' }}>
                                    {submitting ? 'Saving...' : editing ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function InsightCard({ label, value }) {
    return (
        <div style={{ border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '10px', background: 'var(--color-panel-2)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>{value}</div>
        </div>
    )
}

function BucketCard({ title, amount }) {
    return (
        <div style={{ border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '8px', background: 'var(--color-panel)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{title}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>Rs. {Number(amount || 0).toLocaleString()}</div>
        </div>
    )
}

export default Suppliers
