import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { customersAPI } from '../services/api'
import { format } from 'date-fns'
import { CreditCard, Plus, Search, X, User, Phone, DollarSign, Check, ArrowRight } from 'lucide-react'

function CustomerPayment() {
    const [customers, setCustomers] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    
    const [formData, setFormData] = useState({
        customer_id: '',
        amount: '',
        payment_method: 'cash',
        notes: '',
        payment_date: format(new Date(), 'yyyy-MM-dd')
    })

    useEffect(() => { loadCustomers() }, [])

    const loadCustomers = async () => {
        setLoading(true)
        try {
            const response = await customersAPI.list({ search: searchQuery, limit: 50 })
            setCustomers(response.data || [])
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e) => {
        setSearchQuery(e.target.value)
        setShowDropdown(true)
        if (e.target.value.length >= 2) {
            searchCustomers(e.target.value)
        } else if (e.target.value.length === 0) {
            loadCustomers()
        }
    }

    const searchCustomers = async (query) => {
        try {
            const response = await customersAPI.list({ search: query, limit: 20 })
            setCustomers(response.data || [])
        } catch (error) {
            console.error('Search error:', error)
        }
    }

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer)
        setFormData({ ...formData, customer_id: customer.id })
        setShowDropdown(false)
        setSearchQuery(customer.name)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!formData.customer_id) {
            toast.error('Please select a customer')
            return
        }
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Please enter a valid amount')
            return
        }
        if (selectedCustomer && parseFloat(formData.amount) > parseFloat(selectedCustomer.current_balance)) {
            toast.error('Payment amount cannot exceed customer balance')
            return
        }

        setSubmitting(true)
        try {
            await customersAPI.recordPayment(formData.customer_id, {
                amount: parseFloat(formData.amount),
                payment_method: formData.payment_method,
                notes: formData.notes,
                payment_date: formData.payment_date
            })
            toast.success('Payment recorded successfully')
            
            setFormData({
                customer_id: '',
                amount: '',
                payment_method: 'cash',
                notes: '',
                payment_date: format(new Date(), 'yyyy-MM-dd')
            })
            setSelectedCustomer(null)
            setSearchQuery('')
            
            loadCustomers()
        } catch (error) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const maxAmount = selectedCustomer ? parseFloat(selectedCustomer.current_balance) : 0
    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    return (
        <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={20} color="#10b981" />
                </div>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Customer Payment</h1>
                    <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Record payments received from customers</p>
                </div>
            </div>

            {/* Form Card */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '16px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <form onSubmit={handleSubmit}>
                    {/* Customer Selection */}
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>
                            Customer <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)', pointerEvents: 'none' }}>
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search customer by name or phone..."
                                value={searchQuery}
                                onChange={handleSearch}
                                onFocus={e => {
                                    setShowDropdown(true)
                                    e.target.style.borderColor = 'var(--green)'
                                }}
                                autoComplete="off"
                                style={{ width: '100%', height: '44px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '10px', paddingLeft: '40px', paddingRight: '12px', fontSize: '14px', color: 'var(--color-text)', outline: 'none' }}
                                onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                            />
                            {showDropdown && customers.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '10px', maxHeight: '280px', overflowY: 'auto', zIndex: 100, marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                                    {customers.map((customer) => (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            onClick={() => handleSelectCustomer(customer)}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
                                                    {customer.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{customer.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{customer.phone_number || 'No phone'}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '13px', fontWeight: 500, color: Number(customer.current_balance) > 0 ? '#f59e0b' : 'var(--color-text-dim)' }}>
                                                {formatCurrency(customer.current_balance)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Balance Display */}
                    {selectedCustomer && (
                        <div style={{ padding: '16px 24px', background: 'rgba(16, 185, 129, 0.05)', borderBottom: '1px solid var(--border-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={18} color="#f59e0b" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Outstanding Balance</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: Number(selectedCustomer.current_balance) > 0 ? '#f59e0b' : '#10b981' }}>
                                        {formatCurrency(selectedCustomer.current_balance)}
                                    </div>
                                </div>
                            </div>
                            <Check size={20} color="#10b981" />
                        </div>
                    )}

                    {/* Form Fields */}
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>
                                    Amount (Rs.) <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    min="0"
                                    max={maxAmount || undefined}
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    style={{ width: '100%', height: '44px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '10px', padding: '0 12px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', textAlign: selectedCustomer ? 'right' : 'left' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--green)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                                />
                                {maxAmount > 0 && (
                                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>Max: {formatCurrency(maxAmount)}</span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, amount: maxAmount.toString() })}
                                            style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                                        >
                                            Pay Full Amount
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>Payment Method</label>
                                <select
                                    value={formData.payment_method}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                    style={{ width: '100%', height: '44px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '10px', padding: '0 12px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--green)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>Payment Date</label>
                            <input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                style={{ width: '100%', height: '44px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '10px', padding: '0 12px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', colorScheme: 'dark' }}
                                onFocus={e => e.target.style.borderColor = 'var(--green)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>Notes (Optional)</label>
                            <textarea
                                rows="2"
                                placeholder="Add any notes about this payment..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                style={{ width: '100%', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '10px', padding: '12px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', resize: 'vertical' }}
                                onFocus={e => e.target.style.borderColor = 'var(--green)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                        <button
                            type="submit"
                            disabled={submitting || !formData.customer_id}
                            style={{ width: '100%', height: '48px', borderRadius: '10px', border: 'none', background: formData.customer_id ? '#10b981' : 'var(--color-panel)', color: formData.customer_id ? '#fff' : 'var(--color-muted)', fontSize: '15px', fontWeight: 600, cursor: formData.customer_id ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: formData.customer_id ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none', transition: 'all 0.2s' }}
                        >
                            {submitting ? (
                                <>
                                    <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    Record Payment
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default CustomerPayment
