import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { auditLogsAPI } from '../services/api'
import { useAuthStore } from '../store/auth.store'
import { formatActivity, timeAgo, formatIP } from '../utils/activityFormatter'
import {
    Shield, Search, ChevronLeft, ChevronRight, ChevronDown,
    X, Activity, Copy, Check
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ═══════════════════════════════════════════════════════════
   ACTION BADGE CONFIG — color-coded per action type
   Login=blue, Create=green, Update=amber, Delete=red
   ═══════════════════════════════════════════════════════════ */
const ACTION_BADGES = {
    create:          { label: 'Create',       bgAlpha: 'rgba(34,197,94,0.15)',  text: '#4ade80', border: 'rgba(34,197,94,0.35)' },
    update:          { label: 'Update',       bgAlpha: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
    delete:          { label: 'Delete',       bgAlpha: 'rgba(239,68,68,0.15)',  text: '#f87171', border: 'rgba(239,68,68,0.35)' },
    approve:         { label: 'Approve',      bgAlpha: 'rgba(34,197,94,0.15)',  text: '#4ade80', border: 'rgba(34,197,94,0.35)' },
    reject:          { label: 'Reject',       bgAlpha: 'rgba(239,68,68,0.15)',  text: '#f87171', border: 'rgba(239,68,68,0.35)' },
    login:           { label: 'Login',        bgAlpha: 'rgba(5, 153, 105, 0.15)', text: '#34d399', border: 'rgba(5, 153, 105, 0.35)' },
    login_failed:    { label: 'Failed Login', bgAlpha: 'rgba(239,68,68,0.15)',  text: '#f87171', border: 'rgba(239,68,68,0.35)' },
    password_change: { label: 'Password',     bgAlpha: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.35)' },
    export:          { label: 'Export',       bgAlpha: 'rgba(99,102,241,0.15)', text: '#c084fc', border: 'rgba(99,102,241,0.35)' },
    impersonate:     { label: 'Impersonate',  bgAlpha: 'rgba(249,115,22,0.15)', text: '#fb923c', border: 'rgba(249,115,22,0.35)' },
    read:            { label: 'Read',         bgAlpha: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.35)' },
}

/* ═══════════════════════════════════════════════════════════
   CUSTOM DROPDOWN — replaces native <select>
   Dark-themed, with chevron icon and keyboard-friendly focus
   ═══════════════════════════════════════════════════════════ */
function CustomSelect({ label, value, onChange, options, placeholder = 'All' }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const selectedLabel = value
        ? (options.find(o => String(o.value) === String(value))?.label || value)
        : placeholder

    return (
        <div ref={ref} style={{ position: 'relative', minWidth: 140 }}>
            {label && <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: '#374151', border: '1px solid #4b5563', borderRadius: 8,
                    padding: '8px 12px', color: value ? '#e5e7eb' : '#9ca3af',
                    fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(5, 153, 105, 0.3)' }}
                onBlur={e => { if (!open) { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.boxShadow = 'none' } }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
                <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    marginTop: 4, background: '#1f2937', border: '1px solid #374151', borderRadius: 8,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)', maxHeight: 220, overflowY: 'auto', padding: 4,
                }}>
                    <div
                        onClick={() => { onChange(''); setOpen(false) }}
                        style={{
                            padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                            color: !value ? '#34d399' : '#d1d5db', background: !value ? 'rgba(5, 153, 105, 0.1)' : 'transparent',
                            transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent' }}
                    >{placeholder}</div>
                    {options.map(opt => {
                        const isSelected = String(value) === String(opt.value)
                        return (
                            <div
                                key={opt.value}
                                onClick={() => { onChange(String(opt.value)); setOpen(false) }}
                                style={{
                                    padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                                    color: isSelected ? '#34d399' : '#d1d5db',
                                    background: isSelected ? 'rgba(5, 153, 105, 0.1)' : 'transparent',
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                            >{opt.label}</div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
   COPYABLE RECORD ID — shows more chars, full ID on tooltip,
   copy icon appears on hover
   ═══════════════════════════════════════════════════════════ */
function CopyableId({ value }) {
    const [copied, setCopied] = useState(false)
    if (!value) return <span style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>—</span>
    const short = value.length > 12 ? value.substring(0, 12) + '…' : value
    const handleCopy = (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }
    return (
        <span className="group/id" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }} title={value}>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>{short}</span>
            <button
                onClick={handleCopy}
                className="opacity-0 group-hover/id:opacity-100 transition-opacity"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Copy full ID"
            >
                {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} style={{ color: '#9ca3af' }} />}
            </button>
        </span>
    )
}

/* ═══════════════════════════════════════════════════════════
   TIMESTAMP CELL — shows formatted date/time by default,
   relative time ("5 hours ago") on hover tooltip
   ═══════════════════════════════════════════════════════════ */
function TimeCell({ dateString }) {
    if (!dateString) return <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>—</span>
    const d = new Date(dateString)
    const formatted = d.toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true,
    })
    const relative = timeAgo(dateString)
    return (
        <span title={relative} style={{ color: '#d1d5db', fontSize: '0.75rem', cursor: 'default', whiteSpace: 'nowrap' }}>
            {formatted}
        </span>
    )
}

/* ─── Shared input style for dark date pickers ─── */
const dateInputStyle = {
    width: '100%', background: '#374151', border: '1px solid #4b5563', borderRadius: 8,
    padding: '8px 12px', fontSize: '0.8rem', color: '#e5e7eb',
    colorScheme: 'dark', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
function AuditLogs() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [logs, setLogs] = useState([])
    const [users, setUsers] = useState([])
    const [actionOptions, setActionOptions] = useState([])
    const [tableOptions, setTableOptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 })
    const [expandedRow, setExpandedRow] = useState(null)

    // Filters
    const [search, setSearch] = useState('')
    const [filterUser, setFilterUser] = useState('')
    const [filterAction, setFilterAction] = useState('')
    const [filterTable, setFilterTable] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    useEffect(() => { if (user?.role !== 'admin') navigate('/') }, [user, navigate])

    useEffect(() => {
        (async () => {
            try {
                const meta = await auditLogsAPI.meta()
                setUsers(meta.users || [])
                setActionOptions(meta.actions || [])
                setTableOptions(meta.tables || [])
            } catch (err) { console.error('Failed to load audit meta:', err) }
        })()
    }, [])

    useEffect(() => { loadLogs() }, [pagination.page, filterUser, filterAction, filterTable, dateFrom, dateTo])

    async function loadLogs() {
        try {
            setLoading(true)
            const params = { page: pagination.page, limit: pagination.limit }
            if (search) params.search = search
            if (filterUser) params.userId = filterUser
            if (filterAction) params.action = filterAction
            if (filterTable) params.tableName = filterTable
            if (dateFrom) params.dateFrom = dateFrom
            if (dateTo) params.dateTo = dateTo
            const response = await auditLogsAPI.list(params)
            setLogs(response.data || [])
            setPagination(prev => ({ ...prev, ...response.pagination }))
        } catch (error) {
            toast.error(error?.message || 'Failed to load audit logs')
        } finally { setLoading(false) }
    }

    const handleSearch = (e) => {
        if (e.key === 'Enter') { setPagination(p => ({ ...p, page: 1 })); loadLogs() }
    }
    const clearFilters = () => {
        setSearch(''); setFilterUser(''); setFilterAction(''); setFilterTable(''); setDateFrom(''); setDateTo('')
        setPagination(p => ({ ...p, page: 1 }))
    }
    const hasFilters = search || filterUser || filterAction || filterTable || dateFrom || dateTo

    // Active filter pills data
    const activeFilters = []
    if (search) activeFilters.push({ key: 'search', label: `"${search}"`, clear: () => { setSearch(''); setPagination(p => ({ ...p, page: 1 })); setTimeout(loadLogs, 0) } })
    if (filterUser) { const u = users.find(x => String(x.id) === String(filterUser)); activeFilters.push({ key: 'user', label: `User: ${u?.full_name || u?.username || filterUser}`, clear: () => { setFilterUser(''); setPagination(p => ({ ...p, page: 1 })) } }) }
    if (filterAction) activeFilters.push({ key: 'action', label: `Action: ${ACTION_BADGES[filterAction]?.label || filterAction}`, clear: () => { setFilterAction(''); setPagination(p => ({ ...p, page: 1 })) } })
    if (filterTable) activeFilters.push({ key: 'table', label: `Table: ${filterTable}`, clear: () => { setFilterTable(''); setPagination(p => ({ ...p, page: 1 })) } })
    if (dateFrom) activeFilters.push({ key: 'from', label: `From: ${dateFrom}`, clear: () => { setDateFrom(''); setPagination(p => ({ ...p, page: 1 })) } })
    if (dateTo) activeFilters.push({ key: 'to', label: `To: ${dateTo}`, clear: () => { setDateTo(''); setPagination(p => ({ ...p, page: 1 })) } })

    if (user?.role !== 'admin') return null

    // Build dropdown options
    const userOpts = users.map(u => ({ value: u.id, label: u.full_name || u.username }))
    const actionOpts = actionOptions.map(a => ({ value: a, label: ACTION_BADGES[a]?.label || a }))
    const tableOpts = tableOptions.map(t => ({ value: t, label: t }))

    const thStyle = {
        textAlign: 'left', padding: '10px 16px', fontSize: '0.68rem', fontWeight: 600,
        color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }

    return (
        <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>

            {/* ═══ PAGE HEADER ═══ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(5, 153, 105, 0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Shield size={20} style={{ color: '#34d399' }} />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>Audit Logs</h1>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Complete system activity history</p>
                </div>
            </div>

            {/* ═══ FILTER BAR CARD ═══ */}
            <div style={{
                background: '#1f2937', borderRadius: 12, border: '1px solid #374151',
                padding: '16px 20px', marginBottom: 12,
            }}>
                {/* Row 1: Dropdowns + Dates */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <CustomSelect label="User" value={filterUser} onChange={v => { setFilterUser(v); setPagination(p => ({ ...p, page: 1 })) }} options={userOpts} placeholder="All Users" />
                    <CustomSelect label="Action" value={filterAction} onChange={v => { setFilterAction(v); setPagination(p => ({ ...p, page: 1 })) }} options={actionOpts} placeholder="All Actions" />
                    <CustomSelect label="Table" value={filterTable} onChange={v => { setFilterTable(v); setPagination(p => ({ ...p, page: 1 })) }} options={tableOpts} placeholder="All Tables" />

                    <div style={{ minWidth: 150 }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>From</span>
                        <input
                            type="date" value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                            style={dateInputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(5, 153, 105, 0.3)' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.boxShadow = 'none' }}
                        />
                    </div>
                    <div style={{ minWidth: 150 }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>To</span>
                        <input
                            type="date" value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                            style={dateInputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(5, 153, 105, 0.3)' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.boxShadow = 'none' }}
                        />
                    </div>

                    {hasFilters && (
                        <button onClick={clearFilters} style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px',
                            fontSize: '0.78rem', color: '#9ca3af', background: 'none', border: 'none',
                            cursor: 'pointer', borderRadius: 8, transition: 'color 0.15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.color = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>

                {/* Row 2: Full-width search */}
                <div style={{ marginTop: 12, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Search descriptions, usernames…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={handleSearch}
                        style={{
                            width: '100%', background: '#374151', border: '1px solid #4b5563', borderRadius: 8,
                            padding: '8px 12px 8px 34px', fontSize: '0.8rem', color: '#e5e7eb',
                            outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(5, 153, 105, 0.3)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                </div>
            </div>

            {/* ═══ ACTIVE FILTER PILLS ═══ */}
            {activeFilters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {activeFilters.map(f => (
                        <span key={f.key} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 500,
                            background: 'rgba(5, 153, 105, 0.12)', color: '#34d399', border: '1px solid rgba(5, 153, 105, 0.25)',
                        }}>
                            {f.label}
                            <button onClick={f.clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex', lineHeight: 1 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.color = '#34d399'}
                            ><X size={12} /></button>
                        </span>
                    ))}
                    {activeFilters.length > 1 && (
                        <button onClick={clearFilters} style={{ fontSize: '0.72rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                        >Clear all</button>
                    )}
                </div>
            )}

            {/* ═══ DATA TABLE ═══ */}
            <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1f2937', overflow: 'hidden' }}>
                {loading ? (
                    /* Skeleton loader */
                    <div style={{ padding: '1.5rem' }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="animate-pulse" style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #1f2937' }}>
                                <div style={{ height: 14, background: '#1f2937', borderRadius: 4, width: 80 }} />
                                <div style={{ height: 14, background: '#1f2937', borderRadius: 4, width: 60 }} />
                                <div style={{ height: 14, background: '#1f2937', borderRadius: 4, width: 80 }} />
                                <div style={{ height: 14, background: '#1f2937', borderRadius: 4, flex: 1 }} />
                                <div style={{ height: 14, background: '#1f2937', borderRadius: 4, width: 100 }} />
                            </div>
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    /* Empty state */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
                        <Activity size={44} style={{ color: '#374151', marginBottom: 12 }} />
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No audit logs found matching your filters.</p>
                    </div>
                ) : (
                    /* Table with horizontal scroll wrapper */
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', minWidth: 950 }}>
                            <thead>
                                <tr style={{ background: '#1f2937', borderBottom: '1px solid #374151' }}>
                                    <th style={{ ...thStyle, width: '12%' }}>User</th>
                                    <th style={{ ...thStyle, width: '9%' }}>Action</th>
                                    <th style={{ ...thStyle, width: '9%' }}>Table</th>
                                    <th style={{ ...thStyle, width: '20%' }}>Description</th>
                                    <th style={{ ...thStyle, width: '16%' }}>Record ID</th>
                                    <th style={{ ...thStyle, width: '9%' }}>IP</th>
                                    <th style={{ ...thStyle, width: '18%' }}>When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const isExpanded = expandedRow === log.id
                                    const badge = ACTION_BADGES[log.action] || ACTION_BADGES.read
                                    const avatarBg = log.user?.role === 'admin' ? '#be123c' : log.user?.role === 'manager' ? '#059669' : '#475569'
                                    const desc = formatActivity(log)

                                    return (
                                        <React.Fragment key={log.id}>
                                            {/* ─── Data row ─── */}
                                            <tr
                                                onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                                style={{ cursor: 'pointer', borderBottom: '1px solid #1f2937', transition: 'background-color 150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(55,65,81,0.45)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                {/* User */}
                                                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 26, height: 26, borderRadius: '50%', display: 'flex',
                                                            alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                                                            background: avatarBg, flexShrink: 0,
                                                        }}>
                                                            {log.user?.username?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <span style={{ color: '#e5e7eb', fontWeight: 500, fontSize: '0.8rem' }}>
                                                            {log.user?.username || 'System'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Action badge */}
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{
                                                        display: 'inline-block', padding: '3px 10px', borderRadius: 9999,
                                                        fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap',
                                                        background: badge.bgAlpha, color: badge.text,
                                                        border: `1px solid ${badge.border}`,
                                                    }}>
                                                        {badge.label || log.action.replace('_', ' ')}
                                                    </span>
                                                </td>

                                                {/* Table */}
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{
                                                        color: '#9ca3af', fontSize: '0.73rem',
                                                        background: '#1f2937', padding: '2px 8px', borderRadius: 4,
                                                        border: '1px solid #374151',
                                                    }}>
                                                        {log.table_name}
                                                    </span>
                                                </td>

                                                {/* Description — narrower */}
                                                <td style={{ padding: '10px 16px', maxWidth: 200 }}>
                                                    <span style={{
                                                        color: '#d1d5db', whiteSpace: 'nowrap', overflow: 'hidden',
                                                        textOverflow: 'ellipsis', display: 'block', fontSize: '0.78rem',
                                                    }} title={desc.text}>
                                                        {desc.text}
                                                    </span>
                                                </td>

                                                {/* Record ID — wider, tooltip + copy */}
                                                <td style={{ padding: '10px 16px' }}>
                                                    <CopyableId value={log.record_id} />
                                                </td>

                                                {/* IP */}
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>
                                                        {formatIP(log.ip_address)}
                                                    </span>
                                                </td>

                                                {/* When */}
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <TimeCell dateString={log.created_at} />
                                                        <ChevronDown size={12} style={{
                                                            color: '#4b5563', flexShrink: 0,
                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                                            transition: 'transform 0.2s ease',
                                                        }} />
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ─── Accordion diff row ─── */}
                                            <tr>
                                                <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                                                    <div style={{
                                                        maxHeight: isExpanded ? 600 : 0,
                                                        overflow: 'hidden',
                                                        transition: 'max-height 0.35s ease, opacity 0.25s ease',
                                                        opacity: isExpanded ? 1 : 0,
                                                    }}>
                                                        <div style={{ padding: '12px 24px 16px', background: 'rgba(17,24,39,0.8)' }}>
                                                            <div style={{
                                                                background: '#0f172a', borderRadius: 10, padding: 16,
                                                                border: '1px solid #1e293b',
                                                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
                                                            }}>
                                                                {/* Before */}
                                                                <div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before</span>
                                                                    </div>
                                                                    {log.old_values ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                            {Object.entries(log.old_values).map(([k, v]) => (
                                                                                <div key={k} style={{ display: 'flex', gap: 8, fontSize: '0.73rem' }}>
                                                                                    <span style={{ color: '#6b7280', width: 120, flexShrink: 0 }}>{k}:</span>
                                                                                    <span style={{ color: '#f87171', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', background: 'rgba(239,68,68,0.06)', padding: '0 4px', borderRadius: 3 }}>{String(v)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p style={{ fontSize: '0.73rem', color: '#4b5563', fontStyle: 'italic', margin: 0 }}>New record — no previous values</p>
                                                                    )}
                                                                </div>
                                                                {/* After */}
                                                                <div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After</span>
                                                                    </div>
                                                                    {log.new_values ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                            {Object.entries(log.new_values).map(([k, v]) => (
                                                                                <div key={k} style={{ display: 'flex', gap: 8, fontSize: '0.73rem' }}>
                                                                                    <span style={{ color: '#6b7280', width: 120, flexShrink: 0 }}>{k}:</span>
                                                                                    <span style={{ color: '#4ade80', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', background: 'rgba(34,197,94,0.06)', padding: '0 4px', borderRadius: 3 }}>{String(v)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p style={{ fontSize: '0.73rem', color: '#4b5563', fontStyle: 'italic', margin: 0 }}>Record deleted</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══ PAGINATION ═══ */}
            {!loading && pagination.pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '0 4px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                            disabled={pagination.page <= 1}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '6px 14px', fontSize: '0.8rem', color: '#d1d5db',
                                background: '#1f2937', border: '1px solid #374151', borderRadius: 8,
                                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                                opacity: pagination.page <= 1 ? 0.4 : 1,
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (pagination.page > 1) e.currentTarget.style.background = '#374151' }}
                            onMouseLeave={e => e.currentTarget.style.background = '#1f2937'}
                        >
                            <ChevronLeft size={14} /> Previous
                        </button>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', padding: '0 8px' }}>
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
                            disabled={pagination.page >= pagination.pages}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '6px 14px', fontSize: '0.8rem', color: '#d1d5db',
                                background: '#1f2937', border: '1px solid #374151', borderRadius: 8,
                                cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer',
                                opacity: pagination.page >= pagination.pages ? 0.4 : 1,
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (pagination.page < pagination.pages) e.currentTarget.style.background = '#374151' }}
                            onMouseLeave={e => e.currentTarget.style.background = '#1f2937'}
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AuditLogs
