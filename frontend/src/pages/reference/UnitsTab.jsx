import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { unitsAPI } from '../../services/api'
import { Plus, Edit, Trash2, Check, X, ToggleLeft, ToggleRight, Search, Loader2 } from 'lucide-react'

function UnitsTab() {
    const [units, setUnits] = useState([])
    const [loading, setLoading] = useState(true)
    const [showInactive, setShowInactive] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', abbreviation: '', description: '' })
    const [saving, setSaving] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [search, setSearch] = useState('')
    const [seeding, setSeeding] = useState(false)

    useEffect(() => { loadUnits() }, [showInactive])

    const loadUnits = async () => {
        try {
            setLoading(true)
            const params = showInactive ? { all: true } : {}
            const res = await unitsAPI.list(params)
            setUnits(res.data || [])
        } catch (error) {
            toast.error('Failed to load units')
        } finally {
            setLoading(false)
        }
    }

    const filtered = search
        ? units.filter(u =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.abbreviation.toLowerCase().includes(search.toLowerCase())
        )
        : units

    const handleSeed = async () => {
        try {
            setSeeding(true)
            const res = await unitsAPI.seed()
            toast.success(res.message || 'Standard units added')
            loadUnits()
        } catch (err) {
            toast.error(err.message || 'Failed to seed units')
        } finally {
            setSeeding(false)
        }
    }

    const handleCreate = async () => {
        if (!form.name.trim() || !form.abbreviation.trim()) {
            toast.error('Name and abbreviation are required')
            return
        }
        try {
            setSaving(true)
            await unitsAPI.create({ name: form.name.trim(), abbreviation: form.abbreviation.trim(), description: form.description.trim() })
            toast.success('Unit created')
            setForm({ name: '', abbreviation: '', description: '' })
            setShowCreate(false)
            loadUnits()
        } catch (err) {
            toast.error(err.message || 'Failed to create unit')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (unit) => {
        setEditing(unit.id)
        setForm({ name: unit.name, abbreviation: unit.abbreviation, description: unit.description || '' })
    }

    const handleSaveEdit = async () => {
        if (!form.name.trim() || !form.abbreviation.trim()) {
            toast.error('Name and abbreviation are required')
            return
        }
        try {
            setSaving(true)
            await unitsAPI.update(editing, {
                name: form.name.trim(),
                abbreviation: form.abbreviation.trim(),
                description: form.description.trim()
            })
            toast.success('Unit updated')
            setEditing(null)
            setForm({ name: '', abbreviation: '', description: '' })
            loadUnits()
        } catch (err) {
            toast.error(err.message || 'Failed to update unit')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleActive = async (unit) => {
        try {
            await unitsAPI.update(unit.id, { is_active: !unit.is_active })
            toast.success(unit.is_active ? 'Unit deactivated' : 'Unit activated')
            loadUnits()
        } catch (err) {
            toast.error(err.message || 'Failed to update unit')
        }
    }

    const handleDelete = async (unit) => {
        setDeleteConfirm(unit)
    }

    const confirmDelete = async () => {
        if (!deleteConfirm) return
        try {
            await unitsAPI.delete(deleteConfirm.id)
            toast.success('Unit deleted')
            loadUnits()
        } catch (err) {
            toast.error(err.message || 'Cannot delete: unit is in use')
        } finally {
            setDeleteConfirm(null)
        }
    }

    const cancelEdit = () => {
        setEditing(null)
        setForm({ name: '', abbreviation: '', description: '' })
    }

    const StatusBadge = ({ isActive }) => (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '6px',
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em',
            backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isActive ? '#10b981' : '#ef4444'
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#10b981' : '#ef4444' }} />
            {isActive ? 'Active' : 'Inactive'}
        </span>
    )

    return (
        <>
            {/* Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: '36px', height: '20px' }}>
                            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: showInactive ? 'var(--blue)' : 'var(--color-panel-2)', border: '1px solid var(--border-surface)', transition: 'all 0.2s', position: 'relative' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '1px', left: showInactive ? '17px' : '1px', transition: 'all 0.2s' }} />
                            </div>
                        </div>
                        Show inactive
                    </label>
                    <button onClick={handleSeed} disabled={seeding} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-text)', fontSize: '12px', fontWeight: 500, cursor: seeding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: seeding ? 0.6 : 1 }}>
                        {seeding ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={13} />}
                        {seeding ? 'Seeding...' : 'Seed standards'}
                    </button>
                </div>
                <button onClick={() => { setShowCreate(true); setEditing(null); setForm({ name: '', abbreviation: '', description: '' }) }} style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={15} />
                    Add Unit
                </button>
            </div>

            {/* Create Form */}
            {showCreate && !editing && (
                <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Name *</label>
                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kilogram" style={{ height: '38px', width: '100%', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                        </div>
                        <div style={{ width: '100px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Abbr *</label>
                            <input value={form.abbreviation} onChange={e => setForm(p => ({ ...p, abbreviation: e.target.value }))} placeholder="e.g. kg" maxLength={10} style={{ height: '38px', width: '100%', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Description</label>
                            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" style={{ height: '38px', width: '100%', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                        </div>
                        <button onClick={handleCreate} disabled={saving} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={14} />
                            {saving ? 'Creating...' : 'Create'}
                        </button>
                        <button onClick={() => setShowCreate(false)} style={{ height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                <input type="text" placeholder="Search units by name or abbreviation..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', paddingLeft: '34px', paddingRight: '12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} />
            </div>

            {/* Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Abbreviation</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Products</th>
                            <th style={{ width: '180px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && units.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--color-hint)', fontSize: '13px' }}>Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '60px 16px', textAlign: 'center' }}>
                                <p style={{ fontSize: '14px', color: 'var(--color-text-dim)', margin: 0 }}>{search ? 'No units match your search' : 'No units found'}</p>
                            </td></tr>
                        ) : filtered.map((unit, index) => (
                            <tr key={unit.id} style={{ borderBottom: index < filtered.length - 1 ? '1px solid var(--border-light)' : 'none', background: editing === unit.id ? 'var(--color-panel-2)' : 'var(--color-panel)' }}>
                                {editing === unit.id ? (
                                    <>
                                        <td style={{ padding: '12px 16px' }}>
                                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ height: '34px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <input value={form.abbreviation} onChange={e => setForm(p => ({ ...p, abbreviation: e.target.value }))} maxLength={10} style={{ height: '34px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '80px' }} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ height: '34px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>—</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>—</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button onClick={handleSaveEdit} disabled={saving} style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Check size={14} /> Save
                                                </button>
                                                <button onClick={cancelEdit} style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{unit.name}</span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, background: 'var(--color-panel-2)', padding: '4px 10px', borderRadius: '6px', color: 'var(--color-text)' }}>
                                                {unit.abbreviation}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>{unit.description || '—'}</td>
                                        <td style={{ padding: '14px 16px' }}><StatusBadge isActive={unit.is_active} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                                                {unit.product_count ?? '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => handleEdit(unit)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Edit size={14} /> Edit
                                                </button>
                                                <button onClick={() => handleToggleActive(unit)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: unit.is_active ? '#f59e0b' : '#10b981', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {unit.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                                    {unit.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button onClick={() => handleDelete(unit)} style={{ minWidth: '44px', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setDeleteConfirm(null)}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', border: '1px solid var(--border-surface)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={18} color="#ef4444" />
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Delete Unit</h3>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)', marginBottom: '24px', lineHeight: 1.5 }}>
                            Are you sure you want to delete <strong style={{ color: 'var(--color-text)' }}>"{deleteConfirm.name}"</strong>? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setDeleteConfirm(null)} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={confirmDelete} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default UnitsTab
