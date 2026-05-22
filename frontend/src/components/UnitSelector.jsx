import { useState, useRef, useEffect } from 'react'
import { unitsAPI } from '../services/api'
import toast from 'react-hot-toast'

function UnitSelector({ value, onChange, units = [], onUnitsChange, error }) {
    const [showModal, setShowModal] = useState(false)
    const [search, setSearch] = useState('')
    const [newUnit, setNewUnit] = useState({ name: '', abbreviation: '' })
    const [creating, setCreating] = useState(false)
    const nameRef = useRef(null)

    const filtered = units.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.abbreviation.toLowerCase().includes(search.toLowerCase())
    )

    const handleQuickCreate = async () => {
        if (!newUnit.name.trim() || !newUnit.abbreviation.trim()) {
            toast.error('Name and abbreviation are required')
            return
        }
        try {
            setCreating(true)
            const res = await unitsAPI.quickCreate({
                name: newUnit.name.trim(),
                abbreviation: newUnit.abbreviation.trim()
            })
            toast.success(`Unit "${res.data.name}" created`)
            // Refresh units list from parent
            if (onUnitsChange) {
                const unitsRes = await unitsAPI.list()
                onUnitsChange(unitsRes.data || [])
            }
            onChange(res.data.id)
            setShowModal(false)
            setNewUnit({ name: '', abbreviation: '' })
        } catch (err) {
            toast.error(err.message || 'Failed to create unit')
        } finally {
            setCreating(false)
        }
    }

    useEffect(() => {
        if (showModal && nameRef.current) nameRef.current.focus()
    }, [showModal])

    return (
        <div className="unit-selector">
            <select
                className={error ? 'error' : ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select a Unit</option>
                {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                ))}
            </select>
            {error && <span className="error-text">{error}</span>}

            <button
                type="button"
                className="cat-add-toggle"
                style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: 0, fontWeight: 500 }}
                onClick={() => setShowModal(true)}
            >
                ＋ Add new unit
            </button>

            {showModal && (
                <div className="unit-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="unit-modal" onClick={e => e.stopPropagation()}>
                        <div className="unit-modal-header">
                            <h3>Add Custom Unit</h3>
                            <button className="unit-modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="unit-modal-body">
                            <div className="unit-modal-field">
                                <label>Unit Name *</label>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    value={newUnit.name}
                                    onChange={e => setNewUnit(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Kilogram"
                                    maxLength={50}
                                />
                            </div>
                            <div className="unit-modal-field">
                                <label>Abbreviation *</label>
                                <input
                                    type="text"
                                    value={newUnit.abbreviation}
                                    onChange={e => setNewUnit(p => ({ ...p, abbreviation: e.target.value }))}
                                    placeholder="e.g. kg"
                                    maxLength={10}
                                />
                            </div>
                        </div>
                        <div className="unit-modal-footer">
                            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleQuickCreate} disabled={creating}>
                                {creating ? 'Creating...' : 'Create & Select'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .unit-modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center; z-index: 1000;
                }
                .unit-modal {
                    background: var(--color-panel); border: 1px solid var(--border-surface); border-radius: 12px;
                    width: 380px; max-width: 90vw; box-shadow: var(--elevation-3);
                }
                .unit-modal-header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-surface);
                }
                .unit-modal-header h3 { margin: 0; font-size: 1rem; color: var(--color-text); }
                .unit-modal-close {
                    background: none; border: none; color: var(--color-muted); cursor: pointer;
                    font-size: 1.1rem; padding: 4px;
                }
                .unit-modal-close:hover { color: var(--color-text); }
                .unit-modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
                .unit-modal-field { display: flex; flex-direction: column; gap: 0.5rem; }
                .unit-modal-field label { font-size: 0.85rem; color: var(--color-muted); font-weight: 600; }
                .unit-modal-field input {
                    background: var(--color-bg); border: 1px solid var(--border-surface); border-radius: 8px;
                    padding: 0.75rem 1rem; color: var(--color-text); font-size: 0.9rem;
                }
                .unit-modal-field input:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
                .unit-modal-footer {
                    padding: 1rem 1.5rem; border-top: 1px solid var(--border-surface);
                    display: flex; justify-content: flex-end; gap: 0.75rem;
                }
            `}</style>
        </div>
    )
}

export default UnitSelector
