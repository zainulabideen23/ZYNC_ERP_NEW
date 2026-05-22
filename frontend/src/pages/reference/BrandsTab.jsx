import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { brandsAPI } from '../../services/api'
import { Plus, Edit, Trash2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'

function BrandsTab() {
    const [brands, setBrands] = useState([])
    const [loading, setLoading] = useState(true)
    const [showInactive, setShowInactive] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', description: '' })
    const [saving, setSaving] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    useEffect(() => { loadBrands() }, [showInactive])

    const loadBrands = async () => {
        try {
            setLoading(true)
            const params = showInactive ? { all: true } : {}
            const res = await brandsAPI.list(params)
            setBrands(res.data || [])
        } catch (err) {
            toast.error('Failed to load brands')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!form.name.trim()) {
            toast.error('Name is required')
            return
        }
        try {
            setSaving(true)
            await brandsAPI.create({ name: form.name.trim(), description: form.description.trim() })
            toast.success('Brand created')
            setForm({ name: '', description: '' })
            setShowCreate(false)
            loadBrands()
        } catch (err) {
            toast.error(err.message || 'Failed to create brand')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (brand) => {
        setEditing(brand.id)
        setForm({ name: brand.name, description: brand.description || '' })
    }

    const handleSaveEdit = async () => {
        if (!form.name.trim()) {
            toast.error('Name is required')
            return
        }
        try {
            setSaving(true)
            await brandsAPI.update(editing, {
                name: form.name.trim(),
                description: form.description.trim()
            })
            toast.success('Brand updated')
            setEditing(null)
            setForm({ name: '', description: '' })
            loadBrands()
        } catch (err) {
            toast.error(err.message || 'Failed to update brand')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleActive = async (brand) => {
        try {
            await brandsAPI.update(brand.id, { is_active: !brand.is_active })
            toast.success(brand.is_active ? 'Brand deactivated' : 'Brand activated')
            loadBrands()
        } catch (err) {
            toast.error(err.message || 'Failed to update brand')
        }
    }

    const handleDelete = async (brand) => {
        setDeleteConfirm(brand)
    }

    const confirmDelete = async () => {
        if (!deleteConfirm) return
        try {
            await brandsAPI.delete(deleteConfirm.id)
            toast.success('Brand deleted')
            loadBrands()
        } catch (err) {
            toast.error(err.message || 'Cannot delete: brand is in use')
        } finally {
            setDeleteConfirm(null)
        }
    }

    const cancelEdit = () => {
        setEditing(null)
        setForm({ name: '', description: '' })
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}>
                    <div style={{ position: 'relative', width: '36px', height: '20px' }}>
                        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                        <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: showInactive ? 'var(--blue)' : 'var(--color-panel-2)', border: '1px solid var(--border-surface)', transition: 'all 0.2s', position: 'relative' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '1px', left: showInactive ? '17px' : '1px', transition: 'all 0.2s' }} />
                        </div>
                    </div>
                    Show inactive
                </label>
                <button onClick={() => { setShowCreate(true); setEditing(null); setForm({ name: '', description: '' }) }} style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={15} />
                    Add Brand
                </button>
            </div>

            {/* Create Form */}
            {showCreate && !editing && (
                <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Name *</label>
                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Samsung" style={{ height: '38px', width: '100%', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
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

            {/* Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ width: '180px', padding: '12px 16px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && brands.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--color-hint)', fontSize: '13px' }}>Loading...</td></tr>
                        ) : brands.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '60px 16px', textAlign: 'center' }}>
                                <p style={{ fontSize: '14px', color: 'var(--color-text-dim)', margin: 0 }}>No brands found</p>
                            </td></tr>
                        ) : brands.map((brand, index) => (
                            <tr key={brand.id} style={{ borderBottom: index < brands.length - 1 ? '1px solid var(--border-light)' : 'none', background: editing === brand.id ? 'var(--color-panel-2)' : 'var(--color-panel)' }}>
                                {editing === brand.id ? (
                                    <>
                                        <td style={{ padding: '12px 16px' }}>
                                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ height: '34px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ height: '34px', background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>—</td>
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
                                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{brand.name}</span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>{brand.description || '—'}</td>
                                        <td style={{ padding: '14px 16px' }}><StatusBadge isActive={brand.is_active} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => handleEdit(brand)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Edit size={14} /> Edit
                                                </button>
                                                <button onClick={() => handleToggleActive(brand)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: brand.is_active ? '#f59e0b' : '#10b981', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {brand.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                                    {brand.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button onClick={() => handleDelete(brand)} style={{ minWidth: '44px', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Delete Brand</h3>
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

export default BrandsTab
