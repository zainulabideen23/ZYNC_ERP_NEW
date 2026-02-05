import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { suppliersAPI } from '../services/api'

function Suppliers() {
    const [suppliers, setSuppliers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [formData, setFormData] = useState({
        code: '', name: '', phone_number: '', email: '',
        address_line1: '', city: '', contact_person: '',
        opening_balance: '0'
    })

    useEffect(() => { loadData() }, [search])

    const loadData = async () => {
        try {
            const response = await suppliersAPI.list({ search, limit: 100 })
            setSuppliers(response.data || [])
        } catch (error) {
            toast.error('Failed to load suppliers')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = {
                ...formData,
                opening_balance: parseFloat(formData.opening_balance || 0)
            }
            if (editing) {
                await suppliersAPI.update(editing.id, data)
                toast.success('Supplier updated')
            } else {
                await suppliersAPI.create(data)
                toast.success('Supplier created')
            }
            setShowModal(false)
            setFormData({
                code: '', name: '', phone_number: '', email: '',
                address_line1: '', city: '', contact_person: '',
                opening_balance: '0'
            })
            setEditing(null)
            loadData()
        } catch (error) {
            toast.error(error.message)
        }
    }

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Suppliers</h1>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setFormData({ code: '', name: '', phone_number: '', email: '', address_line1: '', city: '', contact_person: '', opening_balance: '0' }); setShowModal(true) }}>+ Add Supplier</button>
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input type="text" className="form-input" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: '400px' }} />
            </div>
            <div className="card">
                <table className="table">
                    <thead><tr><th>Code</th><th>Name</th><th>Phone</th><th>Contact Person</th><th style={{ textAlign: 'right' }}>Balance</th><th>Actions</th></tr></thead>
                    <tbody>
                        {suppliers.map((s) => (
                            <tr key={s.id}>
                                <td className="font-mono">{s.code || '-'}</td><td>{s.name}</td><td>{s.phone_number || '-'}</td><td>{s.contact_person || '-'}</td><td style={{ textAlign: 'right' }}>Rs. {Number(s.current_balance).toLocaleString()}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { setEditing(s); setFormData({ code: s.code || '', name: s.name, phone_number: s.phone_number || '', email: s.email || '', address_line1: s.address_line1 || '', city: s.city || '', contact_person: s.contact_person || '', opening_balance: '0' }); setShowModal(true) }}>Edit</button>
                                        <Link to={`/suppliers/${s.id}/ledger`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', textDecoration: 'none' }}>📄 Ledger</Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '24px' }}>{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                            <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" value={formData.address_line1} onChange={e => setFormData({ ...formData, address_line1: e.target.value })} rows="2" /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
                                {!editing && (
                                    <div className="form-group"><label className="form-label">Opening Balance</label><input type="number" className="form-input" value={formData.opening_balance} onChange={e => setFormData({ ...formData, opening_balance: e.target.value })} /></div>
                                )}
                            </div>
                            <div className="flex gap-4" style={{ marginTop: '20px' }}><button type="submit" className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
export default Suppliers
