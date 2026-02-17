import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { usersAPI } from '../services/api'
import { useAuthStore } from '../store/auth.store'

function Users() {
    const { user: currentUser } = useAuthStore()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [formData, setFormData] = useState({
        username: '', password: '', full_name: '', email: '', phone: '', role: 'cashier', is_active: true
    })
    const [passwordData, setPasswordData] = useState({ id: null, newPassword: '' })

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        try {
            const response = await usersAPI.list()
            setUsers(response.data)
        } catch (error) {
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingUser) {
                await usersAPI.update(editingUser.id, formData)
                toast.success('User updated successfully')
            } else {
                await usersAPI.create(formData)
                toast.success('User created successfully')
            }
            setShowModal(false)
            resetForm()
            loadUsers()
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handlePasswordReset = async (e) => {
        e.preventDefault()
        try {
            await usersAPI.resetPassword(passwordData.id, passwordData.newPassword)
            toast.success('Password reset successfully')
            setShowPasswordModal(false)
            setPasswordData({ id: null, newPassword: '' })
        } catch (error) {
            toast.error(error.message)
        }
    }

    const openEditModal = (user) => {
        setEditingUser(user)
        setFormData({
            username: user.username,
            full_name: user.full_name,
            email: user.email || '',
            phone: user.phone || '',
            role: user.role,
            is_active: user.is_active,
            password: '' // Only for create
        })
        setShowModal(true)
    }

    const openPasswordModal = (user) => {
        setPasswordData({ id: user.id, newPassword: '' })
        setShowPasswordModal(true)
    }

    const resetForm = () => {
        setFormData({ username: '', password: '', full_name: '', email: '', phone: '', role: 'cashier', is_active: true })
        setEditingUser(null)
    }

    if (loading) return <div className="page-container"><div className="empty-state">Loading...</div></div>

    if (currentUser?.role !== 'admin') {
        return <div className="page-container"><div className="card text-center text-danger">Access Denied: Admin privileges required.</div></div>
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">User Management</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }} aria-label="Add new user">
                    + Add User
                </button>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="table-checkbox"><input type="checkbox" aria-label="Select all users" /></th>
                                <th>Username</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.6 }}>
                                    <td className="table-checkbox"><input type="checkbox" aria-label={`Select ${user.username}`} /></td>
                                    <td className="font-mono">{user.username}</td>
                                    <td>
                                        {user.full_name}
                                        <div className="text-xs text-muted">{user.email}</div>
                                    </td>
                                    <td>
                                        <span className={`badge ${user.role === 'admin' ? 'badge-accent' : user.role === 'manager' ? 'badge-secondary' : 'badge-ghost'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="text-xs text-muted">
                                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(user)} aria-label={`Edit ${user.username}`}>
                                                ✏️ Edit
                                            </button>
                                            <button className="btn btn-ghost btn-sm text-warning" onClick={() => openPasswordModal(user)} aria-label={`Reset password for ${user.username}`}>
                                                🔑 Reset Password
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Username *</label>
                                    <input type="text" className="form-input" value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        disabled={!!editingUser}
                                        required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input type="text" className="form-input" value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                                </div>
                            </div>

                            {!editingUser && (
                                <div className="form-group">
                                    <label className="form-label">Password *</label>
                                    <input type="password" className="form-input" value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                                </div>
                            )}

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input type="email" className="form-input" value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input type="text" className="form-input" value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-select" value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="cashier">Cashier</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                {editingUser && (
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-select" value={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}>
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Password Reset Modal */}
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <h2>Reset Password</h2>
                        <form onSubmit={handlePasswordReset}>
                            <div className="form-group">
                                <label className="form-label">New Password *</label>
                                <input type="password" className="form-input" value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    minLength={6} required />
                                <small className="text-muted">Must be at least 6 characters</small>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-warning">Reset Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Users
