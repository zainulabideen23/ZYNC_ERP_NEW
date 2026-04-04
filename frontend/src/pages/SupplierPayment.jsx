import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { suppliersAPI, paymentsAPI } from '../services/api'
import { format } from 'date-fns'
import { ArrowLeftRight, Plus, Search, X, Truck, Phone, DollarSign, Check, ArrowRight, AlertCircle } from 'lucide-react'

function SupplierPayment() {
    const [suppliers, setSuppliers] = useState([])
    const [selectedSupplier, setSelectedSupplier] = useState(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [errors, setErrors] = useState({})
    const [touched, setTouched] = useState({})
    
    const [formData, setFormData] = useState({
        supplier_id: '',
        amount: '',
        payment_method: 'cash',
        notes: '',
        payment_date: format(new Date(), 'yyyy-MM-dd')
    })

    const searchInputRef = useRef(null)
    const amountInputRef = useRef(null)

    useEffect(() => { loadSuppliers() }, [])

    const loadSuppliers = async () => {
        setLoading(true)
        try {
            const response = await suppliersAPI.list({ search: searchQuery, limit: 50 })
            setSuppliers(response.data || [])
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
            searchSuppliers(e.target.value)
        } else if (e.target.value.length === 0) {
            loadSuppliers()
        }
    }

    const searchSuppliers = async (query) => {
        try {
            const response = await suppliersAPI.list({ search: query, limit: 20 })
            setSuppliers(response.data || [])
        } catch (error) {
            console.error('Search error:', error)
        }
    }

    const handleSelectSupplier = (supplier) => {
        setSelectedSupplier(supplier)
        setFormData({ ...formData, supplier_id: supplier.id })
        setShowDropdown(false)
        setSearchQuery(supplier.name)
        setErrors(prev => ({ ...prev, supplier_id: '' }))
        setTouched(prev => ({ ...prev, supplier_id: true }))
    }

    const validateForm = () => {
        const newErrors = {}
        if (!formData.supplier_id) {
            newErrors.supplier_id = 'Please select a supplier'
        }
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            newErrors.amount = 'Please enter a valid amount'
        }
        if (selectedSupplier && parseFloat(formData.amount) > parseFloat(selectedSupplier.current_balance)) {
            newErrors.amount = 'Payment amount cannot exceed supplier balance'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }))
        validateForm()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        setTouched({ supplier_id: true, amount: true })
        
        if (!validateForm()) {
            if (!formData.supplier_id && searchInputRef.current) {
                searchInputRef.current.focus()
            } else if (!formData.amount && amountInputRef.current) {
                amountInputRef.current.focus()
            }
            toast.error('Please fix the errors in the form')
            return
        }

        setSubmitting(true)
        try {
            await paymentsAPI.supplier({
                supplier_id: formData.supplier_id,
                amount: parseFloat(formData.amount),
                payment_method: formData.payment_method,
                notes: formData.notes,
                payment_date: formData.payment_date
            })
            toast.success('Supplier payment recorded successfully')
            
            setFormData({
                supplier_id: '',
                amount: '',
                payment_method: 'cash',
                notes: '',
                payment_date: format(new Date(), 'yyyy-MM-dd')
            })
            setSelectedSupplier(null)
            setSearchQuery('')
            setErrors({})
            setTouched({})
            
            loadSuppliers()
        } catch (error) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const maxAmount = selectedSupplier ? parseFloat(selectedSupplier.current_balance) : 0
    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`
    
    const isFormValid = formData.supplier_id && formData.amount && parseFloat(formData.amount) > 0

    return (
        <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowLeftRight size={20} color="#f59e0b" />
                </div>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Supplier Payment</h1>
                    <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Record payments made to suppliers</p>
                </div>
            </div>

            {/* Form Card */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '16px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <form onSubmit={handleSubmit} noValidate>
                    {/* Supplier Selection */}
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: touched.supplier_id && errors.supplier_id ? '#ef4444' : 'var(--color-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.02em' }}>
                            Supplier <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)', pointerEvents: 'none', zIndex: 1 }}>
                                <Search size={18} />
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search supplier by name or phone..."
                                value={searchQuery}
                                onChange={handleSearch}
                                onFocus={e => {
                                    setShowDropdown(true)
                                    e.target.style.borderColor = touched.supplier_id && errors.supplier_id ? '#ef4444' : '#f59e0b'
                                }}
                                onBlur={e => {
                                    setTimeout(() => setShowDropdown(false), 200)
                                    e.target.style.borderColor = touched.supplier_id && errors.supplier_id ? '#ef4444' : 'var(--border-surface)'
                                    handleBlur('supplier_id')
                                }}
                                autoComplete="off"
                                aria-label="Search for supplier"
                                aria-required="true"
                                aria-invalid={touched.supplier_id && !!errors.supplier_id}
                                aria-describedby={errors.supplier_id ? 'supplier-error' : undefined}
                                style={{ 
                                    width: '100%', 
                                    height: '48px', 
                                    background: 'var(--color-panel-2)', 
                                    border: touched.supplier_id && errors.supplier_id ? '2px solid #ef4444' : '2px solid var(--border-surface)', 
                                    borderRadius: '10px', 
                                    paddingLeft: '48px', 
                                    paddingRight: '14px', 
                                    fontSize: '14px', 
                                    color: 'var(--color-text)', 
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                            {showDropdown && suppliers.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '10px', maxHeight: '280px', overflowY: 'auto', zIndex: 100, marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                    {suppliers.map((supplier) => (
                                        <button
                                            key={supplier.id}
                                            type="button"
                                            onClick={() => handleSelectSupplier(supplier)}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            aria-label={`Select ${supplier.name}`}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#f59e0b' }}>
                                                    {supplier.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{supplier.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{supplier.phone_number || 'No phone'}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: Number(supplier.current_balance) > 0 ? '#ef4444' : 'var(--color-text-dim)' }}>
                                                {formatCurrency(supplier.current_balance)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {touched.supplier_id && errors.supplier_id && (
                            <div id="supplier-error" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>
                                <AlertCircle size={14} />
                                {errors.supplier_id}
                            </div>
                        )}
                    </div>

                    {/* Balance Display */}
                    {selectedSupplier && (
                        <div style={{ padding: '16px 24px', background: 'rgba(245, 158, 11, 0.05)', borderBottom: '1px solid var(--border-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={18} color="#ef4444" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Outstanding Balance</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: Number(selectedSupplier.current_balance) > 0 ? '#ef4444' : '#10b981' }}>
                                        {formatCurrency(selectedSupplier.current_balance)}
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
                                <label style={{ fontSize: '12px', fontWeight: 600, color: touched.amount && errors.amount ? '#ef4444' : 'var(--color-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.02em' }}>
                                    Amount (Rs.) <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: 'var(--color-hint)', pointerEvents: 'none' }}>Rs.</span>
                                    <input
                                        ref={amountInputRef}
                                        type="number"
                                        placeholder="0.00"
                                        min="0"
                                        max={maxAmount || undefined}
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        aria-label="Payment amount in rupees"
                                        aria-required="true"
                                        aria-invalid={touched.amount && !!errors.amount}
                                        aria-describedby={errors.amount ? 'amount-error' : undefined}
                                        style={{ 
                                            width: '100%', 
                                            height: '48px', 
                                            background: 'var(--color-panel-2)', 
                                            border: touched.amount && errors.amount ? '2px solid #ef4444' : '2px solid var(--border-surface)', 
                                            borderRadius: '10px', 
                                            paddingLeft: '50px', 
                                            paddingRight: '14px', 
                                            fontSize: '16px', 
                                            color: 'var(--color-text)', 
                                            outline: 'none',
                                            textAlign: 'right',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={e => e.target.style.borderColor = touched.amount && errors.amount ? '#ef4444' : '#f59e0b'}
                                        onBlur={e => { e.target.style.borderColor = touched.amount && errors.amount ? '#ef4444' : 'var(--border-surface)'; handleBlur('amount') }}
                                    />
                                </div>
                                {touched.amount && errors.amount && (
                                    <div id="amount-error" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>
                                        <AlertCircle size={14} />
                                        {errors.amount}
                                    </div>
                                )}
                                {maxAmount > 0 && !errors.amount && (
                                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>Max: {formatCurrency(maxAmount)}</span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, amount: maxAmount.toString() })}
                                            style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                                        >
                                            Pay Full Amount
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.02em' }}>
                                    Payment Method
                                </label>
                                <select
                                    value={formData.payment_method}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                    aria-label="Payment method"
                                    style={{ 
                                        width: '100%', 
                                        height: '48px', 
                                        background: 'var(--color-panel-2)', 
                                        border: '2px solid var(--border-surface)', 
                                        borderRadius: '10px', 
                                        paddingLeft: '14px', 
                                        paddingRight: '14px', 
                                        fontSize: '14px', 
                                        color: 'var(--color-text)', 
                                        outline: 'none', 
                                        cursor: 'pointer',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#f59e0b'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.02em' }}>
                                Payment Date
                            </label>
                            <input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                aria-label="Payment date"
                                style={{ 
                                    width: '100%', 
                                    height: '48px', 
                                    background: 'var(--color-panel-2)', 
                                    border: '2px solid var(--border-surface)', 
                                    borderRadius: '10px', 
                                    paddingLeft: '14px', 
                                    paddingRight: '14px', 
                                    fontSize: '14px', 
                                    color: 'var(--color-text)', 
                                    outline: 'none',
                                    colorScheme: 'dark',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.02em' }}>
                                Notes <span style={{ color: 'var(--color-hint)', fontWeight: 400 }}>(Optional)</span>
                            </label>
                            <textarea
                                rows="3"
                                placeholder="Add any notes about this payment..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                aria-label="Payment notes"
                                style={{ 
                                    width: '100%', 
                                    background: 'var(--color-panel-2)', 
                                    border: '2px solid var(--border-surface)', 
                                    borderRadius: '10px', 
                                    padding: '14px', 
                                    fontSize: '14px', 
                                    color: 'var(--color-text)', 
                                    outline: 'none', 
                                    resize: 'vertical',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ 
                                width: '100%', 
                                height: '52px', 
                                borderRadius: '10px', 
                                border: 'none', 
                                background: isFormValid ? '#f59e0b' : 'var(--color-panel)', 
                                color: isFormValid ? '#fff' : 'var(--color-muted)', 
                                fontSize: '15px', 
                                fontWeight: 600, 
                                cursor: isFormValid ? 'pointer' : 'not-allowed', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '10px', 
                                boxShadow: isFormValid ? '0 4px 16px rgba(245, 158, 11, 0.35)' : 'none', 
                                transition: 'all 0.2s'
                            }}
                        >
                            {submitting ? (
                                <>
                                    <span style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    Record Payment
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                        {!isFormValid && (
                            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--color-hint)' }}>
                                Select a supplier and enter an amount to continue
                            </p>
                        )}
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                
                @media (max-width: 640px) {
                    div[style*="grid-template-columns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    )
}

export default SupplierPayment
