import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, categoriesAPI, companiesAPI } from '../services/api'

function Products() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [formData, setFormData] = useState({
        code: '', name: '', barcode: '', category_id: '', company_id: '',
        retail_price: '', wholesale_price: '', cost_price: '', min_stock_level: '0', opening_stock: ''
    })

    useEffect(() => {
        loadData()
    }, [search])

    const loadData = async () => {
        try {
            const [productsRes, categoriesRes, companiesRes] = await Promise.all([
                productsAPI.list({ search, limit: 100 }),
                categoriesAPI.list(),
                companiesAPI.list()
            ])
            setProducts(productsRes.data)
            setCategories(categoriesRes.data)
            setCompanies(companiesRes.data)
        } catch (error) {
            toast.error('Failed to load products')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingProduct) {
                await productsAPI.update(editingProduct.id, formData)
                toast.success('Product updated')
            } else {
                await productsAPI.create(formData)
                toast.success('Product created')
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
            code: '', name: '', barcode: '', category_id: '', company_id: '',
            retail_price: '', wholesale_price: '', cost_price: '', min_stock_level: '0', opening_stock: ''
        })
        setEditingProduct(null)
    }

    const openEditModal = (product) => {
        setEditingProduct(product)
        setFormData({
            code: product.code,
            name: product.name,
            barcode: product.barcode || '',
            category_id: product.category_id || '',
            company_id: product.company_id || '',
            retail_price: product.retail_price,
            wholesale_price: product.wholesale_price || '',
            cost_price: product.cost_price || '',
            min_stock_level: product.min_stock_level || '0'
        })
        setShowModal(true)
    }

    const formatCurrency = (value) => {
        if (!value) return '-'
        return `Rs. ${Number(value).toLocaleString()}`
    }

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Products</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
                    + Add Product
                </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Search products by name, code, or barcode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />
            </div>

            {/* Products Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Company</th>
                                <th style={{ textAlign: 'right' }}>Retail Price</th>
                                <th style={{ textAlign: 'right' }}>Cost</th>
                                <th style={{ textAlign: 'right' }}>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id}>
                                    <td className="font-mono">{product.code}</td>
                                    <td>{product.name}</td>
                                    <td>{product.category_name || '-'}</td>
                                    <td>{product.company_name || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(product.retail_price)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(product.cost_price)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className={product.current_stock < product.min_stock_level ? 'badge badge-danger' : ''}>
                                            {product.current_stock ? Math.round(product.current_stock) : '-'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(product)}>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Code *</label>
                                    <input type="text" className="form-input" value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Barcode</label>
                                    <input type="text" className="form-input" value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Name *</label>
                                <input type="text" className="form-input" value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select className="form-select" value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}>
                                        <option value="">Select category</option>
                                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Company/Brand</label>
                                    <select className="form-select" value={formData.company_id}
                                        onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}>
                                        <option value="">Select company</option>
                                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-3" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Retail Price *</label>
                                    <input type="number" className="form-input" value={formData.retail_price}
                                        onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Wholesale Price</label>
                                    <input type="number" className="form-input" value={formData.wholesale_price}
                                        onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cost Price</label>
                                    <input type="number" className="form-input" value={formData.cost_price}
                                        onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Min Stock Level</label>
                                <input type="number" className="form-input" value={formData.min_stock_level}
                                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })} />
                            </div>

                            {!editingProduct && (
                                <div className="form-group">
                                    <label className="form-label">Opening Stock</label>
                                    <input type="number" className="form-input" value={formData.opening_stock}
                                        onChange={(e) => setFormData({ ...formData, opening_stock: e.target.value })}
                                        placeholder="0" />
                                </div>
                            )}
                            <div className="flex gap-4" style={{ marginTop: 'var(--space-6)' }}>
                                <button type="submit" className="btn btn-primary">Save</button>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal h2 {
          margin-bottom: var(--space-6);
        }
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .btn-sm { padding: var(--space-1) var(--space-2); font-size: 0.75rem; }
      `}</style>
        </div>
    )
}

export default Products
