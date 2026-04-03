import { useState, useEffect } from 'react'
import { categoriesAPI } from '../../../services/api'
import toast from 'react-hot-toast'
import { Plus, X, ChevronRight, Loader2, FolderOpen } from 'lucide-react'

const inputStyle = {
    padding: '8px 12px', fontSize: '0.82rem',
    background: 'var(--color-bg)', border: '1px solid var(--border-surface)', borderRadius: 8,
    color: 'var(--color-text)', outline: 'none', flex: 1,
    transition: 'border-color 0.15s', fontFamily: 'inherit',
}

function Step2Categories({ onContinue, saving }) {
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [addingCategory, setAddingCategory] = useState(false)
    const [addingSubcategoryFor, setAddingSubcategoryFor] = useState(null)
    const [newName, setNewName] = useState('')
    const [subName, setSubName] = useState('')
    const [savingItem, setSavingItem] = useState(false)

    const loadCategories = async () => {
        try {
            const res = await categoriesAPI.listFlat()
            setCategories(res.data || [])
        } catch (err) {
            toast.error('Failed to load categories')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadCategories() }, [])

    // Build tree
    const roots = categories.filter(c => !c.parent_id)
    const getChildren = (parentId) => categories.filter(c => c.parent_id === parentId)

    const handleAddCategory = async () => {
        if (!newName.trim()) return
        try {
            setSavingItem(true)
            await categoriesAPI.create({ name: newName.trim() })
            setNewName('')
            setAddingCategory(false)
            await loadCategories()
        } catch (err) {
            toast.error(err.message || 'Failed to add category')
        } finally {
            setSavingItem(false)
        }
    }

    const handleAddSubcategory = async (parentId) => {
        if (!subName.trim()) return
        try {
            setSavingItem(true)
            await categoriesAPI.create({ name: subName.trim(), parent_id: parentId })
            setSubName('')
            setAddingSubcategoryFor(null)
            await loadCategories()
        } catch (err) {
            toast.error(err.message || 'Failed to add subcategory')
        } finally {
            setSavingItem(false)
        }
    }

    const handleDelete = async (cat) => {
        const children = getChildren(cat.id)
        if (children.length > 0) {
            if (!window.confirm(`Removing "${cat.name}" will also remove its ${children.length} subcategories. Continue?`)) return
        }
        try {
            setSavingItem(true)
            await categoriesAPI.delete(cat.id)
            await loadCategories()
        } catch (err) {
            toast.error(err.message || 'Failed to delete category')
        } finally {
            setSavingItem(false)
        }
    }

    const handleKeyDown = (e, callback) => {
        if (e.key === 'Enter') callback()
        if (e.key === 'Escape') { setAddingCategory(false); setAddingSubcategoryFor(null) }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <Loader2 size={28} style={{ color: 'var(--color-accent)', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                        Set up your product categories
                    </h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>
                        Organize your products into groups (max 2 levels: Category → Subcategory)
                    </p>
                </div>
                {!addingCategory && (
                    <button
                        onClick={() => { setAddingCategory(true); setNewName('') }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem',
                            fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer',
                            background: 'var(--blue-dim)', border: '1px solid rgba(37,99,235,0.2)',
                            whiteSpace: 'nowrap', transition: 'background 0.15s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--blue-dim)'}
                    >
                        <Plus size={14} /> Add Category
                    </button>
                )}
            </div>

            {/* Inline add form */}
            {addingCategory && (
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
                    padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 10,
                    border: '1px solid var(--border-surface)',
                }}>
                    <input
                        autoFocus value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, handleAddCategory)}
                        placeholder="Category name…"
                        style={inputStyle}
                    />
                    <button
                        onClick={handleAddCategory}
                        disabled={savingItem || !newName.trim()}
                        style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem',
                            fontWeight: 600, color: '#fff', background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                            cursor: savingItem || !newName.trim() ? 'not-allowed' : 'pointer',
                            opacity: savingItem || !newName.trim() ? 0.5 : 1,
                        }}
                    >Add</button>
                    <button
                        onClick={() => setAddingCategory(false)}
                        style={{
                            padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem',
                            color: 'var(--color-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >Cancel</button>
                </div>
            )}

            {/* Category list */}
            {roots.length === 0 && !addingCategory ? (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '3rem 0', color: 'var(--color-hint)',
                }}>
                    <FolderOpen size={40} style={{ marginBottom: 8, color: 'var(--color-panel-3)' }} />
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>No categories yet. Add your first one above!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {roots.map(cat => {
                        const children = getChildren(cat.id)
                        return (
                            <div key={cat.id} style={{
                                background: 'var(--color-bg)', borderRadius: 10,
                                border: '1px solid var(--border-surface)', padding: '10px 16px', marginBottom: 6,
                            }}>
                                {/* Parent row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1rem' }}>📂</span>
                                        <span style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.88rem' }}>{cat.name}</span>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(cat)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-hint)', padding: '4px', transition: 'color 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-hint)'}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Subcategories */}
                                {children.map(sub => (
                                    <div key={sub.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        paddingLeft: 28, marginTop: 6,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ color: 'var(--color-hint)' }}>└─</span>
                                            <span style={{ color: 'var(--color-muted)', fontSize: '0.82rem' }}>{sub.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(sub)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-hint)', padding: '4px', transition: 'color 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-hint)'}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                {/* Add subcategory */}
                                {addingSubcategoryFor === cat.id ? (
                                    <div style={{
                                        display: 'flex', gap: 8, alignItems: 'center',
                                        paddingLeft: 28, marginTop: 8,
                                    }}>
                                        <input
                                            autoFocus value={subName}
                                            onChange={e => setSubName(e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, () => handleAddSubcategory(cat.id))}
                                            placeholder="Subcategory name…"
                                            style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.78rem' }}
                                        />
                                        <button
                                            onClick={() => handleAddSubcategory(cat.id)}
                                            disabled={savingItem || !subName.trim()}
                                            style={{
                                                padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem',
                                                fontWeight: 600, color: '#fff', background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                                                cursor: savingItem || !subName.trim() ? 'not-allowed' : 'pointer',
                                                opacity: savingItem || !subName.trim() ? 0.5 : 1,
                                            }}
                                        >Add</button>
                                        <button
                                            onClick={() => setAddingSubcategoryFor(null)}
                                            style={{
                                                padding: '6px 8px', borderRadius: 6, fontSize: '0.75rem',
                                                color: 'var(--color-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                            }}
                                        >Cancel</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setAddingSubcategoryFor(cat.id); setSubName('') }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            paddingLeft: 28, marginTop: 6, fontSize: '0.75rem',
                                            color: 'var(--color-hint)', background: 'none', border: 'none', cursor: 'pointer',
                                            transition: 'color 0.15s', fontFamily: 'inherit',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-hint)'}
                                    >
                                        <Plus size={12} /> Add Subcategory
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Continue */}
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={onContinue}
                    disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '11px 24px', borderRadius: 10, fontSize: '0.88rem',
                        fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                        background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                        opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-accent)'}
                >
                    Continue <ChevronRight size={16} />
                </button>
            </div>
        </div>
    )
}

export default Step2Categories
