import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'
import { customersAPI, suppliersAPI, backupAPI, settingsAPI } from '../services/api'
import {
    Settings as SettingsIcon, Building2, Receipt, Landmark, TrendingUp, User,
    Database, Download, Trash2, Plus, Edit2, X, Check, AlertTriangle, RefreshCw,
    ChevronRight, CreditCard, Info, Copy, Eye, EyeOff
} from 'lucide-react'
import './Settings.css'

function Settings() {
    const { user, updateOnboardingStep } = useAuthStore()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('company')
    const [customers, setCustomers] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [backups, setBackups] = useState([])
    const [loading, setLoading] = useState(false)
    const [backupLoading, setBackupLoading] = useState(false)
    const [editingBalance, setEditingBalance] = useState(null)
    const [balanceValue, setBalanceValue] = useState('')
    const [showIBAN, setShowIBAN] = useState(false)
    const [showAccount, setShowAccount] = useState(false)
    const [savedCards, setSavedCards] = useState({})

    const [companyInfo, setCompanyInfo] = useState({
        name: '', phone: '', city: '', address: '',
        ntn_number: '', strn_number: '',
        default_tax_rate: 0,
        financial_year_start: 7, financial_year_end: 6,
        email: '', website: '',
        logo_url: '', bank_name: '', bank_account_number: '', bank_iban: '', bank_branch_code: ''
    })
    const [companySaving, setCompanySaving] = useState(false)
    const [companyLoading, setCompanyLoading] = useState(false)

    const [formErrors, setFormErrors] = useState({})
    const [touched, setTouched] = useState({})

    useEffect(() => {
        if (activeTab === 'company') {
            loadCompanyInfo()
        } else if (activeTab === 'balances') {
            loadData()
        } else if (activeTab === 'backup') {
            loadBackups()
        }
    }, [activeTab])

    const loadCompanyInfo = async () => {
        try {
            setCompanyLoading(true)
            const res = await settingsAPI.getCompanyInfo()
            if (res.data) {
                setCompanyInfo(prev => ({ ...prev, ...res.data }))
            }
        } catch (error) {
            toast.error('Failed to load company info')
        } finally {
            setCompanyLoading(false)
        }
    }

    const validateField = (name, value) => {
        switch (name) {
            case 'ntn_number':
                if (value && !/^\d{7}$/.test(value)) return 'NTN must be exactly 7 digits'
                break
            case 'strn_number':
                if (value && !/^\d{13}$/.test(value)) return 'STRN must be exactly 13 digits'
                break
            case 'bank_iban':
                if (value && !/^PK\d{2}[A-Z0-9]{30,32}$/.test(value.toUpperCase())) return 'Enter valid IBAN format (PKXX...)'
                break
            case 'default_tax_rate':
                if (value < 0 || value > 100) return 'Tax rate must be between 0 and 100'
                break
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address'
                break
            case 'phone':
                if (value && !/^[\d\-\s\+]{7,20}$/.test(value)) return 'Enter a valid phone number'
                break
        }
        return null
    }

    const handleFieldChange = (field, value) => {
        setCompanyInfo(prev => ({ ...prev, [field]: value }))
        
        if (touched[field]) {
            const error = validateField(field, value)
            setFormErrors(prev => ({ ...prev, [field]: error }))
        }
    }

    const handleFieldBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }))
        const error = validateField(field, companyInfo[field])
        setFormErrors(prev => ({ ...prev, [field]: error }))
    }

    const handleSaveSection = async (section, data) => {
        try {
            setCompanySaving(true)
            await settingsAPI.updateCompanyInfo(data)
            setSavedCards(prev => ({ ...prev, [section]: true }))
            toast.success(`${section} saved successfully`, {
                icon: <Check size={18} style={{ color: 'var(--green)' }} />
            })
            setTimeout(() => {
                setSavedCards(prev => ({ ...prev, [section]: false }))
            }, 3000)
        } catch (error) {
            toast.error(`Failed to save ${section}: ${error.message}`)
        } finally {
            setCompanySaving(false)
        }
    }

    const loadBackups = async () => {
        try {
            setBackupLoading(true)
            const res = await backupAPI.list()
            setBackups(res.data)
        } catch (error) {
            toast.error('Failed to load backups')
        } finally {
            setBackupLoading(false)
        }
    }

    const handleCreateBackup = async () => {
        try {
            setBackupLoading(true)
            await backupAPI.create()
            toast.success('Backup created successfully')
            loadBackups()
        } catch (error) {
            toast.error(`Backup failed: ${error.message}`)
        } finally {
            setBackupLoading(false)
        }
    }

    const handleDeleteBackup = async (filename) => {
        if (!window.confirm(`Delete ${filename}? This cannot be undone.`)) return
        try {
            await backupAPI.delete(filename)
            toast.success('Backup deleted')
            loadBackups()
        } catch (error) {
            toast.error('Failed to delete backup')
        }
    }

    const handleDownloadBackup = (filename) => {
        backupAPI.download(filename)
    }

    const loadData = async () => {
        try {
            setLoading(true)
            const [customersRes, suppliersRes] = await Promise.all([
                customersAPI.list({ limit: 500 }),
                suppliersAPI.list({ limit: 500 })
            ])
            setCustomers(customersRes.data)
            setSuppliers(suppliersRes.data)
        } catch (error) {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const handleEditBalance = (type, id, currentValue) => {
        setEditingBalance({ type, id })
        setBalanceValue(currentValue?.toString() || '0')
    }

    const handleSaveBalance = async () => {
        if (!editingBalance) return

        try {
            const value = parseFloat(balanceValue) || 0
            await new Promise(resolve => setTimeout(resolve, 500))

            toast.success(`Opening balance updated`, {
                icon: <Check size={18} style={{ color: 'var(--green)' }} />
            })
            setEditingBalance(null)
            loadData()
        } catch (error) {
            toast.error(`Failed to update balance: ${error.message}`)
        }
    }

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`)
    }

    const tabs = [
        { id: 'company', label: 'Company', icon: Building2 },
        { id: 'balances', label: 'Opening Balances', icon: CreditCard },
        { id: 'backup', label: 'Backup', icon: Database }
    ]

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const renderFieldError = (field) => {
        if (touched[field] && formErrors[field]) {
            return (
                <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> {formErrors[field]}
                </span>
            )
        }
        return null
    }

    const renderFieldSuccess = (field, condition) => {
        if (touched[field] && !formErrors[field] && condition) {
            return (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--green)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} /> Valid format
                </span>
            )
        }
        return null
    }

    return (
        <div className="settings-container">
            <div className="settings-header">
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--muted-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <SettingsIcon size={20} style={{ color: 'var(--muted)' }} />
                </div>
                <h1>Settings</h1>
                <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: '4px', marginLeft: '52px' }}>
                    Manage your company settings and preferences
                </p>
            </div>

            <div className="settings-tabs">
                <div className="settings-tabs-list">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`settings-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                            aria-pressed={activeTab === tab.id}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'company' && (
                <div className="settings-grid">
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-icon blue">
                                <Building2 size={18} />
                            </div>
                            <h2>Business Identity</h2>
                        </div>

                        {companyLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: '48px' }} />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="settings-form">
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Company Name <span style={{ color: 'var(--red)' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={companyInfo.name || ''}
                                            onChange={(e) => handleFieldChange('name', e.target.value)}
                                            onBlur={() => handleFieldBlur('name')}
                                            placeholder="Enter company name"
                                            style={{ height: '48px' }}
                                            aria-required="true"
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Address
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={companyInfo.address || ''}
                                            onChange={(e) => handleFieldChange('address', e.target.value)}
                                            placeholder="Full address"
                                            style={{ height: '48px' }}
                                        />
                                    </div>

                                    <div className="settings-form-row">
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                                City
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={companyInfo.city || ''}
                                                onChange={(e) => handleFieldChange('city', e.target.value)}
                                                placeholder="City"
                                                style={{ height: '48px' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                                Phone
                                            </label>
                                            <input
                                                type="tel"
                                                className="form-input"
                                                value={companyInfo.phone || ''}
                                                onChange={(e) => handleFieldChange('phone', e.target.value)}
                                                onBlur={() => handleFieldBlur('phone')}
                                                placeholder="042-35761234"
                                                style={{ height: '48px' }}
                                            />
                                            {renderFieldError('phone')}
                                        </div>
                                    </div>

                                    <div className="settings-form-row">
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={companyInfo.email || ''}
                                                onChange={(e) => handleFieldChange('email', e.target.value)}
                                                onBlur={() => handleFieldBlur('email')}
                                                placeholder="company@example.com"
                                                style={{ height: '48px' }}
                                            />
                                            {renderFieldError('email')}
                                            {renderFieldSuccess('email', companyInfo.email)}
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                                Website
                                            </label>
                                            <input
                                                type="url"
                                                className="form-input"
                                                value={companyInfo.website || ''}
                                                onChange={(e) => handleFieldChange('website', e.target.value)}
                                                placeholder="www.example.com"
                                                style={{ height: '48px' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveSection('Business Identity', {
                                        name: companyInfo.name,
                                        address: companyInfo.address,
                                        city: companyInfo.city,
                                        phone: companyInfo.phone,
                                        email: companyInfo.email,
                                        website: companyInfo.website
                                    })}
                                    disabled={companySaving}
                                    className="btn btn-primary settings-save-button"
                                >
                                    {companySaving ? (
                                        <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                                    ) : savedCards['Business Identity'] ? (
                                        <><Check size={16} /> Saved!</>
                                    ) : (
                                        <><Check size={16} /> Save Changes</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-icon purple">
                                <Receipt size={18} />
                            </div>
                            <h2>Invoice Branding</h2>
                        </div>

                        {companyLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: '48px' }} />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="settings-form">
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Logo URL
                                        </label>
                                        <input
                                            type="url"
                                            className="form-input"
                                            value={companyInfo.logo_url || ''}
                                            onChange={(e) => handleFieldChange('logo_url', e.target.value)}
                                            placeholder="https://example.com/logo.png"
                                            style={{ height: '48px' }}
                                        />
                                        {companyInfo.logo_url && (
                                            <div className="settings-logo-preview">
                                                <img
                                                    src={companyInfo.logo_url}
                                                    alt="Logo preview"
                                                    style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }}
                                                    onError={(e) => { e.target.style.display = 'none' }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            NTN Number
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={companyInfo.ntn_number || ''}
                                            onChange={(e) => handleFieldChange('ntn_number', e.target.value)}
                                            onBlur={() => handleFieldBlur('ntn_number')}
                                            placeholder="7-digit NTN"
                                            maxLength={7}
                                            style={{ height: '48px', fontFamily: 'monospace', letterSpacing: '0.1em' }}
                                            aria-describedby="ntn-help"
                                        />
                                        <div id="ntn-help" className="settings-help-text">
                                            <Info size={12} /> 7 digits (e.g., 1234567)
                                        </div>
                                        {renderFieldError('ntn_number')}
                                        {renderFieldSuccess('ntn_number', companyInfo.ntn_number?.length === 7)}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            STRN Number
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={companyInfo.strn_number || ''}
                                            onChange={(e) => handleFieldChange('strn_number', e.target.value)}
                                            onBlur={() => handleFieldBlur('strn_number')}
                                            placeholder="13-digit STRN"
                                            maxLength={13}
                                            style={{ height: '48px', fontFamily: 'monospace', letterSpacing: '0.1em' }}
                                            aria-describedby="strn-help"
                                        />
                                        <div id="strn-help" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Info size={12} /> 13 digits (e.g., 1234567890123)
                                        </div>
                                        {renderFieldError('strn_number')}
                                        {renderFieldSuccess('strn_number', companyInfo.strn_number?.length === 13)}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveSection('Invoice Branding', {
                                        logo_url: companyInfo.logo_url,
                                        ntn_number: companyInfo.ntn_number,
                                        strn_number: companyInfo.strn_number
                                    })}
                                    disabled={companySaving}
                                    className="btn btn-primary settings-save-button"
                                >
                                    {companySaving ? (
                                        <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                                    ) : savedCards['Invoice Branding'] ? (
                                        <><Check size={16} /> Saved!</>
                                    ) : (
                                        <><Check size={16} /> Save Changes</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-icon green">
                                <Landmark size={18} />
                            </div>
                            <h2>Bank Details</h2>
                        </div>

                        {companyLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: '48px' }} />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="settings-form">
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Bank Name
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={companyInfo.bank_name || ''}
                                            onChange={(e) => handleFieldChange('bank_name', e.target.value)}
                                            placeholder="e.g. Habib Bank Limited"
                                            style={{ height: '48px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Account Number
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showAccount ? 'text' : 'password'}
                                                className="form-input"
                                                value={companyInfo.bank_account_number || ''}
                                                onChange={(e) => handleFieldChange('bank_account_number', e.target.value)}
                                                placeholder="Account number"
                                                style={{ height: '48px', paddingRight: '48px', fontFamily: 'monospace' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAccount(!showAccount)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    color: 'var(--muted)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    minWidth: '44px',
                                                    minHeight: '44px',
                                                    justifyContent: 'center'
                                                }}
                                                aria-label={showAccount ? 'Hide account number' : 'Show account number'}
                                            >
                                                {showAccount ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        {companyInfo.bank_account_number && (
                                            <button
                                                onClick={() => copyToClipboard(companyInfo.bank_account_number, 'Account number')}
                                                style={{
                                                    fontSize: 'var(--text-xs)',
                                                    color: 'var(--blue)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    marginTop: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Copy size={12} /> Copy
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            IBAN
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showIBAN ? 'text' : 'password'}
                                                className="form-input"
                                                value={companyInfo.bank_iban || ''}
                                                onChange={(e) => handleFieldChange('bank_iban', e.target.value)}
                                                onBlur={() => handleFieldBlur('bank_iban')}
                                                placeholder="PK00BANK0000000000000000"
                                                maxLength={34}
                                                style={{ height: '48px', fontFamily: 'monospace', letterSpacing: '0.05em', paddingRight: '48px' }}
                                                aria-describedby="iban-help"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowIBAN(!showIBAN)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    color: 'var(--muted)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    minWidth: '44px',
                                                    minHeight: '44px',
                                                    justifyContent: 'center'
                                                }}
                                                aria-label={showIBAN ? 'Hide IBAN' : 'Show IBAN'}
                                            >
                                                {showIBAN ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        <div id="iban-help" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Info size={12} /> 34 characters starting with PK
                                        </div>
                                        {renderFieldError('bank_iban')}
                                        {renderFieldSuccess('bank_iban', /^PK\d{2}[A-Z0-9]{30,32}$/.test(companyInfo.bank_iban?.toUpperCase() || ''))}
                                        {companyInfo.bank_iban && (
                                            <button
                                                onClick={() => copyToClipboard(companyInfo.bank_iban, 'IBAN')}
                                                style={{
                                                    fontSize: 'var(--text-xs)',
                                                    color: 'var(--blue)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    marginTop: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Copy size={12} /> Copy
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Branch Code
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={companyInfo.bank_branch_code || ''}
                                            onChange={(e) => handleFieldChange('bank_branch_code', e.target.value)}
                                            placeholder="Branch code"
                                            style={{ height: '48px' }}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveSection('Bank Details', {
                                        bank_name: companyInfo.bank_name,
                                        bank_account_number: companyInfo.bank_account_number,
                                        bank_iban: companyInfo.bank_iban,
                                        bank_branch_code: companyInfo.bank_branch_code
                                    })}
                                    disabled={companySaving}
                                    className="btn btn-primary settings-save-button"
                                >
                                    {companySaving ? (
                                        <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                                    ) : savedCards['Bank Details'] ? (
                                        <><Check size={16} /> Saved!</>
                                    ) : (
                                        <><Check size={16} /> Save Changes</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-icon orange">
                                <TrendingUp size={18} />
                            </div>
                            <h2>Financial Settings</h2>
                        </div>

                        {companyLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: '48px' }} />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="settings-form">
                                    <div>
                                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                            Default Tax Rate (%)
                                        </label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={companyInfo.default_tax_rate ?? 0}
                                            onChange={(e) => handleFieldChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                                            onBlur={() => handleFieldBlur('default_tax_rate')}
                                            style={{ height: '48px' }}
                                            aria-describedby="tax-help"
                                        />
                                        <div id="tax-help" className="settings-help-text">
                                            <Info size={12} /> Applied to new invoices (0-100%)
                                        </div>
                                        {renderFieldError('default_tax_rate')}
                                    </div>
                                    <div className="settings-form-row">
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                                FY Start Month
                                            </label>
                                            <select
                                                className="form-select"
                                                value={companyInfo.financial_year_start ?? 7}
                                                onChange={(e) => handleFieldChange('financial_year_start', parseInt(e.target.value))}
                                                style={{ height: '48px' }}
                                            >
                                                {months.map((m, i) => (
                                                    <option key={i + 1} value={i + 1}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                                FY End Month
                                            </label>
                                            <select
                                                className="form-select"
                                                value={companyInfo.financial_year_end ?? 6}
                                                onChange={(e) => handleFieldChange('financial_year_end', parseInt(e.target.value))}
                                                style={{ height: '48px' }}
                                            >
                                                {months.map((m, i) => (
                                                    <option key={i + 1} value={i + 1}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="settings-info-box">
                                        <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        Financial year affects report date ranges and fiscal period calculations.
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveSection('Financial Settings', {
                                        default_tax_rate: companyInfo.default_tax_rate,
                                        financial_year_start: companyInfo.financial_year_start,
                                        financial_year_end: companyInfo.financial_year_end
                                    })}
                                    disabled={companySaving}
                                    className="btn btn-primary"
                                    style={{ marginTop: 'var(--space-4)', minHeight: '44px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
                                >
                                    {companySaving ? (
                                        <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                                    ) : savedCards['Financial Settings'] ? (
                                        <><Check size={16} /> Saved!</>
                                    ) : (
                                        <><Check size={16} /> Save Changes</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <div style={{
                        background: 'var(--color-panel)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--purple-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <User size={18} style={{ color: 'var(--purple)' }} />
                            </div>
                            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--color-text)' }}>
                                User Profile
                            </h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                    Username
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={user?.username || ''}
                                    disabled
                                    style={{ height: '48px', opacity: 0.7 }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={user?.fullName || ''}
                                    disabled
                                    style={{ height: '48px', opacity: 0.7 }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                                    Role
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={user?.role || ''}
                                    disabled
                                    style={{ height: '48px', opacity: 0.7, textTransform: 'capitalize' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--color-panel)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--muted-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <SettingsIcon size={18} style={{ color: 'var(--muted)' }} />
                            </div>
                            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--color-text)' }}>
                                Application Info
                            </h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Version</span>
                                <code style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    1.0.0
                                    <button
                                        onClick={() => copyToClipboard('1.0.0', 'Version')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--blue)' }}
                                        aria-label="Copy version"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </code>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Platform</span>
                                <code style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                                    {window.electronAPI?.platform || 'Web'}
                                </code>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Build</span>
                                <code style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    2026-03-06
                                    <button
                                        onClick={() => copyToClipboard('2026-03-06', 'Build date')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--blue)' }}
                                        aria-label="Copy build date"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'balances' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                    <div style={{
                        background: 'var(--color-panel)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--blue-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <User size={18} style={{ color: 'var(--blue)' }} />
                            </div>
                            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--color-text)' }}>
                                Customer Opening Balances
                            </h2>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: '56px' }} />
                                ))}
                            </div>
                        ) : customers.length === 0 ? (
                            <div style={{
                                padding: 'var(--space-4)',
                                textAlign: 'center',
                                color: 'var(--muted)',
                                background: 'var(--color-bg)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                No customers found
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {customers.map(customer => (
                                    <div
                                        key={customer.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--space-2) var(--space-3)',
                                            background: 'var(--color-bg)',
                                            borderRadius: 'var(--radius-md)',
                                            gap: 'var(--space-3)'
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '500', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {customer.name}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                                                Credit Limit: Rs. {customer.credit_limit?.toLocaleString() || '0'}
                                            </div>
                                        </div>

                                        {editingBalance?.type === 'customer' && editingBalance?.id === customer.id ? (
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={balanceValue}
                                                    onChange={(e) => setBalanceValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '120px', height: '40px' }}
                                                    autoFocus
                                                    aria-label="Opening balance amount"
                                                />
                                                <button
                                                    onClick={handleSaveBalance}
                                                    className="btn btn-success"
                                                    style={{ minWidth: '44px', minHeight: '44px', padding: '0 12px' }}
                                                    aria-label="Save balance"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingBalance(null)}
                                                    className="btn btn-ghost"
                                                    style={{ minWidth: '44px', minHeight: '44px', padding: '0 12px' }}
                                                    aria-label="Cancel editing"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ fontWeight: '600', color: 'var(--color-text)', fontFamily: 'monospace' }}>
                                                    Rs. {(customer.opening_balance || 0).toLocaleString()}
                                                </span>
                                                <button
                                                    onClick={() => handleEditBalance('customer', customer.id, customer.opening_balance)}
                                                    style={{
                                                        background: 'var(--color-panel)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--muted)',
                                                        minWidth: '44px',
                                                        minHeight: '44px',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    aria-label={`Edit balance for ${customer.name}`}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{
                        background: 'var(--color-panel)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--orange-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Building2 size={18} style={{ color: 'var(--orange)' }} />
                            </div>
                            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--color-text)' }}>
                                Supplier Opening Balances
                            </h2>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: '56px' }} />
                                ))}
                            </div>
                        ) : suppliers.length === 0 ? (
                            <div style={{
                                padding: 'var(--space-4)',
                                textAlign: 'center',
                                color: 'var(--muted)',
                                background: 'var(--color-bg)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                No suppliers found
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {suppliers.map(supplier => (
                                    <div
                                        key={supplier.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--space-2) var(--space-3)',
                                            background: 'var(--color-bg)',
                                            borderRadius: 'var(--radius-md)',
                                            gap: 'var(--space-3)'
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '500', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {supplier.name}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                                                Contact: {supplier.contact_person || 'N/A'}
                                            </div>
                                        </div>

                                        {editingBalance?.type === 'supplier' && editingBalance?.id === supplier.id ? (
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={balanceValue}
                                                    onChange={(e) => setBalanceValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '120px', height: '40px' }}
                                                    autoFocus
                                                    aria-label="Opening balance amount"
                                                />
                                                <button
                                                    onClick={handleSaveBalance}
                                                    className="btn btn-success"
                                                    style={{ minWidth: '44px', minHeight: '44px', padding: '0 12px' }}
                                                    aria-label="Save balance"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingBalance(null)}
                                                    className="btn btn-ghost"
                                                    style={{ minWidth: '44px', minHeight: '44px', padding: '0 12px' }}
                                                    aria-label="Cancel editing"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ fontWeight: '600', color: 'var(--color-text)', fontFamily: 'monospace' }}>
                                                    Rs. {(supplier.opening_balance || 0).toLocaleString()}
                                                </span>
                                                <button
                                                    onClick={() => handleEditBalance('supplier', supplier.id, supplier.opening_balance)}
                                                    style={{
                                                        background: 'var(--color-panel)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--muted)',
                                                        minWidth: '44px',
                                                        minHeight: '44px',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    aria-label={`Edit balance for ${supplier.name}`}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{
                        gridColumn: '1 / -1',
                        background: 'var(--blue-dim)',
                        border: '1px solid var(--blue)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)'
                    }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--blue)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <AlertTriangle size={18} />
                            About Opening Balances
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                            <li>Set the starting balance for each customer (amount they owe)</li>
                            <li>Set the starting balance for each supplier (amount you owe)</li>
                            <li>Used for credit limit calculations and aged receivables/payables reports</li>
                            <li>Changes to opening balances may affect your financial reports</li>
                        </ul>
                    </div>
                </div>
            )}

            {activeTab === 'backup' && (
                <div style={{
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--blue-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Database size={18} style={{ color: 'var(--blue)' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--color-text)' }}>
                                    Backup & Restore
                                </h2>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: 0 }}>
                                    Create and manage database backups
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCreateBackup}
                            disabled={backupLoading}
                            className="btn btn-primary"
                            style={{ minHeight: '44px' }}
                        >
                            {backupLoading ? (
                                <><RefreshCw size={16} className="animate-spin" /> Creating...</>
                            ) : (
                                <><Plus size={16} /> Create Backup</>
                            )}
                        </button>
                    </div>

                    <div style={{
                        padding: 'var(--space-3)',
                        background: 'var(--orange-dim)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-4)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-2)'
                    }}>
                        <AlertTriangle size={18} style={{ color: 'var(--orange)', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', margin: 0 }}>
                            This assumes <code style={{ fontFamily: 'monospace', background: 'var(--color-panel)', padding: '2px 6px', borderRadius: '4px' }}>pg_dump</code> is available on the server.
                        </p>
                    </div>

                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
                        Recent Backups
                    </h3>

                    {backupLoading && backups.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="skeleton" style={{ height: '64px' }} />
                            ))}
                        </div>
                    ) : backups.length === 0 ? (
                        <div style={{
                            padding: 'var(--space-5)',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            background: 'var(--color-bg)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px dashed var(--border)'
                        }}>
                            <Database size={32} style={{ margin: '0 auto var(--space-2)', opacity: 0.5 }} />
                            <p style={{ margin: 0 }}>No backups found. Create your first backup above.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {backups.map(backup => (
                                <div
                                    key={backup.filename}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-3)',
                                        background: 'var(--color-bg)',
                                        borderRadius: 'var(--radius-md)',
                                        gap: 'var(--space-3)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--muted-dim)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Database size={18} style={{ color: 'var(--muted)' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: '500', color: 'var(--color-text)', fontFamily: 'monospace', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {backup.filename}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                                                {(backup.size / 1024 / 1024).toFixed(2)} MB • {new Date(backup.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button
                                            onClick={() => handleDownloadBackup(backup.filename)}
                                            className="btn btn-ghost"
                                            style={{ minHeight: '44px', minWidth: '44px' }}
                                            aria-label={`Download ${backup.filename}`}
                                        >
                                            <Download size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBackup(backup.filename)}
                                            style={{
                                                background: 'none',
                                                border: '1px solid var(--red)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '10px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--red)',
                                                minWidth: '44px',
                                                minHeight: '44px'
                                            }}
                                            aria-label={`Delete ${backup.filename}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {user?.role === 'admin' && (
                <div style={{
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--green-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <SettingsIcon size={18} style={{ color: 'var(--green)' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--color-text)', margin: 0 }}>
                                    Re-run Setup Wizard
                                </h3>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: '4px 0 0' }}>
                                    Update company info, categories, brands, and units
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm('This will open the setup wizard. Continue?')) {
                                    updateOnboardingStep(1)
                                    navigate('/setup?step=1')
                                }
                            }}
                            className="btn btn-primary"
                            style={{ minHeight: '44px' }}
                        >
                            Start Wizard
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Settings
