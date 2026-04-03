import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, categoriesAPI, suppliersAPI, unitsAPI, brandsAPI } from '../services/api'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'
import { useAuthStore } from '../store/auth.store'
import { can } from '../utils/permissions'
import UnitSelector from '../components/UnitSelector'
import CategorySelector from '../components/CategorySelector'
import { Package, Plus, Search, X, Edit, FileText, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react'

function Products() {
    const { user } = useAuthStore()
    const userRole = user?.role || 'cashier'
    const [view, setView] = useState('list')
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [units, setUnits] = useState([])
    const [brands, setBrands] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editingProduct, setEditingProduct] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    const [formData, setFormData] = useState({
        name: '', code: '', barcode: '', description: '',
        category_id: '', unit_id: '', brand_id: '',
        cost_price: '', retail_price: '', wholesale_price: '',
        tax_rate: '0', min_stock_level: '0', reorder_quantity: '0',
        weight: '', dimensions: '', track_stock: true, is_active: true, opening_stock: '0'
    })

    const [formErrors, setFormErrors] = useState({})

    useEffect(() => { loadData() }, [search])
    useDataSync(DataSyncEvents.SALE_CREATED, () => { loadData() })
    useDataSync(DataSyncEvents.PURCHASE_CREATED, () => { loadData() })

    const loadData = async () => {
        try {
            const [productsRes, categoriesRes, unitsRes, brandsRes] = await Promise.all([
                productsAPI.list({ search, limit: 100 }),
                categoriesAPI.list(),
                unitsAPI.list(),
                brandsAPI.list()
            ])
            setProducts(productsRes.data || [])
            setCategories(categoriesRes.data || [])
            setUnits(unitsRes.data || [])
            setBrands(brandsRes.data || [])
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
            window.scrollTo(0, 0)
        } catch (error) {
            toast.error(error.message || 'Failed to save product')
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setFormData({
            name: '', code: '', barcode: '', description: '',
            category_id: '', unit_id: '', brand_id: '', cost_price: '', retail_price: '',
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
        window.scrollTo(0, 0)
    }

    const openEditView = (product) => {
        setEditingProduct(product)
        setFormData({
            ...product,
            code: product.code || '',
            brand_id: product.brand_id || '',
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
            opening_stock: '0'
        })
        setView('form')
        window.scrollTo(0, 0)
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

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const StatusBadge = ({ isActive }) => (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '6px',
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em',
            backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isActive ? '#10b981' : '#ef4444'
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#10b981' : '#ef4444' }} />
            {isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
    )

    const MetricCard = ({ label, value, icon: Icon, color, subtext, trend }) => (
        <div style={{
            background: 'var(--color-panel)',
            border: '1px solid var(--border-surface)',
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            minWidth: 0,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.borderColor = color + '40'
            e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-surface)'
            e.currentTarget.style.transform = 'translateY(0)'
        }}
        >
            <div style={{
                position: 'absolute', top: '-20px', right: '-20px',
                width: '100px', height: '100px', borderRadius: '50%',
                background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', position: 'relative' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{subtext}</span>
                {trend !== undefined && (
                    <span style={{ fontSize: '11px', fontWeight: 500, color: trend >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
        </div>
    )

    const aggregates = useMemo(() => {
        return products.reduce((acc, p) => {
            acc.totalProducts += 1
            acc.lowStock += (p.current_stock ?? 0) < p.min_stock_level ? 1 : 0
            acc.totalValue += (p.current_stock ?? 0) * (p.retail_price || 0)
            return acc
        }, { totalProducts: 0, lowStock: 0, totalValue: 0 })
    }, [products])

    if (loading && view === 'list') return <div style={{ padding: '24px', background: 'var(--color-bg)', minHeight: '100vh' }}>Loading...</div>

    if (view === 'form') {
        return (
            <div className="product-form-page">
                <div className="form-header">
                    <div className="header-left">
                        <button className="btn-back" onClick={handleCancel}>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Back to List
                        </button>
                        <h1>{editingProduct ? 'Update Product Details' : 'Create New Product'}</h1>
                    </div>
                </div>

                <div className="form-container">
                    <form onSubmit={handleSubmit}>
                        <div className="form-section">
                            <div className="section-header">
                                <span className="section-icon">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="#3b82f6" strokeWidth="2"/><path d="M7 10H13M10 7V13" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/></svg>
                                </span>
                                <h2>Basic Information</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Product Name <span className="required">*</span></label>
                                    <input type="text" className={formErrors.name ? 'error' : ''} value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} placeholder="Enter full product name" autoFocus />
                                    {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>SKU (Stock Keeping Unit) <span className="required">*</span></label>
                                    <input type="text" className={`font-mono ${formErrors.code ? 'error' : ''}`} value={formData.code} onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())} placeholder="e.g. ELE-MSE-001" />
                                    {formErrors.code && <span className="error-text">{formErrors.code}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Barcode</label>
                                    <input type="text" value={formData.barcode} onChange={(e) => handleFormChange('barcode', e.target.value)} placeholder="Scan or enter barcode" />
                                </div>
                                <div className="form-group">
                                    <label>Category <span className="required">*</span></label>
                                    <CategorySelector value={formData.category_id} onChange={(val) => handleFormChange('category_id', val)} categories={categories} onCategoriesChange={setCategories} error={formErrors.category_id} />
                                </div>
                                <div className="form-group">
                                    <label>Brand</label>
                                    <select value={formData.brand_id} onChange={(e) => handleFormChange('brand_id', e.target.value)}>
                                        <option value="">No Brand</option>
                                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Base Unit <span className="required">*</span></label>
                                    <UnitSelector value={formData.unit_id} onChange={(val) => handleFormChange('unit_id', val)} units={units} onUnitsChange={setUnits} error={formErrors.unit_id} />
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

                        <div className="form-section">
                            <div className="section-header">
                                <span className="section-icon">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2V18M2 10H18" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/><circle cx="10" cy="10" r="7" stroke="#10b981" strokeWidth="2"/></svg>
                                </span>
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

                        <div className="form-section">
                            <div className="section-header">
                                <span className="section-icon">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 7V18H17V7L10 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round"/><path d="M7 18V12H13V18" stroke="#8b5cf6" strokeWidth="2"/></svg>
                                </span>
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

                        <div className="form-section last-section">
                            <div className="section-header">
                                <span className="section-icon">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10H17M3 5H17M3 15H17" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/><rect x="2" y="2" width="16" height="16" rx="2" stroke="#f59e0b" strokeWidth="2"/></svg>
                                </span>
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
                        <button type="submit" className="btn btn-primary" onClick={handleSubmit} disabled={submitting || profitData.isInvalid} title={profitData.isInvalid ? "Fix pricing to create product" : ""}>
                            {submitting ? <><span className="spinner"></span> {editingProduct ? 'Updating...' : 'Creating...'}</> : editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </div>

                <style>{`
                    .product-form-page { background: var(--color-bg); min-height: 100vh; color: var(--color-text); }
                    .form-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2.5rem; background: var(--color-panel); border-bottom: 2px solid var(--border-surface); position: sticky; top: 0; z-index: 100; }
                    .header-left { display: flex; align-items: center; gap: 1.5rem; }
                    .btn-back { background: none; border: none; color: var(--color-muted); cursor: pointer; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 6px; }
                    .btn-back:hover { color: var(--color-text); }
                    .form-header h1 { font-size: 1.25rem; margin: 0; font-weight: 700; color: var(--color-text); }
                    .form-container { max-width: 900px; margin: 2rem auto; width: 100%; padding: 0 1.5rem 10rem 1.5rem; }
                    .form-section { background: var(--color-panel); border: 1px solid var(--border-surface); border-radius: 12px; padding: 2.5rem; margin-bottom: 2rem; }
                    .last-section { margin-bottom: 2rem; }
                    .section-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border-surface); padding-bottom: 1rem; }
                    .section-header h2 { font-size: 1rem; font-weight: 600; margin: 0; color: var(--blue); }
                    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                    .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                    .form-group.full-width { grid-column: 1 / -1; }
                    label { font-size: 0.85rem; font-weight: 500; color: var(--color-muted); }
                    .required { color: #ef4444; margin-left: 2px; }
                    input, select, textarea { background: var(--color-panel-2); border: 1px solid var(--border-surface); border-radius: 8px; padding: 0.75rem 1rem; color: var(--color-text); font-size: 0.9rem; transition: all 0.2s; width: 100%; }
                    input:focus, select:focus, textarea:focus { border-color: var(--blue); outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
                    input.error, select.error { border-color: #ef4444; }
                    .error-text { color: #ef4444; font-size: 0.75rem; font-weight: 500; }
                    .warning-text { color: #ef4444; font-size: 0.75rem; font-weight: 600; font-style: italic; margin-top: 4px; }
                    .radio-group { display: flex; gap: 2rem; padding: 0.5rem 0; }
                    .radio-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--color-text); font-size: 0.9rem; }
                    .radio-label input { width: 1rem; height: 1rem; margin: 0; }
                    .profit-summary-card { background: var(--color-panel-2); border: 1px solid var(--border-surface); border-radius: 12px; margin-top: 2rem; display: flex; padding: 1.5rem; gap: 2rem; }
                    .profit-stat { display: flex; flex-direction: column; flex: 1; }
                    .stat-label { font-size: 0.85rem; color: var(--color-muted); margin-bottom: 0.5rem; }
                    .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--color-text); }
                    .stat-value.success { color: #10b981; }
                    .stat-value.danger { color: #ef4444; }
                    .border-l { border-left: 1px solid var(--border-surface); padding-left: 2rem; }
                    .form-footer-sticky { position: fixed; bottom: 0; left: 0; right: 0; background: var(--color-panel); border-top: 1px solid var(--border-surface); padding: 1rem 2.5rem; z-index: 100; }
                    .footer-content { max-width: 900px; margin: 0 auto; display: flex; justify-content: flex-end; gap: 1rem; }
                    .btn { padding: 0.75rem 2rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
                    .btn-primary { background: var(--blue); color: #fff; }
                    .btn-primary:hover:not(:disabled) { background: #2563eb; }
                    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                    .btn-ghost { background: transparent; color: var(--color-muted); border: 1px solid var(--border-surface); }
                    .btn-ghost:hover { background: var(--color-panel-2); color: var(--color-text); }
                    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } .profit-summary-card { flex-direction: column; gap: 1rem; } .border-l { border-left: none; padding-left: 0; border-top: 1px solid var(--border-surface); padding-top: 1rem; } }
                `}</style>
            </div>
        )
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color="var(--blue)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Products</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Manage your product catalog and inventory</p>
                    </div>
                </div>
                <button onClick={openCreateView} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}>
                    <Plus size={16} />
                    Add Product
                </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard label="Total Products" value={aggregates.totalProducts} icon={Package} color="#3b82f6" subtext="In catalog" />
                <MetricCard label="Inventory Value" value={formatCurrency(aggregates.totalValue)} icon={TrendingUp} color="#10b981" subtext="At retail" />
                <MetricCard label="Low Stock" value={aggregates.lowStock} icon={AlertTriangle} color="#f59e0b" subtext="Need reorder" />
            </div>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-panel)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-surface)' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                    <input type="text" placeholder="Search by name, SKU, or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                </div>
            </div>

            {/* Table */}
            <div style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                            {can(userRole, 'products.view_cost_price') && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost</th>}
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retail</th>
                            {can(userRole, 'products.view_cost_price') && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margin</th>}
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock</th>
                            {can(userRole, 'products.edit') && <th style={{ width: '80px', padding: '12px 16px' }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && products.length === 0 ? (
                            <>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '28px', height: '28px', background: 'var(--color-panel-2)', borderRadius: '6px' }} /><div style={{ width: '120px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></div></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '70px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '80px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '50px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '60px', height: '24px', background: 'var(--color-panel-2)', borderRadius: '6px' }} /></td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: '50px', height: '14px', background: 'var(--color-panel-2)', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                                        <td style={{ padding: '14px 16px' }}><div style={{ width: '60px', height: '30px', background: 'var(--color-panel-2)', borderRadius: '6px', marginLeft: 'auto' }} /></td>
                                    </tr>
                                ))}
                            </>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={can(userRole, 'products.view_cost_price') ? 9 : 7} style={{ padding: '80px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Package size={24} color="var(--color-hint)" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-dim)', margin: '0 0 4px 0' }}>No products found</p>
                                            <p style={{ fontSize: '13px', color: 'var(--color-hint)', margin: 0 }}>Start by adding your first product</p>
                                        </div>
                                        <button onClick={openCreateView} style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Plus size={14} /> Add Product
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : products.map((product, index) => {
                            const margin = product.cost_price > 0 ? ((product.retail_price - product.cost_price) / product.cost_price * 100) : 0
                            const isLowStock = (product.current_stock ?? 0) < product.min_stock_level
                            return (
                                <tr key={product.id} style={{ borderBottom: index < products.length - 1 ? '1px solid var(--border-light)' : 'none', background: 'var(--color-panel)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-panel)'}>
                                    <td style={{ padding: '14px 16px' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                                            {product.code}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{product.name}</div>
                                        {product.barcode && <div style={{ fontSize: '11px', color: 'var(--color-hint)', marginTop: '2px' }}>{product.barcode}</div>}
                                    </td>
                                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-dim)' }}>{product.category_name || '-'}</td>
                                    {can(userRole, 'products.view_cost_price') && (
                                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: 'var(--color-text-dim)' }}>{formatCurrency(product.cost_price)}</td>
                                    )}
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(product.retail_price)}</td>
                                    {can(userRole, 'products.view_cost_price') && (
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: margin >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                {margin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {margin.toFixed(1)}%
                                            </span>
                                        </td>
                                    )}
                                    <td style={{ padding: '14px 16px' }}><StatusBadge isActive={product.is_active} /></td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <span style={{ fontSize: '13px', fontWeight: isLowStock ? 600 : 400, color: isLowStock ? '#ef4444' : 'var(--color-text)' }}>
                                            {product.current_stock ?? 0} {product.unit_abbr}
                                        </span>
                                    </td>
                                    {can(userRole, 'products.edit') && (
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <button onClick={() => openEditView(product)} style={{ minWidth: '44px', height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }} aria-label={`Edit ${product.name}`}>
                                                <Edit size={14} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border-surface)', background: 'var(--color-panel-2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{products.length > 0 ? `Showing ${products.length} products` : 'No results'}</span>
                </div>
            </div>
        </div>
    )
}

export default Products
