import { useState, useRef, useEffect } from 'react'
import { categoriesAPI } from '../services/api'
import toast from 'react-hot-toast'

/**
 * Hierarchical category dropdown.
 * Expects categories as a flat array with parent_id or a nested tree (auto-detects).
 */
function CategorySelector({ value, onChange, categories = [], onCategoriesChange, error }) {
    const [showAdd, setShowAdd] = useState(false)
    const [newCat, setNewCat] = useState({ name: '', parent_id: '' })
    const [creating, setCreating] = useState(false)
    const nameRef = useRef(null)

    // Flatten tree to option list with indent
    const flattenForSelect = (cats, depth = 0) => {
        let result = []
        for (const cat of cats) {
            result.push({
                id: cat.id,
                name: cat.name,
                depth,
                product_count: cat.product_count || 0,
                is_active: cat.is_active
            })
            if (cat.children && cat.children.length > 0) {
                result = result.concat(flattenForSelect(cat.children, depth + 1))
            }
        }
        return result
    }

    // If categories come as nested tree (have children arrays), flatten them
    // If flat with parent_id, build tree first
    const buildTree = (flat, parentId = null) =>
        flat
            .filter(c => (c.parent_id || null) == parentId)
            .map(c => ({ ...c, children: buildTree(flat, c.id) }))

    const isNested = categories.length > 0 && categories[0]?.children !== undefined
    const tree = isNested ? categories : buildTree(categories)
    const options = flattenForSelect(tree)

    // Get top-level categories for "add new" parent selector
    const topLevelCats = options.filter(o => o.depth === 0)

    const handleCreate = async () => {
        if (!newCat.name.trim()) {
            toast.error('Category name is required')
            return
        }
        try {
            setCreating(true)
            const payload = { name: newCat.name.trim() }
            if (newCat.parent_id) payload.parent_id = parseInt(newCat.parent_id)
            const res = await categoriesAPI.create(payload)
            toast.success(`Category "${res.data.name}" created`)
            if (onCategoriesChange) {
                const catRes = await categoriesAPI.list()
                onCategoriesChange(catRes.data || [])
            }
            onChange(res.data.id)
            setShowAdd(false)
            setNewCat({ name: '', parent_id: '' })
        } catch (err) {
            toast.error(err.message || 'Failed to create category')
        } finally {
            setCreating(false)
        }
    }

    useEffect(() => {
        if (showAdd && nameRef.current) nameRef.current.focus()
    }, [showAdd])

    return (
        <div className="cat-selector">
            <select
                className={error ? 'error' : ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select a Category</option>
                {options.map(o => (
                    <option key={o.id} value={o.id}>
                        {o.depth > 0 ? '↳ ' : ''}{o.name}
                        {o.product_count > 0 ? ` (${o.product_count})` : ''}
                    </option>
                ))}
            </select>
            {error && <span className="error-text">{error}</span>}

            <button
                type="button"
                className="cat-add-toggle"
                onClick={() => setShowAdd(!showAdd)}
            >
                {showAdd ? '✕ Cancel' : '＋ Add new category'}
            </button>

            {showAdd && (
                <div className="cat-add-inline">
                    <input
                        ref={nameRef}
                        type="text"
                        value={newCat.name}
                        onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                        placeholder="Category name"
                        maxLength={100}
                    />
                    <select
                        value={newCat.parent_id}
                        onChange={e => setNewCat(p => ({ ...p, parent_id: e.target.value }))}
                    >
                        <option value="">Top level</option>
                        {topLevelCats.map(c => (
                            <option key={c.id} value={c.id}>Under: {c.name}</option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                        {creating ? '...' : 'Add'}
                    </button>
                </div>
            )}

            <style>{`
                .cat-selector { display: flex; flex-direction: column; gap: 0.5rem; }
                .cat-add-toggle {
                    background: none; border: none; color: var(--color-accent); cursor: pointer;
                    font-size: 0.8rem; text-align: left; padding: 0; font-weight: 500;
                }
                .cat-add-toggle:hover { color: var(--color-accent-hover); }
                .cat-add-inline {
                    display: flex; gap: 6px; align-items: stretch;
                }
                .cat-add-inline input, .cat-add-inline select {
                    flex: 1; padding: 0.5rem 0.75rem; font-size: 0.85rem;
                    background: var(--color-bg); border: 1px solid var(--border-surface); border-radius: 6px; color: var(--color-text);
                }
                .cat-add-inline input:focus, .cat-add-inline select:focus {
                    border-color: var(--color-accent); outline: none;
                }
                .cat-add-inline .btn-sm {
                    padding: 0.5rem 1rem; font-size: 0.8rem; white-space: nowrap;
                }
            `}</style>
        </div>
    )
}

export default CategorySelector
