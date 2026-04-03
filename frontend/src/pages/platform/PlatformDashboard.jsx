import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { platformDashboardAPI } from '../../services/platform.api'
import { Building2, Users, AlertTriangle, DollarSign, TrendingUp, Clock } from 'lucide-react'

export default function PlatformDashboard() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            const res = await platformDashboardAPI.getOverview()
            setData(res.data)
        } catch (err) {
            console.error('Dashboard load error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>Loading dashboard...</div>
            </div>
        )
    }

    if (!data) {
        return (
            <div style={{ color: 'var(--color-danger)', textAlign: 'center', paddingTop: 60 }}>
                Failed to load dashboard data.
            </div>
        )
    }

    const statCards = [
        {
            label: 'Total Clients',
            value: data.totalTenants,
            icon: Building2,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.1)',
            border: 'rgba(99,102,241,0.2)',
        },
        {
            label: 'Active Clients',
            value: data.activeTenants,
            icon: TrendingUp,
            color: '#22c55e',
            bg: 'rgba(34,197,94,0.1)',
            border: 'rgba(34,197,94,0.2)',
        },
        {
            label: 'Expiring Soon',
            value: data.tenantsExpiringSoon?.length || 0,
            icon: AlertTriangle,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
            border: 'rgba(245,158,11,0.2)',
        },
        {
            label: 'Total Users',
            value: data.totalUsersAcrossAllTenants,
            icon: Users,
            color: '#06b6d4',
            bg: 'rgba(6,182,212,0.1)',
            border: 'rgba(6,182,212,0.2)',
        },
    ]

    const formatDate = (d) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const daysUntil = (d) => {
        if (!d) return null
        const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24))
        return diff
    }

    return (
        <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 24 }}>
                Dashboard
            </h1>

            {/* Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 32,
            }}>
                {statCards.map(card => (
                    <div key={card.label} style={{
                        padding: 20,
                        borderRadius: 12,
                        background: card.bg,
                        border: `1px solid ${card.border}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: 'var(--color-muted)', fontWeight: 500 }}>{card.label}</span>
                            <card.icon size={18} color={card.color} />
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Two Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Recent Clients */}
                <div style={{
                    padding: 20,
                    borderRadius: 12,
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border-surface)',
                }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16, margin: 0, marginBottom: 16 }}>
                        Recent Clients
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-surface)' }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Plan</th>
                                <th style={thStyle}>Created</th>
                                <th style={thStyle}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.recentActivity || []).slice(0, 5).map(t => (
                                <tr
                                    key={t.id}
                                    style={{ borderBottom: '1px solid var(--border-surface)', cursor: 'pointer' }}
                                    onClick={() => navigate(`/platform/clients/${t.id}`)}
                                >
                                    <td style={tdStyle}>{t.name}</td>
                                    <td style={tdStyle}>
                                        <PlanBadge plan={t.plan} />
                                    </td>
                                    <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{formatDate(t.created_at)}</td>
                                    <td style={tdStyle}>
                                        <StatusBadge active={t.is_active} />
                                    </td>
                                </tr>
                            ))}
                            {(!data.recentActivity || data.recentActivity.length === 0) && (
                                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-muted)' }}>No tenants yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Expiring Soon */}
                <div style={{
                    padding: 20,
                    borderRadius: 12,
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border-surface)',
                }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fbbf24', marginBottom: 16, margin: 0, marginBottom: 16 }}>
                        <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Expiring Soon
                    </h3>
                    {data.tenantsExpiringSoon && data.tenantsExpiringSoon.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.tenantsExpiringSoon.map(t => {
                                const days = daysUntil(t.expires_at)
                                return (
                                    <div
                                        key={t.id}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: 8,
                                            background: days < 7 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
                                            border: `1px solid ${days < 7 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => navigate(`/platform/clients/${t.id}`)}
                                    >
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                                Expires: {formatDate(t.expires_at)}
                                            </div>
                                        </div>
                                        <div style={{
                                            fontSize: 13, fontWeight: 600,
                                            color: days < 7 ? '#ef4444' : '#f59e0b',
                                        }}>
                                            {days}d left
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                            No tenants expiring in the next 30 days
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ active }) {
    return (
        <span style={{
            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: active ? '#4ade80' : '#f87171',
            border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
            {active ? 'Active' : 'Inactive'}
        </span>
    )
}

function PlanBadge({ plan }) {
    const colors = {
        basic: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
        professional: { bg: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
        enterprise: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    }
    const c = colors[plan] || colors.basic
    return (
        <span style={{
            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: c.bg, color: c.color, border: `1px solid ${c.border}`,
            textTransform: 'capitalize',
        }}>
            {plan}
        </span>
    )
}

const thStyle = {
    textAlign: 'left', padding: '8px 10px', fontSize: 11,
    fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase',
    letterSpacing: 0.5,
}

const tdStyle = {
    padding: '10px', fontSize: 13, color: 'var(--color-text)',
}
