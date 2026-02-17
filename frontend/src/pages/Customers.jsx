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
        code: '', name: '', phone_number: '', phone_number_alt: '', email: '',
        address_line1: '', city: '', province_state: '', country: 'Pakistan',
        credit_limit: '0', opening_balance: '0'
    })

    useEffect(() => { loadData() }, [search])

    const loadData = async () => {
        try {
            const response = await customersAPI.list({ search, limit: 100 })
            setCustomers(response.data || [])
        } catch (error) {
            toast.error('Failed to load customers')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = {
                ...formData,
                credit_limit: parseFloat(formData.credit_limit),
                opening_balance: parseFloat(formData.opening_balance)
            }
            if (editingCustomer) {
                await customersAPI.update(editingCustomer.id, data)
                toast.success('Customer updated')
            } else {
                await customersAPI.create(data)
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
        setFormData({
            code: '', name: '', phone_number: '', phone_number_alt: '', email: '',
            address_line1: '', city: '', province_state: '', country: 'Pakistan',
            credit_limit: '0', opening_balance: '0'
        })
        setEditingCustomer(null)
    }

    const openEditModal = (customer) => {
        setEditingCustomer(customer)
        setFormData({
            code: customer.code || '',
            name: customer.name,
            phone_number: customer.phone_number || '',
            phone_number_alt: customer.phone_number_alt || '',
            email: customer.email || '',
            address_line1: customer.address_line1 || '',
            city: customer.city || '',
            province_state: customer.province_state || '',
            country: customer.country || 'Pakistan',
            credit_limit: customer.credit_limit || '0',
            opening_balance: customer.opening_balance || '0'
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
                                    <td>{c.phone_number || '-'}</td>
                                    <td>{c.city || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>Rs. {Number(c.current_balance).toLocaleString()}</td>
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
                                    <input type="text" className="form-input" value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Alt Phone</label>
                                    <input type="text" className="form-input" value={formData.phone_number_alt} onChange={(e) => setFormData({ ...formData, phone_number_alt: e.target.value })} /></div>
                            </div>
                            <div className="form-group"><label className="form-label">Email</label>
                                <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Address</label>
                                <textarea className="form-input" value={formData.address_line1} onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })} rows="2" /></div>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group"><label className="form-label">City</label>
                                    <input type="text" className="form-input" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Province/State</label>
                                    <input type="text" className="form-input" value={formData.province_state} onChange={(e) => setFormData({ ...formData, province_state: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group"><label className="form-label">Credit Limit</label>
                                    <input type="number" className="form-input" value={formData.credit_limit} onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })} /></div>
                                {!editingCustomer && (
                                    <div className="form-group"><label className="form-label">Opening Balance</label>
                                        <input type="number" className="form-input" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })} /></div>
                                )}
                            </div>
                            <div className="flex gap-4" style={{ marginTop: 'var(--space-6)' }}>
                                <button type="submit" className="btn btn-primary">Save</button>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
export default Customers
