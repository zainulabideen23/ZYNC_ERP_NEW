import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { customersAPI } from '../services/api'

function Customers() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [formData, setFormData] = useState({
        code: '', name: '', phone: '', phone_alt: '', email: '', address: '', city: '', credit_limit: '0'
    })

    useEffect(() => { loadData() }, [search])

    const loadData = async () => {
        try {
            const response = await customersAPI.list({ search, limit: 100 })
            setCustomers(response.data)
        } catch (error) {
            toast.error('Failed to load customers')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingCustomer) {
                await customersAPI.update(editingCustomer.id, formData)
                toast.success('Customer updated')
            } else {
                await customersAPI.create(formData)
                toast.success('Customer created')
            }
            setShowModal(false)
            resetForm()
            loadData()
        } catch (error) {
            toast.error(error.message)
        }
    }

    const resetForm = () => {
        setFormData({ code: '', name: '', phone: '', phone_alt: '', email: '', address: '', city: '', credit_limit: '0' })
        setEditingCustomer(null)
    }

    const openEditModal = (customer) => {
        setEditingCustomer(customer)
        setFormData({
            code: customer.code || '', name: customer.name, phone: customer.phone || '',
            phone_alt: customer.phone_alt || '', email: customer.email || '',
            address: customer.address || '', city: customer.city || '', credit_limit: customer.credit_limit || '0'
        })
        setShowModal(true)
    }

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Customers</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>+ Add Customer</button>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input type="text" className="form-input" placeholder="Search by name or phone..."
                    value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: '400px' }} />
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Code</th><th>Name</th><th>Phone</th><th>City</th><th style={{ textAlign: 'right' }}>Credit Limit</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c.id}>
                                    <td className="font-mono">{c.code || '-'}</td>
                                    <td>{c.name}</td>
                                    <td>{c.phone || '-'}</td>
                                    <td>{c.city || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>Rs. {Number(c.credit_limit).toLocaleString()}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(c)}>Edit</button>
                                            <Link to={`/customers/${c.id}/ledger`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>📄 Ledger</Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group"><label className="form-label">Code</label>
                                    <input type="text" className="form-input" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Name *</label>
                                    <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                            </div>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group"><label className="form-label">Phone</label>
                                    <input type="text" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Alt Phone</label>
                                    <input type="text" className="form-input" value={formData.phone_alt} onChange={(e) => setFormData({ ...formData, phone_alt: e.target.value })} /></div>
                            </div>
                            <div className="form-group"><label className="form-label">Email</label>
                                <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Address</label>
                                <textarea className="form-textarea" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows="2" /></div>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group"><label className="form-label">City</label>
                                    <input type="text" className="form-input" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Credit Limit</label>
                                    <input type="number" className="form-input" value={formData.credit_limit} onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })} /></div>
                            </div>
                            <div className="flex gap-4" style={{ marginTop: 'var(--space-6)' }}>
                                <button type="submit" className="btn btn-primary">Save</button>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{`.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000}.modal{background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-6);width:100%;max-width:600px}.modal h2{margin-bottom:var(--space-6)}.btn-sm{padding:var(--space-1) var(--space-2);font-size:0.75rem}.form-textarea{width:100%;padding:var(--space-2);background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-text-primary)}`}</style>
        </div>
    )
}
export default Customers
