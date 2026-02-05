import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { accountsAPI } from '../services/api'

function Accounts() {
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState([])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [accRes, groupRes] = await Promise.all([
                accountsAPI.list(),
                accountsAPI.getGroups()
            ])
            setAccounts(accRes.data)
            setGroups(groupRes.data)
        } catch (error) {
            toast.error('Failed to load chart of accounts')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="page-container">Loading...</div>

    // Group accounts by their group name
    const accountsByGroup = groups.reduce((acc, group) => {
        acc[group.name] = accounts.filter(a => a.group_id === group.id)
        return acc
    }, {})

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Chart of Accounts</h1>
            </div>

            <div className="grid grid-1" style={{ gap: 'var(--space-6)' }}>
                {groups.map(group => {
                    const groupAccounts = accountsByGroup[group.name] || []
                    if (groupAccounts.length === 0) return null

                    return (
                        <div key={group.id} className="card" style={{ padding: '0' }}>
                            <div style={{
                                padding: 'var(--space-3) var(--space-4)',
                                background: 'rgba(255,255,255,0.05)',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1rem' }}>{group.name}</h3>
                                <span className="badge badge-secondary">{(group.account_type || group.type || 'N/A').toUpperCase()}</span>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '120px' }}>Code</th>
                                            <th>Account Name</th>
                                            <th style={{ textAlign: 'right' }}>Opening Balance</th>
                                            <th style={{ textAlign: 'right' }}>Current Balance</th>
                                            <th style={{ textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupAccounts.map(account => (
                                            <tr key={account.id}>
                                                <td className="font-mono">{account.code}</td>
                                                <td>{account.name}</td>
                                                <td style={{ textAlign: 'right' }}>Rs. {Number(account.opening_balance).toLocaleString()}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Rs. {Number(account.current_balance).toLocaleString()}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <Link to={`/accounts/${account.id}/ledger`} className="btn btn-ghost btn-sm">View Ledger</Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                })}
            </div>

            <style>{`
                .badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: bold;
                }
                .badge-secondary {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-secondary);
                    border: 1px solid var(--color-border);
                }
                .btn-sm {
                    padding: 4px 8px;
                    font-size: 0.75rem;
                }
            `}</style>
        </div>
    )
}

export default Accounts
