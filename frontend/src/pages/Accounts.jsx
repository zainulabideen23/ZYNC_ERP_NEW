import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { accountsAPI } from '../services/api'
import { Wallet, ChevronDown, ChevronRight, BookOpen, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react'
import PageLoader from '../components/PageLoader'

function Accounts() {
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState([])
    const [expandedGroups, setExpandedGroups] = useState({})

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            const [accRes, groupRes] = await Promise.all([
                accountsAPI.list(),
                accountsAPI.getGroups()
            ])
            let flatAccounts = []
            if (Array.isArray(accRes.data)) {
                accRes.data.forEach(group => {
                    if (Array.isArray(group.accounts)) {
                        flatAccounts = flatAccounts.concat(group.accounts)
                    }
                })
            }
            setAccounts(flatAccounts)
            setGroups(groupRes.data)
            const initialExpanded = {}
            groupRes.data.forEach(g => { initialExpanded[g.id] = true })
            setExpandedGroups(initialExpanded)
        } catch (error) {
            toast.error('Failed to load chart of accounts')
        } finally {
            setLoading(false)
        }
    }

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    }

    const accountsByGroup = groups.reduce((acc, group) => {
        acc[group.id] = accounts.filter(a => a.group_id === group.id)
        return acc
    }, {})

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const groupColors = {
        'Asset': { bg: 'rgba(5, 153, 105, 0.1)', color: '#059669', icon: ArrowDownRight },
        'Liability': { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: ArrowUpRight },
        'Equity': { bg: 'rgba(8, 145, 178, 0.1)', color: '#0891B2', icon: Wallet },
        'Income': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: TrendingUp },
        'Expense': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: TrendingDown }
    }

    const getGroupStyle = (type) => {
        return groupColors[type] || { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', icon: BookOpen }
    }

    const TypeBadge = ({ type }) => {
        const style = getGroupStyle(type)
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '4px',
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
                backgroundColor: style.bg, color: style.color, textTransform: 'uppercase'
            }}>
                {type}
            </span>
        )
    }

    if (loading) return <PageLoader />

    const totalGroups = groups.length
    const totalAccounts = accounts.length

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(8, 145, 178, 0.12)', border: '1px solid rgba(8, 145, 178, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={20} color="#0891B2" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Chart of Accounts</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>{totalGroups} account groups, {totalAccounts} accounts</p>
                    </div>
                </div>
            </div>

            {/* Account Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groups.map(group => {
                    const groupAccounts = accountsByGroup[group.id] || []
                    if (groupAccounts.length === 0) return null
                    const style = getGroupStyle(group.account_type || group.type)
                    const isExpanded = expandedGroups[group.id] !== false
                    const GroupIcon = style.icon
                    const groupTotal = groupAccounts.reduce((sum, a) => sum + Number(a.computed_balance ?? a.current_balance ?? 0), 0)

                    return (
                        <div key={group.id} style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                            {/* Group Header */}
                            <div
                                onClick={() => toggleGroup(group.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 16px',
                                    background: style.bg,
                                    cursor: 'pointer',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = style.bg.replace('0.1', '0.15')}
                                onMouseLeave={e => e.currentTarget.style.background = style.bg}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <GroupIcon size={16} color={style.color} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{group.name}</span>
                                            <TypeBadge type={group.account_type || group.type} />
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{groupAccounts.length} account{groupAccounts.length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-hint)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Balance</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(groupTotal)}</div>
                                    </div>
                                    {isExpanded ? <ChevronDown size={18} color={style.color} /> : <ChevronRight size={18} color={style.color} />}
                                </div>
                            </div>

                            {/* Account Table */}
                            {isExpanded && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Name</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opening</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current</th>
                                            <th style={{ width: '100px', padding: '10px 16px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupAccounts.map((account, index) => (
                                            <tr key={account.id} style={{ borderBottom: index < groupAccounts.length - 1 ? '1px solid var(--border-light)' : 'none', background: 'var(--color-panel)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: style.color, background: style.bg, padding: '3px 8px', borderRadius: '4px' }}>
                                                        {account.code}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{account.name}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                                                    {formatCurrency(account.opening_balance)}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: Number(account.computed_balance ?? account.current_balance) !== 0 ? 600 : 400, color: Number(account.computed_balance ?? account.current_balance) !== 0 ? 'var(--color-text)' : 'var(--color-text-dim)' }}>
                                                    {formatCurrency(account.computed_balance ?? account.current_balance)}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <Link to={`/accounts/${account.id}/ledger`} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue)'; e.currentTarget.style.color = '#fff' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--blue)' }} aria-label={`View ledger for ${account.name}`}>
                                                        <BookOpen size={14} /> Ledger
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Accounts
