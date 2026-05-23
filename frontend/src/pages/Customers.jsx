import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { customersAPI } from '../services/api'
import { useAuthStore } from '../store/auth.store'
import { can } from '../utils/permissions'
import { formatPakistaniPhone } from '../utils/phoneFormat'
import { Users, Plus, Search, X, Edit, FileText, Trash2, UserCheck, Phone, MapPin, ArrowUpRight, ToggleLeft, ToggleRight } from 'lucide-react'

function Customers() {
    const { user } = useAuthStore()
    const userRole = user?.role || 'cashier'
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const submittingRef = useRef(false)
    const [formData, setFormData] = useState({
        code: '', name: '', phone_number: '', phone_number_alt: '', email: '',
        address_line1: '', address_line2: '', city: '', province_state: '',
        postal_code: '', country: 'Pakistan',
        credit_limit: '0', opening_balance: '0',
        company_name: '', cnic_number: '', is_active: true
    })

    useEffect(() => { loadData() }, [search])

    const loadData = async () => {
        try {
            const response = await customersAPI.list({ search, limit: 100 })
            setCustomers(response.data || [])
        } catch (error) {
            toast.error('Failed to load customers')
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
                credit_limit: parseFloat(formData.credit_limit),
                opening_balance: parseFloat(formData.opening_balance)
            }
            if (editingCustomer) {
                await customersAPI.update(editingCustomer.id, data)
                toast.success('Customer updated')
            } else {
                await customersAPI.create(data)
                toast.success('Customer created')
            }
            setShowModal(false)
            resetForm()
            loadData()
        } catch (error) {
            toast.error(error.message)
        } finally {
            submittingRef.current = false
            setSubmitting(false)
        }
    }

    const handleDelete = async (customer) => {
        try {
            await customersAPI.delete(customer.id)
            toast.success(`${customer.name} deleted`)
            setDeleteConfirm(null)
            loadData()
        } catch (error) {
            toast.error(error.message || 'Failed to delete customer')
        }
    }

    const resetForm = () => {
        setFormData({
            code: '', name: '', phone_number: '', phone_number_alt: '', email: '',
            address_line1: '', address_line2: '', city: '', province_state: '',
            postal_code: '', country: 'Pakistan',
            credit_limit: '0', opening_balance: '0',
            company_name: '', cnic_number: '', is_active: true
        })
        setEditingCustomer(null)
    }

    const openEditModal = (customer) => {
        setEditingCustomer(customer)
        setFormData({
            code: customer.code || '',
            name: customer.name,
            phone_number: customer.phone_number || '',
            phone_number_alt: customer.phone_number_alt || '',
            email: customer.email || '',
            address_line1: customer.address_line1 || '',
            address_line2: customer.address_line2 || '',
            city: customer.city || '',
            province_state: customer.province_state || '',
            postal_code: customer.postal_code || '',
            country: customer.country || 'Pakistan',
            credit_limit: customer.credit_limit || '0',
            opening_balance: customer.opening_balance || '0',
            company_name: customer.company_name || '',
            cnic_number: customer.cnic_number || '',
            is_active: customer.is_active !== false
        })
        setShowModal(true)
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`
    const getCustomerBalance = (customer) => Number(customer.ledger_balance ?? customer.current_balance ?? 0)

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
        total: customers.length,
        withBalance: customers.filter(c => getCustomerBalance(c) > 0).length,
        totalBalance: customers.reduce((sum, c) => sum + getCustomerBalance(c), 0)
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} color="#10b981" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Customers</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Manage your customer database</p>
                    </div>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true) }} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}>
                    <Plus size={16} />
                    Add Customer
                </button>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard label="Total Customers" value={aggregates.total} icon={Users} color="#10b981" subtext="In database" />
                <MetricCard label="With Balance" value={aggregates.withBalance} icon={UserCheck} color="#3b82f6" subtext="Have outstanding" />
                <MetricCard label="Total Receivable" value={formatCurrency(aggregates.totalBalance)} icon={ArrowUpRight} color="#f59e0b" subtext="Outstanding balance" />
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-panel)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-surface)' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                    <input type="text" placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--green)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
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
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>City</th>
                            {can(userRole, 'customers.change_credit') && (
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit Limit</th>
                            )}
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</th>
                            <th style={{ width: '200px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && customers.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '50px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '28px', height: '28px', background: 'var(--color-panel-2)', borderRadius: '6px' }} /><div style={{ width: '100px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></div></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '90px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '120px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} /></td>
                                    </tr>
                                ))}
                            </>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Users size={24} color="var(--color-hint)" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No customers found</p>
                                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Add your first customer to get started</p>
                                    </div>
                                </div>
                            </td></tr>
                        ) : customers.map((c, index) => (
                            <tr key={c.id} style={{ borderBottom: index < customers.length - 1 ? '1px solid var(--border-light)' : 'none', background: 'var(--color-panel)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}>
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)' }}>{c.code || '-'}</span>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{c.name}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                        <Phone size={12} color="var(--color-hint)" />
                                        {c.phone_number || '-'}
                                    </div>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                        <MapPin size={12} color="var(--color-hint)" />
                                        {c.city || '-'}
                                    </div>
                                </td>
                                {can(userRole, 'customers.change_credit') && (
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 500, color: 'var(--color-muted)' }}>
                                        {formatCurrency(c.credit_limit || 0)}
                                    </td>
                                )}
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: getCustomerBalance(c) > 0 ? '#f59e0b' : 'var(--color-text)' }}>
                                    {formatCurrency(getCustomerBalance(c))}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        {can(userRole, 'customers.edit') && (
                                            <button onClick={() => openEditModal(c)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} aria-label={`Edit ${c.name}`}>
                                                <Edit size={14} /> Edit
                                            </button>
                                        )}
                                        {can(userRole, 'customers.view_ledger') && (
                                            <Link to={`/customers/${c.id}/ledger`} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: 'none', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }} aria-label={`View ledger for ${c.name}`}>
                                                <FileText size={14} /> Ledger
                                            </Link>
                                        )}
                                        {can(userRole, 'customers.delete') && (
                                            <button onClick={() => setDeleteConfirm(c)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} aria-label={`Delete ${c.name}`}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{customers.length > 0 ? `Showing ${customers.length} customers` : 'No results'}</span>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', width: '90%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={18} color="#10b981" />
                                </div>
                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Code</label>
                                        <input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Name *</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Company Name</label>
                                        <input type="text" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>CNIC</label>
                                        <input type="text" value={formData.cnic_number} onChange={e => setFormData({ ...formData, cnic_number: e.target.value })} placeholder="XXXXX-XXXXXXX-X" style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Phone</label>
                                        <input type="text" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: formatPakistaniPhone(e.target.value) })} placeholder="+923001234567" maxLength={13} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Alt Phone</label>
                                        <input type="text" value={formData.phone_number_alt} onChange={e => setFormData({ ...formData, phone_number_alt: formatPakistaniPhone(e.target.value) })} placeholder="+923001234567" maxLength={13} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
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
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Address Line 2</label>
                                        <input type="text" value={formData.address_line2} onChange={e => setFormData({ ...formData, address_line2: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Postal Code</label>
                                        <input type="text" value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>City</label>
                                        <input type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Province/State</label>
                                        <input type="text" value={formData.province_state} onChange={e => setFormData({ ...formData, province_state: e.target.value })} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {can(userRole, 'customers.change_credit') && (
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Credit Limit</label>
                                            <input type="number" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: e.target.value })} onWheel={e => e.target.blur()} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </div>
                                    )}
                                    {!editingCustomer && (
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Opening Balance</label>
                                            <input type="number" value={formData.opening_balance} onChange={e => setFormData({ ...formData, opening_balance: e.target.value })} onWheel={e => e.target.blur()} style={{ height: '40px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </div>
                                    )}
                                </div>
                                {editingCustomer && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
                                        <button type="button" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: formData.is_active ? '#10b981' : '#6b7280', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 }} aria-label="Toggle active status">
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: formData.is_active ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                        </button>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: formData.is_active ? 'var(--color-text)' : 'var(--color-muted)' }}>
                                            {formData.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: submitting ? 'var(--color-panel-2)' : '#10b981', color: submitting ? 'var(--color-muted)' : '#fff', fontSize: '13px', fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)' }}>
                                    {submitting ? 'Saving...' : editingCustomer ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }} onClick={() => setDeleteConfirm(null)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', width: '90%', maxWidth: '400px', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', textAlign: 'center' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Trash2 size={22} color="#ef4444" />
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 8px 0' }}>Delete Customer?</h3>
                            <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: '0 0 4px 0' }}>This will permanently deactivate <strong>{deleteConfirm.name}</strong>.</p>
                            <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>Their transaction history will be preserved.</p>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-surface)', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button type="button" onClick={() => setDeleteConfirm(null)} style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button type="button" onClick={() => handleDelete(deleteConfirm)} style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Customers
