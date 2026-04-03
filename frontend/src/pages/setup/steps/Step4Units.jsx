import { useState, useEffect } from 'react'
import { unitsAPI } from '../../../services/api'
import toast from 'react-hot-toast'
import { Plus, X, ChevronRight, Loader2, Check, Ruler } from 'lucide-react'

const DEFAULT_UNITS = [
    { name: 'Piece', abbreviation: 'pcs' },
    { name: 'Kilogram', abbreviation: 'kg' },
    { name: 'Litre', abbreviation: 'ltr' },
    { name: 'Box', abbreviation: 'box' },
    { name: 'Pack', abbreviation: 'pack' },
    { name: 'Dozen', abbreviation: 'dz' },
    { name: 'Meter', abbreviation: 'm' },
    { name: 'Sq. Meter', abbreviation: 'sqm' },
]

const inputStyle = {
    padding: '8px 12px', fontSize: '0.82rem',
    background: 'var(--color-bg)', border: '1px solid var(--border-surface)', borderRadius: 8,
    color: 'var(--color-text)', outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
}

function Step4Units({ onContinue, saving }) {
    const [units, setUnits] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [newName, setNewName] = useState('')
    const [newAbbrev, setNewAbbrev] = useState('')
    const [savingItem, setSavingItem] = useState(false)
    const [seeding, setSeeding] = useState(false)

    const loadUnits = async () => {
        try {
            const res = await unitsAPI.list()
            setUnits(res.data || [])
        } catch (err) {
            toast.error('Failed to load units')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadUnits() }, [])

    // Separate default-like units from custom ones
    const defaultNames = DEFAULT_UNITS.map(u => u.name.toLowerCase())
    const existingDefaults = units.filter(u => defaultNames.includes(u.name.toLowerCase()))
    const customUnits = units.filter(u => !defaultNames.includes(u.name.toLowerCase()))

    const handleAdd = async () => {
        if (!newName.trim() || !newAbbrev.trim()) return
        try {
            setSavingItem(true)
            await unitsAPI.create({ name: newName.trim(), abbreviation: newAbbrev.trim() })
            setNewName('')
            setNewAbbrev('')
            setAdding(false)
            await loadUnits()
        } catch (err) {
            toast.error(err.message || 'Failed to add unit')
        } finally {
            setSavingItem(false)
        }
    }

    const handleSeedAll = async () => {
        try {
            setSeeding(true)
            const res = await unitsAPI.seed()
            if (res.added > 0) {
                toast.success(res.message || `${res.added} units added`)
            } else {
                toast.success('All standard units already exist')
            }
            await loadUnits()
        } catch (err) {
            toast.error(err.message || 'Failed to seed units')
        } finally {
            setSeeding(false)
        }
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
                Units of measurement
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: 24 }}>
                {units.length > 0
                    ? `${units.length} standard unit${units.length !== 1 ? 's' : ''} ready. Add any additional ones your business needs.`
                    : 'No units found. Seed the standard set or add your own.'}
            </p>

            {/* Quick-seed button when missing defaults */}
            {existingDefaults.length < DEFAULT_UNITS.length && (
                <button
                    onClick={handleSeedAll}
                    disabled={seeding}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '9px 18px', borderRadius: 10, fontSize: '0.82rem',
                        fontWeight: 600, color: '#fff', cursor: seeding ? 'not-allowed' : 'pointer',
                        background: 'linear-gradient(135deg, var(--color-accent), #6366f1)', border: 'none', fontFamily: 'inherit',
                        opacity: seeding ? 0.6 : 1, transition: 'opacity 0.15s',
                        marginBottom: 20,
                    }}
                >
                    {seeding ? (
                        <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Seeding…</>
                    ) : (
                        <><Plus size={14} /> Add All Standard Units</>
                    )}
                </button>
            )}

            {/* Default units grid */}
            {existingDefaults.length > 0 && (
                <>
                    <div style={{
                        fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
                    }}>Standard Units</div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: 8, marginBottom: 24,
                    }}>
                        {DEFAULT_UNITS.map(du => {
                            const exists = existingDefaults.find(u => u.name.toLowerCase() === du.name.toLowerCase())
                            return (
                                <div key={du.name} style={{
                                    padding: '10px 14px', borderRadius: 10,
                                    background: exists ? 'rgba(34,197,94,0.06)' : 'var(--color-bg)',
                                    border: exists ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border-surface)',
                                    display: 'flex', flexDirection: 'column', gap: 2,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {exists ? (
                                            <Check size={12} style={{ color: '#4ade80' }} />
                                        ) : (
                                            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border-surface)', display: 'inline-block' }} />
                                        )}
                                        <span style={{
                                            fontSize: '0.82rem', fontWeight: 600,
                                            color: exists ? 'var(--color-text)' : 'var(--color-hint)',
                                        }}>{du.name}</span>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', paddingLeft: 18 }}>
                                        {du.abbreviation}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Custom units */}
            {customUnits.length > 0 && (
                <>
                    <div style={{
                        fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
                    }}>Custom Units</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {customUnits.map(unit => (
                            <span key={unit.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px', borderRadius: 9999,
                                background: 'var(--color-bg)', border: '1px solid var(--border-surface)',
                                color: 'var(--color-text)', fontSize: '0.82rem',
                            }}>
                                {unit.name} ({unit.abbreviation})
                            </span>
                        ))}
                    </div>
                </>
            )}

            {/* Add custom unit */}
            {adding ? (
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 10,
                    border: '1px solid var(--border-surface)', marginBottom: 16,
                }}>
                    <input
                        autoFocus value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Unit name"
                        style={{ ...inputStyle, flex: 2 }}
                    />
                    <input
                        value={newAbbrev}
                        onChange={e => setNewAbbrev(e.target.value)}
                        placeholder="Abbr"
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={savingItem || !newName.trim() || !newAbbrev.trim()}
                        style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem',
                            fontWeight: 600, color: '#fff', background: 'var(--color-accent)', border: 'none', fontFamily: 'inherit',
                            cursor: savingItem || !newName.trim() || !newAbbrev.trim() ? 'not-allowed' : 'pointer',
                            opacity: savingItem || !newName.trim() || !newAbbrev.trim() ? 0.5 : 1,
                        }}
                    >Add</button>
                    <button
                        onClick={() => setAdding(false)}
                        style={{
                            padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem',
                            color: 'var(--color-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >Cancel</button>
                </div>
            ) : (
                <button
                    onClick={() => { setAdding(true); setNewName(''); setNewAbbrev('') }}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem',
                        fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer',
                        background: 'rgba(37,99,235,0.06)', border: '1px dashed rgba(37,99,235,0.25)',
                        transition: 'background 0.15s', marginBottom: 16, fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,99,235,0.06)'}
                >
                    <Plus size={14} /> Add Custom Unit
                </button>
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

export default Step4Units
