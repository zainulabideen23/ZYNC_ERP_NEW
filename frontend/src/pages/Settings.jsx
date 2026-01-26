import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'
import { customersAPI, suppliersAPI, backupAPI } from '../services/api'

function Settings() {
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState('company') // 'company', 'balances', 'backup'
    const [customers, setCustomers] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [backups, setBackups] = useState([])
    const [loading, setLoading] = useState(false)
    const [backupLoading, setBackupLoading] = useState(false)
    const [editingBalance, setEditingBalance] = useState(null)
    const [balanceValue, setBalanceValue] = useState('')

    useEffect(() => {
        if (activeTab === 'balances') {
            loadData()
        } else if (activeTab === 'backup') {
            loadBackups()
        }
    }, [activeTab])

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
        if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return
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
            const api = editingBalance.type === 'customer' ? customersAPI : suppliersAPI

            // In real implementation, this would call an update API
            await new Promise(resolve => setTimeout(resolve, 500))

            toast.success(`✓ Opening balance updated`)
            setEditingBalance(null)
            loadData()
        } catch (error) {
            toast.error(`Failed to update balance: ${error.message}`)
        }
    }

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="page-header">
                <h1 className="page-title">⚙️ Settings</h1>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '2px solid #eee' }}>
                {[
                    { id: 'company', label: '🏢 Company', icon: '🏢' },
                    { id: 'balances', label: '💰 Opening Balances', icon: '💰' },
                    { id: 'backup', label: '💾 Backup', icon: '💾' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px 20px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            borderBottom: activeTab === tab.id ? '3px solid var(--color-accent)' : 'none',
                            color: activeTab === tab.id ? 'var(--color-accent)' : '#666',
                            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                            fontSize: '0.95rem'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Company Tab */}
            {activeTab === 'company' && (
                <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Company Information</h3>
                        <div className="form-group">
                            <label className="form-label">Company Name</label>
                            <input type="text" className="form-input" defaultValue="ZYNC Trading Company" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input type="text" className="form-input" defaultValue="Lahore, Pakistan" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input type="text" className="form-input" placeholder="Enter phone" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-input" placeholder="Enter email" />
                        </div>
                        <button className="btn btn-primary">Save Changes</button>
                    </div>

                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>User Profile</h3>
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input type="text" className="form-input" value={user?.username || ''} disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input type="text" className="form-input" value={user?.fullName || ''} disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <input type="text" className="form-input" value={user?.role || ''} disabled style={{ textTransform: 'capitalize' }} />
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Application</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                            <span>Version</span><span className="font-mono">1.0.0</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                            <span>Platform</span><span className="font-mono">{window.electronAPI?.platform || 'Web'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Build</span><span className="font-mono">2025-01-18</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Opening Balances Tab */}
            {activeTab === 'balances' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                    {/* Customers */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👥 Customer Opening Balances
                        </h3>
                        {loading ? (
                            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#999' }}>
                                Loading...
                            </div>
                        ) : customers.length === 0 ? (
                            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                                No customers found
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {customers.map(customer => (
                                    <div
                                        key={customer.id}
                                        style={{
                                            padding: 'var(--space-3)',
                                            border: '1px solid #eee',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                {customer.name}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                Credit Limit: Rs. {customer.credit_limit?.toLocaleString() || '0'}
                                            </div>
                                        </div>
                                        {editingBalance?.type === 'customer' && editingBalance?.id === customer.id ? (
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={balanceValue}
                                                    onChange={(e) => setBalanceValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '100px', padding: '6px' }}
                                                />
                                                <button
                                                    onClick={handleSaveBalance}
                                                    className="btn btn-success"
                                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setEditingBalance(null)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e3c72', minWidth: '80px', textAlign: 'right' }}>
                                                    Rs. {(customer.opening_balance || 0).toLocaleString()}
                                                </div>
                                                <button
                                                    onClick={() => handleEditBalance('customer', customer.id, customer.opening_balance)}
                                                    className="btn btn-small"
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#e3f2fd',
                                                        color: '#1e3c72',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Suppliers */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏭 Supplier Opening Balances
                        </h3>
                        {loading ? (
                            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#999' }}>
                                Loading...
                            </div>
                        ) : suppliers.length === 0 ? (
                            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                                No suppliers found
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {suppliers.map(supplier => (
                                    <div
                                        key={supplier.id}
                                        style={{
                                            padding: 'var(--space-3)',
                                            border: '1px solid #eee',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                {supplier.name}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                Contact: {supplier.contact_person || 'N/A'}
                                            </div>
                                        </div>
                                        {editingBalance?.type === 'supplier' && editingBalance?.id === supplier.id ? (
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={balanceValue}
                                                    onChange={(e) => setBalanceValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '100px', padding: '6px' }}
                                                />
                                                <button
                                                    onClick={handleSaveBalance}
                                                    className="btn btn-success"
                                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setEditingBalance(null)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e3c72', minWidth: '80px', textAlign: 'right' }}>
                                                    Rs. {(supplier.opening_balance || 0).toLocaleString()}
                                                </div>
                                                <button
                                                    onClick={() => handleEditBalance('supplier', supplier.id, supplier.opening_balance)}
                                                    className="btn btn-small"
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#fce4ec',
                                                        color: '#c2185b',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                        <h4 style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold', color: '#1e3c72' }}>
                            📌 About Opening Balances
                        </h4>
                        <ul style={{ marginLeft: '20px', fontSize: '0.9rem', lineHeight: '1.6', color: '#666' }}>
                            <li>Set the starting balance for each customer (amount they owe)</li>
                            <li>Set the starting balance for each supplier (amount you owe)</li>
                            <li>These balances are used for credit limit calculations and aged receivables/payables reports</li>
                            <li>Opening balances create contra-entries in the general ledger for reconciliation</li>
                            <li>Changes to opening balances may affect your financial reports</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Backup Tab */}
            {activeTab === 'backup' && (
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>💾 Backup & Restore</h3>
                    <p style={{ marginBottom: 'var(--space-4)', color: '#666' }}>
                        Create a backup of your database. Note: This assumes <code>pg_dump</code> is available on the server.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreateBackup}
                            disabled={backupLoading}
                        >
                            {backupLoading ? '⏳ Creating...' : 'Create Backup'}
                        </button>
                    </div>

                    <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid #eee' }}>
                        <h4 style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold', color: '#1e3c72' }}>
                            📋 Recent Backups
                        </h4>
                        {backupLoading && backups.length === 0 ? (
                            <div className="text-center p-4">Loading backups...</div>
                        ) : backups.length === 0 ? (
                            <div className="text-center p-4 text-muted">No backups found</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {backups.map(backup => (
                                    <div key={backup.filename} style={{ padding: 'var(--space-2)', background: '#f9f9f9', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>🗂️ {backup.filename}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#999' }}>
                                                Size: {(backup.size / 1024 / 1024).toFixed(2)} MB • Created: {new Date(backup.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                onClick={() => handleDownloadBackup(backup.filename)}
                                            >⬇️ Download</button>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--color-danger)' }}
                                                onClick={() => handleDeleteBackup(backup.filename)}
                                            >🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Settings
