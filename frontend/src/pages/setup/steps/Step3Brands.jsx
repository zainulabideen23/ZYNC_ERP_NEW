import { useState, useEffect } from 'react'
import { brandsAPI } from '../../../services/api'
import toast from 'react-hot-toast'
import { Plus, X, ChevronRight, Loader2, Award } from 'lucide-react'

const inputStyle = {
    padding: '8px 12px', fontSize: '0.82rem',
    background: 'var(--color-bg)', border: '1px solid var(--border-surface)', borderRadius: 8,
    color: 'var(--color-text)', outline: 'none', flex: 1,
    transition: 'border-color 0.15s', fontFamily: 'inherit',
}

function Step3Brands({ onContinue, saving }) {
    const [brands, setBrands] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [newName, setNewName] = useState('')
    const [savingItem, setSavingItem] = useState(false)

    const loadBrands = async () => {
        try {
            const res = await brandsAPI.list()
            setBrands(res.data || [])
        } catch (err) {
            toast.error('Failed to load brands')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadBrands() }, [])

    const handleAdd = async () => {
        if (!newName.trim()) return
        try {
            setSavingItem(true)
            await brandsAPI.create({ name: newName.trim() })
            setNewName('')
            setAdding(false)
            await loadBrands()
        } catch (err) {
            toast.error(err.message || 'Failed to add brand')
        } finally {
            setSavingItem(false)
        }
    }

    const handleDelete = async (brand) => {
        try {
            setSavingItem(true)
            await brandsAPI.delete(brand.id)
            await loadBrands()
        } catch (err) {
            toast.error(err.message || 'Failed to delete brand')
        } finally {
            setSavingItem(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAdd()
        if (e.key === 'Escape') setAdding(false)
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                Which brands do you stock?
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: 24 }}>
                Add the manufacturers and brands of products you carry
            </p>

            {/* Brand pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {brands.map(brand => (
                    <span key={brand.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 9999,
                        background: 'var(--color-bg)', border: '1px solid var(--border-surface)',
                        color: 'var(--color-text)', fontSize: '0.82rem', fontWeight: 500,
                        transition: 'border-color 0.15s',
                    }}>
                        {brand.name}
                        <button
                            onClick={() => handleDelete(brand)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-hint)', padding: 0, display: 'flex', transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-hint)'}
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}

                {/* Inline add trigger */}
                {!adding && (
                    <button
                        onClick={() => { setAdding(true); setNewName('') }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '6px 14px', borderRadius: 9999, fontSize: '0.82rem',
                            fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer',
                            background: 'rgba(37,99,235,0.06)', border: '1px dashed rgba(37,99,235,0.25)',
                            transition: 'background 0.15s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,99,235,0.06)'}
                    >
                        <Plus size={14} /> Add Brand
                    </button>
                )}
            </div>

            {/* No brands empty state */}
            {brands.length === 0 && !adding && (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '2rem 0', color: 'var(--color-hint)',
                }}>
                    <Award size={36} style={{ marginBottom: 8, color: 'var(--color-panel-3)' }} />
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>No brands added yet. Click "+ Add Brand" to get started.</p>
                </div>
            )}

            {/* Add form */}
            {adding && (
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 10,
                    border: '1px solid var(--border-surface)', marginBottom: 16,
                }}>
                    <input
                        autoFocus value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Brand nameâ€¦"
                        style={inputStyle}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={savingItem || !newName.trim()}
                        style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem',
                            fontWeight: 600, color: '#fff', background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                            cursor: savingItem || !newName.trim() ? 'not-allowed' : 'pointer',
                            opacity: savingItem || !newName.trim() ? 0.5 : 1,
                        }}
                    >Add Brand</button>
                    <button
                        onClick={() => setAdding(false)}
                        style={{
                            padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem',
                            color: 'var(--color-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >Cancel</button>
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

export default Step3Brands
