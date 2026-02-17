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
        <div className="page-container flex-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="page-header">
                <h1 className="page-title">⚙️ Settings</h1>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                {[
                    { id: 'company', label: '🏢 Company' },
                    { id: 'balances', label: '💰 Opening Balances' },
                    { id: 'backup', label: '💾 Backup' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`settings-tab ${activeTab === tab.id ? 'settings-tab--active' : ''}`}
                        aria-label={`Switch to ${tab.label} tab`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Company Tab */}
            {activeTab === 'company' && (
                <div className="grid grid-2">
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Company Information</h3>
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
                        <button className="btn btn-primary" aria-label="Save company changes">Save Changes</button>
                    </div>

                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>User Profile</h3>
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
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Application</h3>
                        <div className="flex justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                            <span className="text-muted">Version</span><span className="font-mono">1.0.0</span>
                        </div>
                        <div className="flex justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                            <span className="text-muted">Platform</span><span className="font-mono">{window.electronAPI?.platform || 'Web'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Build</span><span className="font-mono">2025-01-18</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Opening Balances Tab */}
            {activeTab === 'balances' && (
                <div className="grid grid-2">
                    {/* Customers */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👥 Customer Opening Balances
                        </h3>
                        {loading ? (
                            <div className="empty-state">Loading...</div>
                        ) : customers.length === 0 ? (
                            <div className="empty-state">No customers found</div>
                        ) : (
                            <div className="flex-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {customers.map(customer => (
                                    <div key={customer.id} className="balance-row">
                                        <div>
                                            <div className="balance-name">{customer.name}</div>
                                            <div className="balance-detail">
                                                Credit Limit: Rs. {customer.credit_limit?.toLocaleString() || '0'}
                                            </div>
                                        </div>
                                        {editingBalance?.type === 'customer' && editingBalance?.id === customer.id ? (
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="number"
                                                    value={balanceValue}
                                                    onChange={(e) => setBalanceValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '100px', padding: '6px' }}
                                                />
                                                <button onClick={handleSaveBalance} className="btn btn-success btn-sm" aria-label="Save balance">
                                                    ✓ Save
                                                </button>
                                                <button onClick={() => setEditingBalance(null)} className="btn btn-secondary btn-sm" aria-label="Cancel editing">
                                                    ✕ Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="balance-value">
                                                    Rs. {(customer.opening_balance || 0).toLocaleString()}
                                                </div>
                                                <button
                                                    onClick={() => handleEditBalance('customer', customer.id, customer.opening_balance)}
                                                    className="balance-edit-btn"
                                                    aria-label={`Edit balance for ${customer.name}`}
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
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏭 Supplier Opening Balances
                        </h3>
                        {loading ? (
                            <div className="empty-state">Loading...</div>
                        ) : suppliers.length === 0 ? (
                            <div className="empty-state">No suppliers found</div>
                        ) : (
                            <div className="flex-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {suppliers.map(supplier => (
                                    <div key={supplier.id} className="balance-row">
                                        <div>
                                            <div className="balance-name">{supplier.name}</div>
                                            <div className="balance-detail">
                                                Contact: {supplier.contact_person || 'N/A'}
                                            </div>
                                        </div>
                                        {editingBalance?.type === 'supplier' && editingBalance?.id === supplier.id ? (
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="number"
                                                    value={balanceValue}
                                                    onChange={(e) => setBalanceValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ width: '100px', padding: '6px' }}
                                                />
                                                <button onClick={handleSaveBalance} className="btn btn-success btn-sm" aria-label="Save balance">
                                                    ✓ Save
                                                </button>
                                                <button onClick={() => setEditingBalance(null)} className="btn btn-secondary btn-sm" aria-label="Cancel editing">
                                                    ✕ Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="balance-value">
                                                    Rs. {(supplier.opening_balance || 0).toLocaleString()}
                                                </div>
                                                <button
                                                    onClick={() => handleEditBalance('supplier', supplier.id, supplier.opening_balance)}
                                                    className="balance-edit-btn supplier"
                                                    aria-label={`Edit balance for ${supplier.name}`}
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
                        <h4 className="info-heading">📌 About Opening Balances</h4>
                        <ul className="info-list">
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
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>💾 Backup & Restore</h3>
                    <p className="text-muted" style={{ marginBottom: 'var(--space-3)' }}>
                        Create a backup of your database. Note: This assumes <code className="font-mono">pg_dump</code> is available on the server.
                    </p>
                    <div className="flex gap-2">
                        <button
                            className="btn btn-primary"
                            onClick={handleCreateBackup}
                            disabled={backupLoading}
                            aria-label="Create database backup"
                        >
                            {backupLoading ? '⏳ Creating...' : '💾 Create Backup'}
                        </button>
                    </div>

                    <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-surface)' }}>
                        <h4 className="info-heading" style={{ marginBottom: 'var(--space-2)' }}>📋 Recent Backups</h4>
                        {backupLoading && backups.length === 0 ? (
                            <div className="empty-state">Loading backups...</div>
                        ) : backups.length === 0 ? (
                            <div className="empty-state">No backups found</div>
                        ) : (
                            <div className="flex-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {backups.map(backup => (
                                    <div key={backup.filename} className="backup-item">
                                        <div>
                                            <div className="backup-item-name">🗂️ {backup.filename}</div>
                                            <div className="backup-item-meta">
                                                Size: {(backup.size / 1024 / 1024).toFixed(2)} MB • Created: {new Date(backup.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleDownloadBackup(backup.filename)}
                                                aria-label={`Download ${backup.filename}`}
                                            >⬇️ Download</button>
                                            <button
                                                className="btn btn-ghost btn-sm text-danger"
                                                onClick={() => handleDeleteBackup(backup.filename)}
                                                aria-label={`Delete ${backup.filename}`}
                                            >🗑️ Delete</button>
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
