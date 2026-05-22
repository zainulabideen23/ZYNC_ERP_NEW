import { useState, useRef, useEffect } from 'react'
import { brandsAPI } from '../services/api'
import toast from 'react-hot-toast'

function BrandSelector({ value, onChange, brands = [], onBrandsChange, error }) {
    const [showAdd, setShowAdd] = useState(false)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const nameRef = useRef(null)

    const handleCreate = async () => {
        if (!newName.trim()) {
            toast.error('Brand name is required')
            return
        }
        try {
            setCreating(true)
            const res = await brandsAPI.create({ name: newName.trim() })
            toast.success(`Brand "${res.data.name}" created`)
            if (onBrandsChange) {
                const listRes = await brandsAPI.list()
                onBrandsChange(listRes.data || [])
            }
            onChange(res.data.id)
            setShowAdd(false)
            setNewName('')
        } catch (err) {
            toast.error(err.message || 'Failed to create brand')
        } finally {
            setCreating(false)
        }
    }

    useEffect(() => {
        if (showAdd && nameRef.current) nameRef.current.focus()
    }, [showAdd])

    return (
        <div className="brand-selector">
            <select
                className={error ? 'error' : ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">No Brand</option>
                {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
            {error && <span className="error-text">{error}</span>}

            <button
                type="button"
                className="brand-add-toggle"
                onClick={() => setShowAdd(!showAdd)}
            >
                {showAdd ? '✕ Cancel' : '＋ Add new brand'}
            </button>

            {showAdd && (
                <div className="brand-add-inline">
                    <input
                        ref={nameRef}
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Brand name"
                        maxLength={150}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                        {creating ? '...' : 'Add'}
                    </button>
                </div>
            )}

            <style>{`
                .brand-selector { display: flex; flex-direction: column; gap: 0.5rem; }
                .brand-add-toggle {
                    background: none; border: none; color: var(--color-accent); cursor: pointer;
                    font-size: 0.8rem; text-align: left; padding: 0; font-weight: 500;
                }
                .brand-add-toggle:hover { color: var(--color-accent-hover); }
                .brand-add-inline {
                    display: flex; gap: 6px; align-items: stretch;
                }
                .brand-add-inline input {
                    flex: 1; padding: 0.5rem 0.75rem; font-size: 0.85rem;
                    background: var(--color-bg); border: 1px solid var(--border-surface); border-radius: 6px; color: var(--color-text);
                }
                .brand-add-inline input:focus {
                    border-color: var(--color-accent); outline: none;
                }
                .brand-add-inline .btn-sm {
                    padding: 0.5rem 1rem; font-size: 0.8rem; white-space: nowrap;
                }
            `}</style>
        </div>
    )
}

export default BrandSelector
