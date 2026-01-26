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
    const [formData, setFormData] = useState({ code: '', name: '', phone: '', email: '', address: '', city: '', contact_person: '' })

    useEffect(() => { loadData() }, [search])

    const loadData = async () => {
        try {
            const response = await suppliersAPI.list({ search, limit: 100 })
            setSuppliers(response.data)
        } catch (error) {
            toast.error('Failed to load suppliers')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) {
                await suppliersAPI.update(editing.id, formData)
                toast.success('Supplier updated')
            } else {
                await suppliersAPI.create(formData)
                toast.success('Supplier created')
            }
            setShowModal(false)
            setFormData({ code: '', name: '', phone: '', email: '', address: '', city: '', contact_person: '' })
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
                <button className="btn btn-primary" onClick={() => { setEditing(null); setFormData({ code: '', name: '', phone: '', email: '', address: '', city: '', contact_person: '' }); setShowModal(true) }}>+ Add Supplier</button>
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input type="text" className="form-input" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: '400px' }} />
            </div>
            <div className="card">
                <table className="table">
                    <thead><tr><th>Code</th><th>Name</th><th>Phone</th><th>Contact Person</th><th>City</th><th>Actions</th></tr></thead>
                    <tbody>
                        {suppliers.map((s) => (
                            <tr key={s.id}>
                                <td className="font-mono">{s.code || '-'}</td><td>{s.name}</td><td>{s.phone || '-'}</td><td>{s.contact_person || '-'}</td><td>{s.city || '-'}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { setEditing(s); setFormData({ code: s.code || '', name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', city: s.city || '', contact_person: s.contact_person || '' }); setShowModal(true) }}>Edit</button>
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
                            <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} rows="2" /></div>
                            <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
                            <div className="flex gap-4"><button type="submit" className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
export default Suppliers
