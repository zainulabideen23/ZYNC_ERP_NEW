import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { loansAPI } from '../services/api'
import { 
    Plus, Banknote, Calendar, DollarSign, Search, Filter, 
    TrendingDown, CreditCard, Trash2, Edit3, X, Building2,
    Clock, Percent, AlertCircle, CheckCircle, ChevronRight,
    Calculator, TrendingUp, Car, Home, Briefcase, Users
} from 'lucide-react'
import PageLoader from '../components/PageLoader'

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

const LOAN_TYPES = [
    { value: 'personal', label: 'Personal Loan', icon: Users },
    { value: 'car', label: 'Car/Auto Loan', icon: Car },
    { value: 'home', label: 'Home/Housing Loan', icon: Home },
    { value: 'business', label: 'Business Loan', icon: Briefcase },
    { value: 'working_capital', label: 'Working Capital', icon: TrendingUp },
]

function Loans() {
    const [loans, setLoans] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [showEmiCalculator, setShowEmiCalculator] = useState(false)
    const [showAmortization, setShowAmortization] = useState(false)
    const [selectedLoan, setSelectedLoan] = useState(null)
    const [paymentHistory, setPaymentHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [amortizationData, setAmortizationData] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [formData, setFormData] = useState({
        loan_reference: '', bank_name: '', loan_type: 'personal',
        interest_type: 'fixed', principal_amount: '', interest_rate: '', 
        base_rate: '', margin: '', start_date: '', end_date: '', 
        emi_amount: '', repayment_type: 'emi', 
        grace_period_type: 'none', grace_period_months: 0,
        collateral_details: '', notes: ''
    })
    const [emiCalc, setEmiCalc] = useState({ principal: '', rate: '', tenure: 12, start_date: '' })
    const [emiResult, setEmiResult] = useState(null)
    const [paymentData, setPaymentData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        principal_paid: '', interest_paid: '', total_payment: '', 
        payment_method: 'bank_transfer', reference_number: ''
    })
    // Store payment modal loan info separately to prevent re-render issues
    const [paymentLoanInfo, setPaymentLoanInfo] = useState({ outstanding_principal: 0, emi_amount: 0 })

    useEffect(() => { loadLoans() }, [])

    const loadLoans = async () => {
        try {
            setLoading(true)
            const res = await loansAPI.list()
            setLoans(res.loans || res.data?.loans || res.data || [])
        } catch (error) {
            console.error('Load loans error:', error.message)
            toast.error(error.message || 'Failed to load loan data')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await loansAPI.create(formData)
            toast.success('Loan created successfully!')
            setShowForm(false)
            setFormData({
                loan_reference: '', bank_name: '', loan_type: 'business',
                interest_type: 'fixed', principal_amount: '', interest_rate: '', 
                base_rate: '', margin: '', start_date: '', end_date: '', 
                emi_amount: '', repayment_type: 'emi', 
                grace_period_type: 'none', grace_period_months: 0,
                collateral_details: '', notes: ''
            })
            loadLoans()
        } catch (error) {
            toast.error(error.message || 'Failed to create loan')
        }
    }

    const handlePaymentSubmit = async (e) => {
        e.preventDefault()
        try {
            await loansAPI.createPayment(selectedLoan.id, paymentData)
            toast.success('Payment recorded!')
            
            // Get fresh loan data from API
            const updatedLoanData = await loansAPI.get(selectedLoan.id)
            const updatedLoan = updatedLoanData.data || updatedLoanData
            
            const newOutstanding = Number(updatedLoan.outstanding_principal || 0)
            const emiAmount = Number(updatedLoan.emi_amount || 0)
            const effectiveRate = updatedLoan.interest_type === 'floating' 
                ? Number(updatedLoan.base_rate || 0) + Number(updatedLoan.margin || 0)
                : Number(updatedLoan.interest_rate || 0)
            
            if (newOutstanding <= 0) {
                toast.success('Loan fully paid off!')
                setShowPaymentForm(false)
                setPaymentLoanInfo({ outstanding_principal: 0, emi_amount: 0 })
            } else if (emiAmount > 0) {
                // Recalculate payment amounts
                let interestPortion = 0
                let principalPortion = 0
                
                if (effectiveRate > 0) {
                    const monthlyRate = effectiveRate / 12 / 100;
                    interestPortion = Math.round(newOutstanding * monthlyRate);
                    principalPortion = emiAmount - interestPortion;
                } else {
                    principalPortion = emiAmount;
                }
                
                setPaymentLoanInfo({ 
                    outstanding_principal: newOutstanding, 
                    emi_amount: emiAmount, 
                    effective_rate: effectiveRate 
                })
                setPaymentData({
                    payment_date: new Date().toISOString().split('T')[0],
                    principal_paid: principalPortion.toString(),
                    interest_paid: interestPortion.toString(),
                    total_payment: emiAmount.toString(),
                    payment_method: 'bank_transfer',
                    reference_number: ''
                })
                toast.success('Ready for next payment!')
            }
            
            // Refresh loan list
            loadLoans()
        } catch (error) {
            toast.error(error.message || 'Failed to record payment')
        }
    }

    const openPaymentModal = (loan) => {
        const outstanding = Number(loan.outstanding_principal || loan.principal_amount || 0);
        
        const effectiveRate = loan.interest_type === 'floating' 
            ? Number(loan.base_rate || 0) + Number(loan.margin || 0)
            : Number(loan.interest_rate || 0);
        
        let interestPortion = 0;
        let principalPortion = 0;
        let emiAmount = Number(loan.emi_amount || 0);
        
        if (effectiveRate > 0 && emiAmount > 0) {
            const monthlyRate = effectiveRate / 12 / 100;
            interestPortion = Math.round(outstanding * monthlyRate);
            principalPortion = emiAmount - interestPortion;
        } else if (emiAmount > 0) {
            principalPortion = emiAmount;
            interestPortion = 0;
        }
        
        setSelectedLoan({...loan, outstanding_principal: outstanding})
        setPaymentLoanInfo({ outstanding_principal: outstanding, emi_amount: emiAmount, effective_rate: effectiveRate })
        setPaymentData({
            payment_date: new Date().toISOString().split('T')[0],
            principal_paid: emiAmount > 0 ? principalPortion : '',
            interest_paid: emiAmount > 0 ? interestPortion : '',
            total_payment: emiAmount > 0 ? emiAmount : '',
            payment_method: 'bank_transfer',
            reference_number: ''
        })
        setShowPaymentForm(true)
    }

    const handleTotalPaymentChange = (value) => {
        const total = Number(value || 0);
        const interest = Number(paymentData.interest_paid || 0);
        if (total >= interest) {
            const principal = total - interest;
            setPaymentData({...paymentData, total_payment: value, principal_paid: principal.toString()});
        } else {
            setPaymentData({...paymentData, total_payment: value});
        }
    }

    const handlePrincipalChange = (value) => {
        const principal = Number(value || 0);
        const interest = Number(paymentData.interest_paid || 0);
        setPaymentData({...paymentData, principal_paid: value, total_payment: (principal + interest).toString()});
    }

    const handleInterestChange = (value) => {
        const interest = Number(value || 0);
        const principal = Number(paymentData.principal_paid || 0);
        setPaymentData({...paymentData, interest_paid: value, total_payment: (principal + interest).toString()});
    }

    const applyFullEMI = () => {
        const emi = paymentLoanInfo.emi_amount || 0;
        const outstanding = paymentLoanInfo.outstanding_principal || 0;
        const rate = paymentLoanInfo.effective_rate || 0;
        
        if (rate > 0 && emi > 0) {
            const monthlyRate = rate / 12 / 100;
            const interestPortion = Math.round(outstanding * monthlyRate);
            const principalPortion = emi - interestPortion;
            setPaymentData({
                ...paymentData,
                principal_paid: principalPortion.toString(),
                interest_paid: interestPortion.toString(),
                total_payment: emi.toString()
            });
        }
    }

    const applyPrincipalOnly = () => {
        const interest = Number(paymentData.interest_paid || 0);
        const total = interest + Number(paymentData.principal_paid || 0);
        setPaymentData({
            ...paymentData,
            principal_paid: paymentLoanInfo.outstanding_principal.toString(),
            interest_paid: interest.toString(),
            total_payment: paymentLoanInfo.outstanding_principal.toString()
        });
    }

    const getRemainingBalance = () => {
        const principal = Number(paymentData.principal_paid || 0);
        const outstanding = paymentLoanInfo.outstanding_principal || 0;
        return Math.max(0, outstanding - principal);
    }

    const openAmortization = async (loan) => {
        setSelectedLoan(loan)
        setShowAmortization(true)
        try {
            const res = await loansAPI.getAmortization(loan.id)
            setAmortizationData(res.data || res)
        } catch (error) {
            console.error('Amortization Error:', error)
            toast.error(error.message || 'Failed to load amortization')
        }
    }

    const calculateEMI = async () => {
        if (!emiCalc.principal || !emiCalc.rate) {
            toast.error('Please enter principal and interest rate')
            return
        }
        try {
            const res = await loansAPI.calculateEMI({
                principal: emiCalc.principal,
                rate: emiCalc.rate,
                tenure_months: emiCalc.tenure,
                start_date: emiCalc.start_date
            })
            const emiData = res?.data || res
            if (emiData && emiData.emi) {
                setEmiResult(emiData)
            } else {
                console.log('Unexpected response:', res)
                toast.error('Invalid response from server')
            }
        } catch (error) {
            console.error('EMI Error:', error)
            toast.error(error.message || 'Failed to calculate EMI')
        }
    }

    const applyEMI = () => {
        if (emiResult) {
            setFormData({
                ...formData,
                principal_amount: emiResult.principal,
                interest_rate: emiResult.annual_rate,
                emi_amount: emiResult.emi,
                start_date: emiCalc.start_date || new Date().toISOString().split('T')[0]
            })
            setShowEmiCalculator(false)
            setShowForm(true)
        }
    }

    const openHistoryModal = async (loan) => {
        setSelectedLoan(loan)
        setShowHistoryModal(true)
        try {
            setHistoryLoading(true)
            const res = await loansAPI.getPayments(loan.id)
            setPaymentHistory(res.payments || res.data?.payments || [])
        } catch (error) {
            toast.error(error.message || 'Failed to load payment history')
        } finally {
            setHistoryLoading(false)
        }
    }

    const filteredLoans = loans.filter(loan => {
        const matchesSearch = loan.loan_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           loan.bank_name?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || loan.status === statusFilter
        const matchesType = typeFilter === 'all' || loan.loan_type === typeFilter
        return matchesSearch && matchesStatus && matchesType
    })

    const stats = {
        total: loans.length,
        active: loans.filter(l => l.status === 'active').length,
        outstanding: loans.reduce((sum, l) => sum + (l.outstanding_principal || 0), 0),
        interestPaid: loans.reduce((sum, l) => sum + (l.total_interest_paid || 0), 0)
    }

    const StatusBadge = ({ status }) => {
        const styles = {
            active: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: CheckCircle },
            paid_off: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', icon: CheckCircle },
            defaulted: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: AlertCircle }
        }
        const style = styles[status] || styles.active
        const Icon = style.icon
        return (
            <span style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                background: style.bg, color: style.color, textTransform: 'capitalize'
            }}>
                <Icon size={12} /> {status}
            </span>
        )
    }

    const PaymentStatusBadge = ({ status }) => {
        const styles = {
            on_time: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', label: 'On Time' },
            late: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'Late' },
            partial: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', label: 'Partial' }
        }
        const style = styles[status] || styles.on_time
        return (
            <span style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                background: style.bg, color: style.color
            }}>
                {style.label}
            </span>
        )
    }

    if (loading) return <PageLoader />

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Banknote size={24} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Bank Loans</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Manage your loans and track payments</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowEmiCalculator(true)} style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', 
                        background: 'var(--color-panel)', color: 'var(--color-text)', 
                        border: '1px solid var(--border-surface)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600
                    }}>
                        <Calculator size={18} /> EMI Calculator
                    </button>
                    <button onClick={() => setShowForm(true)} style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', 
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', 
                        border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Plus size={18} /> Add New Loan
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Loans', value: stats.total, icon: Banknote, color: '#3b82f6' },
                    { label: 'Outstanding', value: formatCurrency(stats.outstanding), icon: DollarSign, color: '#ef4444' },
                    { label: 'Interest Paid', value: formatCurrency(stats.interestPaid), icon: Percent, color: '#f59e0b' },
                    { label: 'Active Loans', value: stats.active, icon: CheckCircle, color: '#10b981' },
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
                            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                    <input 
                        type="text" 
                        placeholder="Search by reference or bank name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ 
                            width: '100%', padding: '12px 12px 12px 44px', borderRadius: '10px', 
                            border: '1px solid var(--border-surface)', background: 'var(--color-panel)', 
                            color: 'var(--color-text)', fontSize: '14px'
                        }}
                    />
                </div>
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ 
                        padding: '12px 16px', borderRadius: '10px', 
                        border: '1px solid var(--border-surface)', background: 'var(--color-panel)', 
                        color: 'var(--color-text)', fontSize: '14px', minWidth: '140px'
                    }}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="paid_off">Paid Off</option>
                </select>
                <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{ 
                        padding: '12px 16px', borderRadius: '10px', 
                        border: '1px solid var(--border-surface)', background: 'var(--color-panel)', 
                        color: 'var(--color-text)', fontSize: '14px', minWidth: '140px'
                    }}
                >
                    <option value="all">All Types</option>
                    <option value="personal">Personal</option>
                    <option value="car">Car</option>
                    <option value="home">Home</option>
                    <option value="business">Business</option>
                    <option value="working_capital">Working Capital</option>
                </select>
            </div>

            {/* Loan Cards */}
            {filteredLoans.length === 0 ? (
                <div style={{ padding: '80px', textAlign: 'center', background: 'var(--color-panel)', borderRadius: '16px', border: '1px solid var(--border-surface)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Banknote size={40} color="#3b82f6" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>No loans found</h3>
                    <p style={{ color: 'var(--color-hint)', marginBottom: '20px' }}>{searchTerm ? 'Try adjusting your search' : 'Get started by adding your first loan'}</p>
                    <button onClick={() => setShowForm(true)} style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', 
                        background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500
                    }}>
                        <Plus size={18} /> Add First Loan
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                    {filteredLoans.map(loan => (
                        <div key={loan.id} style={{ 
                            background: 'var(--color-panel)', borderRadius: '16px', padding: '20px', 
                            border: '1px solid var(--border-surface)', transition: 'all 0.2s',
                            hover: { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
                        }}>
                            {/* Card Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>{loan.loan_reference}</span>
                                        <StatusBadge status={loan.status} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-hint)', fontSize: '13px' }}>
                                        <Building2 size={14} />
                                        <span>{loan.bank_name}</span>
                                        {loan.interest_type === 'floating' && (
                                            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '4px' }}>KIBOR</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(loan.principal_amount)}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-hint)' }}>Principal Amount</div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {loan.principal_amount > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>Repayment Progress</span>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
                                            {Math.round((loan.principal_amount - loan.outstanding_principal) / loan.principal_amount * 100)}%
                                        </span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${((loan.principal_amount - loan.outstanding_principal) / loan.principal_amount) * 100}%`,
                                            height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '4px'
                                        }} />
                                    </div>
                                </div>
                            )}

                            {/* Details Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px', padding: '16px 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                                <div>
                                    <p style={{ fontSize: '11px', color: 'var(--color-hint)', marginBottom: '4px' }}>Outstanding</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>{formatCurrency(loan.outstanding_principal)}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '11px', color: 'var(--color-hint)', marginBottom: '4px' }}>Interest Rate</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                                        {loan.interest_type === 'floating' 
                                            ? ((Number(loan.base_rate) || 0) + (Number(loan.margin) || 0)).toFixed(2) + '%' 
                                            : (loan.interest_rate || 0) + '%'}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '11px', color: 'var(--color-hint)', marginBottom: '4px' }}>Start Date</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{formatDate(loan.start_date)}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '11px', color: 'var(--color-hint)', marginBottom: '4px' }}>EMI</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(loan.emi_amount)}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => openPaymentModal(loan)} style={{ 
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '10px', background: '#10b981', color: '#fff', border: 'none', 
                                    borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px'
                                }}>
                                    <CreditCard size={16} /> Record Payment
                                </button>
                                <button onClick={() => openAmortization(loan)} style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '10px 14px', background: 'var(--color-bg)', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '8px', cursor: 'pointer', 
                                    fontWeight: 500, fontSize: '13px'
                                }} title="View Amortization">
                                    <Calculator size={16} />
                                </button>
                                <button onClick={() => openHistoryModal(loan)} style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '10px 14px', background: 'var(--color-bg)', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '8px', cursor: 'pointer', 
                                    fontWeight: 500, fontSize: '13px'
                                }} title="View Payment History">
                                    <Clock size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Loan Modal */}
            {showForm && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowForm(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '600px', 
                        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Create New Loan</h2>
                            <button onClick={() => setShowForm(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Loan Reference *</label>
                                    <input required type="text" value={formData.loan_reference} onChange={e => setFormData({...formData, loan_reference: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="e.g. HBL-2024-001" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Bank Name *</label>
                                    <input required type="text" value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="e.g. Habib Bank" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Loan Type</label>
                                    <select value={formData.loan_type} onChange={e => setFormData({...formData, loan_type: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}>
                                        <option value="personal">Personal Loan</option>
                                        <option value="car">Car/Auto Loan</option>
                                        <option value="home">Home/Housing Loan</option>
                                        <option value="business">Business Loan</option>
                                        <option value="working_capital">Working Capital</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Principal Amount *</label>
                                    <input required type="number" value={formData.principal_amount} onChange={e => setFormData({...formData, principal_amount: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="100000" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Interest Rate (%)</label>
                                    <input type="number" step="0.01" value={formData.interest_rate} onChange={e => setFormData({...formData, interest_rate: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="12.5" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Start Date *</label>
                                    <input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>End Date</label>
                                    <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Monthly EMI</label>
                                    <input type="number" value={formData.emi_amount} onChange={e => setFormData({...formData, emi_amount: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="Monthly payment" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Interest Type</label>
                                    <select value={formData.interest_type} onChange={e => setFormData({...formData, interest_type: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}>
                                        <option value="fixed">Fixed Rate</option>
                                        <option value="floating">Floating (KIBOR)</option>
                                    </select>
                                </div>
                                {formData.interest_type === 'floating' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>KIBOR Rate (%)</label>
                                            <input type="number" step="0.01" value={formData.base_rate} onChange={e => setFormData({...formData, base_rate: e.target.value})} 
                                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                                placeholder="e.g. 12.5" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Bank Margin (%)</label>
                                            <input type="number" step="0.01" value={formData.margin} onChange={e => setFormData({...formData, margin: e.target.value})} 
                                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                                placeholder="e.g. 2.5" />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Grace Period</label>
                                    <select value={formData.grace_period_type} onChange={e => setFormData({...formData, grace_period_type: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}>
                                        <option value="none">None</option>
                                        <option value="interest_only">Interest Only</option>
                                        <option value="full">Full (Principal + Interest)</option>
                                    </select>
                                </div>
                                {formData.grace_period_type !== 'none' && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Grace Period (Months)</label>
                                        <input type="number" value={formData.grace_period_months} onChange={e => setFormData({...formData, grace_period_months: e.target.value})} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                            placeholder="3" />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="submit" style={{ 
                                    flex: 1, padding: '14px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                                    color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px'
                                }}>Create Loan</button>
                                <button type="button" onClick={() => setShowForm(false)} style={{ 
                                    padding: '14px 24px', background: 'transparent', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '10px', cursor: 'pointer', fontWeight: 500
                                }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentForm && selectedLoan && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => { setShowPaymentForm(false); setPaymentLoanInfo({ outstanding_principal: 0, emi_amount: 0 }); }}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '450px',
                        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Record Payment</h2>
                                <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '4px' }}>{selectedLoan.loan_reference}</p>
                            </div>
                            <button onClick={() => { setShowPaymentForm(false); setPaymentLoanInfo({ outstanding_principal: 0, emi_amount: 0 }); }} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <form onSubmit={handlePaymentSubmit} style={{ padding: '24px' }}>
                            <div style={{ 
                                background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '16px', marginBottom: '20px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: 0 }}>Outstanding</p>
                                    <p style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', margin: 0 }}>{formatCurrency(paymentLoanInfo.outstanding_principal)}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: 0 }}>EMI</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{formatCurrency(paymentLoanInfo.emi_amount)}</p>
                                </div>
                            </div>
                            
                            {/* Quick Actions */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <button type="button" onClick={applyFullEMI} style={{ 
                                    flex: 1, padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', 
                                    border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                                }}>Full EMI</button>
                                <button type="button" onClick={applyPrincipalOnly} style={{ 
                                    flex: 1, padding: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', 
                                    border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                                }}>Principal Only</button>
                            </div>

                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Payment Date</label>
                                    <input required type="date" value={paymentData.payment_date} onChange={e => setPaymentData({...paymentData, payment_date: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Principal *</label>
                                        <input required type="number" value={paymentData.principal_paid} onChange={handlePrincipalChange} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Interest *</label>
                                        <input required type="number" value={paymentData.interest_paid} onChange={handleInterestChange} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Total Payment *</label>
                                    <input required type="number" value={paymentData.total_payment} onChange={handleTotalPaymentChange} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px', fontWeight: 600 }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Payment Method</label>
                                    <select value={paymentData.payment_method} onChange={e => setPaymentData({...paymentData, payment_method: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="cash">Cash</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Reference Number (Optional)</label>
                                    <input type="text" value={paymentData.reference_number} onChange={e => setPaymentData({...paymentData, reference_number: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="e.g. Transaction ID, Cheque #" />
                                </div>
                            </div>
                            
                            {/* Remaining Balance Preview */}
                            {paymentData.principal_paid && (
                                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--color-hint)' }}>Balance After Payment</span>
                                        <span style={{ fontSize: '16px', fontWeight: 700, color: getRemainingBalance() > 0 ? '#ef4444' : '#10b981' }}>
                                            {formatCurrency(getRemainingBalance())}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="submit" style={{ 
                                    flex: 1, padding: '14px', background: '#10b981', 
                                    color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px'
                                }}>Record Payment</button>
                                <button type="button" onClick={() => { setShowPaymentForm(false); setPaymentLoanInfo({ outstanding_principal: 0, emi_amount: 0 }); }} style={{ 
                                    padding: '14px 24px', background: 'transparent', color: 'var(--color-text)', 
                                    border: '1px solid var(--border-surface)', borderRadius: '10px', cursor: 'pointer', fontWeight: 500
                                }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment History Modal */}
            {showHistoryModal && selectedLoan && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowHistoryModal(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '600px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Payment History</h2>
                                <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '4px' }}>{selectedLoan.loan_reference} - {selectedLoan.bank_name}</p>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <div style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto' }}>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-hint)' }}>
                                    Loading payment history...
                                </div>
                            ) : paymentHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-hint)' }}>
                                    No payments recorded yet
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {paymentHistory.map((payment, index) => (
                                        <div key={payment.id || index} style={{ 
                                            background: 'var(--color-bg)', borderRadius: '12px', padding: '16px',
                                            border: '1px solid var(--border-surface)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                                                            Payment #{paymentHistory.length - index}
                                                        </span>
                                                        <PaymentStatusBadge status={payment.payment_status} />
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-hint)', marginTop: '2px' }}>
                                                        {formatDate(payment.payment_date)}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
                                                        {formatCurrency(payment.total_payment)}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-hint)', textTransform: 'capitalize' }}>
                                                        {payment.payment_method?.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                                                <div>
                                                    <p style={{ fontSize: '11px', color: 'var(--color-hint)', margin: '0 0 4px 0' }}>Principal</p>
                                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{formatCurrency(payment.principal_paid)}</p>
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '11px', color: 'var(--color-hint)', margin: '0 0 4px 0' }}>Interest</p>
                                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{formatCurrency(payment.interest_paid)}</p>
                                                </div>
                                            </div>
                                            {payment.late_penalty > 0 && (
                                                <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>Late Penalty (2%)</span>
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(payment.late_penalty)}</span>
                                                </div>
                                            )}
                                            {payment.reference_number && (
                                                <div style={{ fontSize: '11px', color: 'var(--color-hint)', marginTop: '8px' }}>
                                                    Ref: {payment.reference_number}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EMI Calculator Modal */}
            {showEmiCalculator && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowEmiCalculator(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '500px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Calculator size={24} color="#8b5cf6" />
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>EMI Calculator</h2>
                            </div>
                            <button onClick={() => setShowEmiCalculator(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Loan Amount (PKR) *</label>
                                    <input type="number" value={emiCalc.principal} onChange={e => setEmiCalc({...emiCalc, principal: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                        placeholder="500000" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Interest Rate (% p.a.) *</label>
                                        <input type="number" step="0.1" value={emiCalc.rate} onChange={e => setEmiCalc({...emiCalc, rate: e.target.value})} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} 
                                            placeholder="15" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Tenure (Months)</label>
                                        <select value={emiCalc.tenure} onChange={e => setEmiCalc({...emiCalc, tenure: e.target.value})} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}>
                                            <option value="12">12 months</option>
                                            <option value="24">24 months</option>
                                            <option value="36">36 months</option>
                                            <option value="48">48 months</option>
                                            <option value="60">60 months</option>
                                            <option value="72">72 months</option>
                                            <option value="84">84 months</option>
                                            <option value="120">120 months</option>
                                            <option value="180">180 months</option>
                                            <option value="240">240 months</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-dim)' }}>Start Date</label>
                                    <input type="date" value={emiCalc.start_date} onChange={e => setEmiCalc({...emiCalc, start_date: e.target.value})} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }} />
                                </div>
                            </div>
                            
                            {emiResult && (
                                <div style={{ 
                                    background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '20px', marginTop: '20px',
                                    textAlign: 'center'
                                }}>
                                    <p style={{ fontSize: '14px', color: 'var(--color-hint)', margin: '0 0 8px 0' }}>Monthly EMI</p>
                                    <p style={{ fontSize: '32px', fontWeight: 700, color: '#8b5cf6', margin: '0 0 16px 0' }}>{formatCurrency(emiResult.emi)}</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                                        <div>
                                            <p style={{ color: 'var(--color-hint)', margin: '0' }}>Total Interest</p>
                                            <p style={{ fontWeight: 600, color: 'var(--color-text)', margin: '4px 0 0 0' }}>{formatCurrency(emiResult.total_interest)}</p>
                                        </div>
                                        <div>
                                            <p style={{ color: 'var(--color-hint)', margin: '0' }}>Total Payment</p>
                                            <p style={{ fontWeight: 600, color: 'var(--color-text)', margin: '4px 0 0 0' }}>{formatCurrency(emiResult.total_payment)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button onClick={calculateEMI} style={{ 
                                    flex: 1, padding: '14px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
                                    color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px'
                                }}>Calculate</button>
                                {emiResult && (
                                    <button onClick={applyEMI} style={{ 
                                        padding: '14px', background: '#10b981', 
                                        color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600
                                    }}>Use This EMI</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Amortization Schedule Modal */}
            {showAmortization && selectedLoan && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }} onClick={() => setShowAmortization(false)}>
                    <div style={{ 
                        background: 'var(--color-panel)', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '90vh',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Amortization Schedule</h2>
                                <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '4px' }}>{selectedLoan.loan_reference} - {formatCurrency(selectedLoan.principal_amount)} @ {(selectedLoan.interest_type === 'floating' ? ((Number(selectedLoan.base_rate) || 0) + (Number(selectedLoan.margin) || 0)).toFixed(2) : selectedLoan.interest_rate)}%</p>
                            </div>
                            <button onClick={() => setShowAmortization(false)} style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', border: 'none', 
                                background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <X size={20} color="var(--color-hint)" />
                            </button>
                        </div>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-surface)', display: 'flex', justifyContent: 'space-around', background: 'var(--color-bg)' }}>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: '0' }}>Principal</p>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: '4px 0 0 0' }}>{formatCurrency(amortizationData?.summary?.total_principal)}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: '0' }}>Total Interest</p>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444', margin: '4px 0 0 0' }}>{formatCurrency(amortizationData?.summary?.total_interest)}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '12px', color: 'var(--color-hint)', margin: '0' }}>Monthly EMI</p>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', margin: '4px 0 0 0' }}>{formatCurrency(amortizationData?.summary?.total_emi / amortizationData?.schedule?.length || 0)}</p>
                            </div>
                        </div>
                        <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-hint)' }}>#</th>
                                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-hint)' }}>Date</th>
                                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-hint)' }}>EMI</th>
                                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-hint)' }}>Principal</th>
                                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-hint)' }}>Interest</th>
                                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-hint)' }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {amortizationData?.schedule?.map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                            <td style={{ padding: '8px', color: 'var(--color-text-dim)' }}>{row.month}</td>
                                            <td style={{ padding: '8px', color: 'var(--color-text)' }}>{formatDate(row.payment_date)}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-text)' }}>{formatCurrency(row.emi)}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: '#10b981' }}>{formatCurrency(row.principal)}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(row.interest)}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-text)' }}>{formatCurrency(row.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default Loans
