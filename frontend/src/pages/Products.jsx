import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, categoriesAPI, suppliersAPI, unitsAPI } from '../services/api'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'

function Products() {
    const [view, setView] = useState('list') // 'list' or 'form'
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [units, setUnits] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editingProduct, setEditingProduct] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '', // SKU
        barcode: '',
        description: '',
        category_id: '',
        unit_id: '',
        cost_price: '',
        retail_price: '',
        wholesale_price: '',
        tax_rate: '0',
        min_stock_level: '0',
        reorder_quantity: '0',
        weight: '',
        dimensions: '',
        track_stock: true,
        is_active: true,
        opening_stock: '0'
    })

    const [formErrors, setFormErrors] = useState({})

    useEffect(() => {
        loadData()
    }, [search])
    
    // Subscribe to data sync events to refresh stock levels when sales/purchases change
    useDataSync(DataSyncEvents.SALE_CREATED, () => {
        loadData()
    })
    
    useDataSync(DataSyncEvents.PURCHASE_CREATED, () => {
        loadData()
    })

    const loadData = async () => {
        try {
            const [productsRes, categoriesRes, unitsRes] = await Promise.all([
                productsAPI.list({ search, limit: 100 }),
                categoriesAPI.list(),
                unitsAPI.list()
            ])
            setProducts(productsRes.data || [])
            setCategories(categoriesRes.data || [])
            setUnits(unitsRes.data || [])
        } catch (error) {
            console.error(error)
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const validateForm = async () => {
        const errors = {}
        if (!formData.name) errors.name = 'Product name is required'
        if (!formData.code) errors.code = 'SKU is required'
        if (!formData.category_id) errors.category_id = 'Category is required'
        if (!formData.unit_id) errors.unit_id = 'Unit is required'
        if (!formData.cost_price) errors.cost_price = 'Cost price is required'
        if (!formData.retail_price) errors.retail_price = 'Retail price is required'

        if (formData.retail_price && formData.cost_price) {
            if (parseFloat(formData.retail_price) <= parseFloat(formData.cost_price)) {
                errors.retail_price = 'Retail price must be higher than cost price'
            }
        }

        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const isValid = await validateForm()
            if (!isValid) {
                toast.error('Please fix form errors')
                setSubmitting(false)
                return
            }

            const dataToSave = {
                ...formData,
                code: formData.code ? formData.code.toUpperCase() : '',
                cost_price: parseFloat(formData.cost_price),
                retail_price: parseFloat(formData.retail_price),
                wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
                tax_rate: parseFloat(formData.tax_rate),
                min_stock_level: parseInt(formData.min_stock_level),
                reorder_quantity: parseInt(formData.reorder_quantity),
                opening_stock: parseFloat(formData.opening_stock)
            }

            if (editingProduct) {
                await productsAPI.update(editingProduct.id, dataToSave)
                toast.success('Product updated successfully!')
            } else {
                await productsAPI.create(dataToSave)
                toast.success('Product created successfully!')
            }

            setView('list')
            resetForm()
            loadData()
            window.scrollTo(0, 0);
        } catch (error) {
            toast.error(error.message || 'Failed to save product')
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setFormData({
            name: '', code: '', barcode: '', description: '',
            category_id: '', unit_id: '', cost_price: '', retail_price: '',
            wholesale_price: '', tax_rate: '0', min_stock_level: '0',
            reorder_quantity: '0', weight: '', dimensions: '',
            track_stock: true, is_active: true, opening_stock: '0'
        })
        setEditingProduct(null)
        setFormErrors({})
        setIsDirty(false)
    }

    const openCreateView = () => {
        resetForm()
        setView('form')
        window.scrollTo(0, 0);
    }

    const openEditView = (product) => {
        setEditingProduct(product)
        setFormData({
            ...product,
            code: product.code || '',
            // Ensure numeric values are strings for inputs
            cost_price: product.cost_price?.toString() || '',
            retail_price: product.retail_price?.toString() || '',
            wholesale_price: product.wholesale_price?.toString() || '',
            tax_rate: product.tax_rate?.toString() || '0',
            min_stock_level: product.min_stock_level?.toString() || '0',
            reorder_quantity: product.reorder_quantity?.toString() || '0',
            weight: product.weight?.toString() || '',
            dimensions: product.dimensions || '',
            track_stock: product.track_stock,
            is_active: product.is_active,
            opening_stock: '0' // Not editable on update
        })
        setView('form')
        window.scrollTo(0, 0);
    }

    const handleCancel = () => {
        if (isDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                setView('list')
                resetForm()
            }
        } else {
            setView('list')
            resetForm()
        }
    }

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)
    }

    // Real-time Profit Calculations
    const profitData = useMemo(() => {
        const cost = parseFloat(formData.cost_price) || 0
        const retail = parseFloat(formData.retail_price) || 0
        const profit = retail - cost
        const margin = cost > 0 ? (profit / cost) * 100 : 0
        return {
            margin: margin.toFixed(2),
            profit: profit.toFixed(2),
            isInvalid: retail > 0 && cost > 0 && retail < cost
        }
    }, [formData.cost_price, formData.retail_price])

    if (loading && view === 'list') return <div className="page-container dark-theme">Loading...</div>

    if (view === 'form') {
        return (
            <div className="product-form-page">
                <div className="form-header">
                    <div className="header-left">
                        <button className="btn-back" onClick={handleCancel}>← Back to List</button>
                        <h1>{editingProduct ? 'Update Product Details' : 'Create New Product'}</h1>
                    </div>

                </div>

                <div className="form-container">
                    <form onSubmit={handleSubmit}>
                        {/* SECTION 1: BASIC INFORMATION */}
                        <div className="form-section">
                            <div className="section-header">
                                <span className="section-icon">📘</span>
                                <h2>Basic Information</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Product Name <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        className={formErrors.name ? 'error' : ''}
                                        value={formData.name}
                                        onChange={(e) => handleFormChange('name', e.target.value)}
                                        placeholder="Enter full product name"
                                        autoFocus
                                    />
                                    {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>SKU (Stock Keeping Unit) <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        className={`font-mono ${formErrors.code ? 'error' : ''}`}
                                        value={formData.code}
                                        onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())}
                                        placeholder="e.g. ELE-MSE-001"
                                    />
                                    {formErrors.code && <span className="error-text">{formErrors.code}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Barcode</label>
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={(e) => handleFormChange('barcode', e.target.value)}
                                        placeholder="Scan or enter barcode"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category <span className="required">*</span></label>
                                    <select
                                        className={formErrors.category_id ? 'error' : ''}
                                        value={formData.category_id}
                                        onChange={(e) => handleFormChange('category_id', e.target.value)}
                                    >
                                        <option value="">Select a Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {formErrors.category_id && <span className="error-text">{formErrors.category_id}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Base Unit <span className="required">*</span></label>
                                    <select
                                        className={formErrors.unit_id ? 'error' : ''}
                                        value={formData.unit_id}
                                        onChange={(e) => handleFormChange('unit_id', e.target.value)}
                                    >
                                        <option value="">Select a Unit</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                                    </select>
                                    {formErrors.unit_id && <span className="error-text">{formErrors.unit_id}</span>}
                                </div>
                                <div className="form-group full-width">
                                    <label>Description (Optional)</label>
                                    <textarea rows="3" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} placeholder="Enter brief product description..." />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <div className="radio-group">
                                        <label className="radio-label">
                                            <input type="radio" name="is_active" value="true" checked={formData.is_active === true} onChange={() => handleFormChange('is_active', true)} />
                                            Active
                                        </label>
                                        <label className="radio-label">
                                            <input type="radio" name="is_active" value="false" checked={formData.is_active === false} onChange={() => handleFormChange('is_active', false)} />
                                            Inactive
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Track Stock</label>
                                    <div className="radio-group">
                                        <label className="radio-label">
                                            <input type="radio" name="track_stock" value="true" checked={formData.track_stock === true} onChange={() => handleFormChange('track_stock', true)} />
                                            Yes
                                        </label>
                                        <label className="radio-label">
                                            <input type="radio" name="track_stock" value="false" checked={formData.track_stock === false} onChange={() => handleFormChange('track_stock', false)} />
                                            No
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: PRICING & PROFIT */}
                        <div className="form-section">
                            <div className="section-header">
                                <span className="section-icon">💰</span>
                                <h2>Pricing & Profit</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Cost Price (PKR) <span className="required">*</span></label>
                                    <input type="number" className={formErrors.cost_price ? 'error' : ''} value={formData.cost_price} onChange={(e) => handleFormChange('cost_price', e.target.value)} step="0.01" placeholder="0.00" />
                                    {formErrors.cost_price && <span className="error-text">{formErrors.cost_price}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Retail Price (PKR) <span className="required">*</span></label>
                                    <input type="number" className={(formErrors.retail_price || profitData.isInvalid) ? 'error' : ''} value={formData.retail_price} onChange={(e) => handleFormChange('retail_price', e.target.value)} step="0.01" placeholder="0.00" />
                                    {profitData.isInvalid && <span className="warning-text">Retail price must be higher than cost price</span>}
                                    {formErrors.retail_price && <span className="error-text">{formErrors.retail_price}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Wholesale Price (PKR)</label>
                                    <input type="number" value={formData.wholesale_price} onChange={(e) => handleFormChange('wholesale_price', e.target.value)} step="0.01" placeholder="0.00" />
                                </div>
                                <div className="form-group">
                                    <label>Tax Rate (%)</label>
                                    <input type="number" value={formData.tax_rate} onChange={(e) => handleFormChange('tax_rate', e.target.value)} step="0.1" placeholder="0" />
                                </div>
                            </div>

                            <div className="profit-summary-card">
                                <div className="profit-stat">
                                    <span className="stat-label">Estimated Profit per Unit:</span>
                                    <span className="stat-value">Rs. {profitData.profit}</span>
                                </div>
                                <div className="profit-stat border-l">
                                    <span className="stat-label">Profit Margin:</span>
                                    <span className={`stat-value ${parseFloat(profitData.margin) >= 0 ? 'success' : 'danger'}`}>
                                        {profitData.margin}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: PHYSICAL PROPERTIES */}
                        <div className="form-section">
                            <div className="section-header">
                                <span className="section-icon">⚖️</span>
                                <h2>Physical Properties</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Dimensions (LxWxH)</label>
                                    <input type="text" value={formData.dimensions} onChange={(e) => handleFormChange('dimensions', e.target.value)} placeholder="e.g. 10 x 5 x 2 cm" />
                                </div>
                                <div className="form-group">
                                    <label>Weight (kg)</label>
                                    <input type="number" value={formData.weight} onChange={(e) => handleFormChange('weight', e.target.value)} step="0.001" placeholder="0.0" />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 4: INVENTORY CONTROL */}
                        <div className="form-section last-section">
                            <div className="section-header">
                                <span className="section-icon">📉</span>
                                <h2>Inventory Control</h2>
                            </div>
                            <div className="form-grid">
                                {!editingProduct && (
                                    <div className="form-group">
                                        <label>Opening Stock Quantity</label>
                                        <input type="number" value={formData.opening_stock} onChange={(e) => handleFormChange('opening_stock', e.target.value)} placeholder="0" />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Minimum Stock Alert Level</label>
                                    <input type="number" value={formData.min_stock_level} onChange={(e) => handleFormChange('min_stock_level', e.target.value)} placeholder="5" />
                                </div>
                                <div className="form-group">
                                    <label>Reorder Quantity</label>
                                    <input type="number" value={formData.reorder_quantity} onChange={(e) => handleFormChange('reorder_quantity', e.target.value)} placeholder="10" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="form-footer-sticky">
                    <div className="footer-content">
                        <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={submitting}>Cancel</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={submitting || profitData.isInvalid}
                            title={profitData.isInvalid ? "Fix pricing to create product" : ""}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner"></span> {editingProduct ? 'Updating...' : 'Creating...'}
                                </>
                            ) : editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </div>

                <style>{`
                    .product-form-page {
                        background: #0f172a;
                        min-height: 100vh;
                        color: #e2e8f0;
                        display: flex;
                        flex-direction: column;
                    }
                    .form-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1.5rem 2.5rem;
                        background: #1e293b;
                        border-bottom: 2px solid #334155;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    }
                    .header-left { display: flex; align-items: center; gap: 1.5rem; }
                    .btn-back { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
                    .btn-back:hover { color: #fff; }
                    .form-header h1 { font-size: 1.25rem; margin: 0; font-weight: 700; color: #fff; }

                    .form-container {
                        max-width: 900px;
                        margin: 2rem auto;
                        width: 100%;
                        padding: 0 1.5rem 10rem 1.5rem;
                    }

                    .form-section {
                        background: #1e293b;
                        border: 1px solid #334155;
                        border-radius: 12px;
                        padding: 2.5rem;
                        margin-bottom: 4rem;
                    }
                    .last-section { margin-bottom: 2rem; }
                    
                    .section-header { 
                        display: flex; 
                        align-items: center; 
                        gap: 1rem; 
                        margin-bottom: 2.5rem; 
                        border-bottom: 1px solid #334155; 
                        padding-bottom: 1.5rem; 
                        margin-top: 0.5rem; 
                    }
                    .section-icon { font-size: 1.5rem; }
                    .section-header h2 { font-size: 1.4rem; font-weight: 600; margin: 0; color: #3b82f6; }

                    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                    .form-group { display: flex; flex-direction: column; gap: 0.75rem; }
                    .form-group.full-width { grid-column: 1 / -1; }
                    
                    label { font-size: 0.9rem; font-weight: 600; color: #94a3b8; }
                    .required { color: #f43f5e; margin-left: 2px; }

                    input, select, textarea {
                        background: #0f172a;
                        border: 1px solid #475569;
                        border-radius: 8px;
                        padding: 0.85rem 1.15rem;
                        color: #fff;
                        font-size: 0.95rem;
                        transition: all 0.2s;
                        width: 100%;
                    }
                    input:focus, select:focus, textarea:focus {
                        border-color: #3b82f6;
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                    }
                    input.error, select.error { border-color: #f43f5e; background: rgba(244, 63, 94, 0.05); }
                    .error-text { color: #f43f5e; font-size: 0.75rem; font-weight: 500; }
                    .warning-text { color: #f43f5e; font-size: 0.75rem; font-weight: 600; font-style: italic; margin-top: 2px; }

                    .radio-group { display: flex; gap: 3rem; padding: 0.75rem 0; }
                    .radio-label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; color: #e2e8f0; font-size: 1rem; }
                    .radio-label input { width: 1.25rem; height: 1.25rem; margin: 0; }

                    .profit-summary-card {
                        background: #1e293b;
                        border: 1px solid #334155;
                        border-radius: 12px;
                        margin-top: 2.5rem;
                        display: flex;
                        padding: 2rem;
                        gap: 2rem;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        background-image: linear-gradient(to right, #1e293b, #2a384e);
                    }
                    .profit-stat { display: flex; flex-direction: column; flex: 1; }
                    .stat-label { font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.75rem; font-weight: 500; }
                    .stat-value { font-size: 1.75rem; font-weight: 800; color: #fff; }
                    .stat-value.success { color: #10b981; }
                    .stat-value.danger { color: #ef4444; }
                    .border-l { border-left: 1px solid #334155; padding-left: 3rem; }

                    .input-group-merged { display: flex; align-items: stretch; }
                    .input-group-merged input { border-top-right-radius: 0; border-bottom-right-radius: 0; }
                    .input-group-merged select { width: 110px; border-left: none; border-top-left-radius: 0; border-bottom-left-radius: 0; background: #0f172a; }

                    .stock-note { font-size: 0.85rem; color: #94a3b8; margin-top: 1.5rem; font-style: italic; }

                    .form-footer-sticky {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: #1e293b;
                        border-top: 2px solid #334155;
                        padding: 1.5rem 2.5rem;
                        box-shadow: 0 -4px 10px rgba(0,0,0,0.3);
                        z-index: 100;
                    }
                    .footer-content { max-width: 900px; margin: 0 auto; display: flex; justify-content: flex-end; gap: 1.5rem; }

                    .btn {
                        padding: 1rem 3rem;
                        border-radius: 10px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.2s;
                        border: none;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 1rem;
                    }
                    .btn-primary { background: #3b82f6; color: #fff; }
                    .btn-primary:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
                    .btn-primary:disabled { background: #475569; cursor: not-allowed; opacity: 0.6; }
                    .btn-ghost { background: transparent; color: #94a3b8; border: 1px solid #475569; }
                    .btn-ghost:hover { background: #334155; color: #fff; }

                    .spinner {
                        width: 18px;
                        height: 18px;
                        border: 3px solid rgba(255,255,255,0.3);
                        border-top-color: #fff;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }

                    @media (max-width: 768px) {
                        .form-grid { grid-template-columns: 1fr; }
                        .profit-summary-card { flex-direction: column; gap: 2rem; }
                        .border-l { border-left: none; padding-left: 0; border-top: 1px solid #334155; padding-top: 2rem; }
                        .form-header { padding: 1.25rem; }
                        .form-footer-sticky { padding: 1.25rem; }
                    }
                `}</style>
            </div>
        )
    }

    return (
        <div className="page-container dark-theme">
            <div className="page-header">
                <h1 className="page-title">📦 Product Management</h1>
                <button className="btn btn-primary" onClick={openCreateView}>
                    + Create New Product
                </button>
            </div>

            <div className="card search-card">
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Search by name, SKU, or barcode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />
            </div>

            <div className="card table-card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Product Name</th>
                                <th>Category</th>
                                <th style={{ textAlign: 'right' }}>Cost</th>
                                <th style={{ textAlign: 'right' }}>Retail</th>
                                <th style={{ textAlign: 'right' }}>Margin</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: 'var(--space-8)', color: '#94a3b8' }}>
                                        No products found. Start by adding one!
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id}>
                                        <td className="font-mono" style={{ fontWeight: 'bold', color: '#3b82f6' }}>{product.code}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{product.barcode}</div>
                                        </td>
                                        <td>{product.category_name || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>₹ {Number(product.cost_price).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                                            ₹ {Number(product.retail_price).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{
                                                color: ((product.retail_price - product.cost_price) / product.cost_price * 100) >= 0 ? '#10b981' : '#ef4444',
                                                fontWeight: 'bold'
                                            }}>
                                                {((product.retail_price - product.cost_price) / product.cost_price * 100).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${product.is_active ? 'success' : 'danger'}`}>
                                                {product.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className={product.current_stock < product.min_stock_level ? 'text-danger font-bold' : ''}>
                                                {product.current_stock ?? '0'} {product.unit_abbr}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn-edit" onClick={() => openEditView(product)}>Edit</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .dark-theme { background: #0f172a; min-height: 100vh; color: #e2e8f0; }
                .search-card { background: #1e293b; border: 1px solid #334155; margin-bottom: 24px; padding: 20px; }
                .table-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
                .table thead th { background: #334155!important; color: #94a3b8!important; font-weight: 600!important; padding: 16px!important; border: none!important; }
                .table tbody td { padding: 16px!important; border-bottom: 1px solid #334155!important; color: #e2e8f0!important; }
                .table tbody tr:hover { background: rgba(59, 130, 246, 0.05)!important; }
                .btn-edit { background: none; border: 1px solid #334155; color: #3b82f6; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
                .btn-edit:hover { background: #3b82f6; color: #fff; }
                .badge-success { background: rgba(16, 185, 129, 0.2)!important; color: #10b981!important; }
                .badge-danger { background: rgba(239, 68, 68, 0.2)!important; color: #ef4444!important; }
                .text-danger { color: #ef4444!important; }
                .font-bold { font-weight: 700!important; }
                .mb-0 { margin-bottom: 0!important; }
                .flex { display: flex; }
                .items-center { align-items: center; }
                .gap-2 { gap: 0.5rem; }
            `}</style>
        </div>
    )
}

export default Products
