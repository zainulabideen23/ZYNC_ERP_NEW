
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { expensesAPI, accountsAPI } from '../services/api'
import { format } from 'date-fns'
import './Expenses.css'

function Expenses() {
    const [expenses, setExpenses] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [dateRange, setDateRange] = useState({
        from: format(new Date(), 'yyyy-MM-01'),
        to: format(new Date(), 'yyyy-MM-dd')
    })

    const [formData, setFormData] = useState({
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        category_id: '',
        amount: '',
        payment_method: 'cash',
        description: ''
    })

    const [categoryName, setCategoryName] = useState('')

    useEffect(() => {
        loadData()
    }, [dateRange])

    const loadData = async () => {
        setLoading(true)
        try {
            const [data, cats] = await Promise.all([
                expensesAPI.list({ from_date: dateRange.from, to_date: dateRange.to }),
                expensesAPI.getCategories()
            ])
            setExpenses(data.data)
            setCategories(cats.data)
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await expensesAPI.create(formData)
            toast.success('Expense recorded')
            setShowModal(false)
            setFormData({ ...formData, amount: '', description: '' })
            loadData()
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleCreateCategory = async (e) => {
        e.preventDefault()
        if (!categoryName) return
        try {
            await expensesAPI.createCategory({ name: categoryName })
            toast.success('Category created')
            const cats = await expensesAPI.getCategories()
            setCategories(cats.data)
            setShowCategoryModal(false)
            setCategoryName('')
        } catch (error) {
            toast.error(error.message)
        }
    }

    const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0)

    return (
        <div className="expenses-page">
            <header className="page-header">
                <div>
                    <h1>Expense Management</h1>
                    <p className="text-secondary">Track business expenses</p>
                </div>
                <div className="header-actions">
                    <div className="date-filters">
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            className="form-control"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            className="form-control"
                        />
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        + New Expense
                    </button>
                </div>
            </header>

            <div className="stats-cards">
                <div className="card">
                    <h3>
                        <span>💸</span> Total Expenses
                    </h3>
                    <div className="stat-value">Rs. {totalAmount.toLocaleString()}</div>
                    <div className="stat-label">
                        {format(new Date(dateRange.from), 'MMM d')} - {format(new Date(dateRange.to), 'MMM d, yyyy')}
                    </div>
                </div>
            </div>

            <div className="card mt-4">
                {loading ? <div className="p-4 text-center">Loading...</div> : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Number</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Payment</th>
                                <th className="text-right">Amount</th>
                                <th>Recorded By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.length === 0 ? (
                                <tr><td colSpan="7" className="text-center p-4">No expenses found for this period</td></tr>
                            ) : (
                                expenses.map(expense => (
                                    <tr key={expense.id}>
                                        <td>{format(new Date(expense.expense_date), 'dd MMM yyyy')}</td>
                                        <td>{expense.expense_number}</td>
                                        <td><span className="badge badge-secondary">{expense.category_name}</span></td>
                                        <td>{expense.description}</td>
                                        <td>{expense.payment_method}</td>
                                        <td className="text-right font-bold">Rs. {parseFloat(expense.amount).toLocaleString()}</td>
                                        <td>{expense.created_by_name}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Expense Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Record Expense</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={formData.expense_date}
                                        onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category <small className="text-accent cursor-pointer" onClick={() => setShowCategoryModal(true)}>(+ Add New)</small></label>
                                    <select
                                        className="form-control"
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Amount (Rs)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        min="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Payment Method</label>
                                    <select
                                        className="form-control"
                                        value={formData.payment_method}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="bank">Bank Transfer</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                                <div className="form-group full-width">
                                    <label>Description (Optional)</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    ></textarea>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Expense</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Category Modal */}
            {showCategoryModal && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3>Add Expense Category</h3>
                            <button className="close-btn" onClick={() => setShowCategoryModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateCategory}>
                            <div className="form-group">
                                <label>Category Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCategoryModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Expenses
