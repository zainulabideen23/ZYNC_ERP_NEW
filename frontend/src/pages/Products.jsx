import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { productsAPI, categoriesAPI, suppliersAPI, unitsAPI, brandsAPI } from '../services/api'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'
import { useAuthStore } from '../store/auth.store'
import { can } from '../utils/permissions'
import UnitSelector from '../components/UnitSelector'
import CategorySelector from '../components/CategorySelector'
import BrandSelector from '../components/BrandSelector'
import { Package, Plus, Search, X, Edit, FileText, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight, ScanLine, Filter, ChevronDown, Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import PageLoader from '../components/PageLoader'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

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
    const [showImportModal, setShowImportModal] = useState(false)
    const [importFile, setImportFile] = useState(null)
    const [importState, setImportState] = useState('idle')
    const [importResult, setImportResult] = useState(null)
    const [isDirty, setIsDirty] = useState(false)
    const [barcodeInputOpen, setBarcodeInputOpen] = useState(false)
    const [manualBarcode, setManualBarcode] = useState('')
    const scanGuardRef = useRef(false)

    const [filterCategory, setFilterCategory] = useState('')
    const [filterBrand, setFilterBrand] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterLowStock, setFilterLowStock] = useState(false)
    const [filterTrackStock, setFilterTrackStock] = useState('all')
    const [filtersOpen, setFiltersOpen] = useState(false)
    const filterRef = useRef(null)

    const [formData, setFormData] = useState({
        name: '', code: '', barcode: '', description: '',
        category_id: '', unit_id: '', brand_id: '',
        cost_price: '', retail_price: '', wholesale_price: '',
        tax_rate: '0', min_stock_level: '0', reorder_quantity: '0',
        weight: '', dimensions: '', track_stock: true, is_active: true, opening_stock: '0'
    })

    const [formErrors, setFormErrors] = useState({})

    useEffect(() => { loadData() }, [search, filterCategory, filterBrand, filterStatus, filterLowStock, filterTrackStock])
    useDataSync(DataSyncEvents.SALE_CREATED, () => { loadData() })
    useDataSync(DataSyncEvents.SALE_UPDATED, () => { loadData() })
    useDataSync(DataSyncEvents.PURCHASE_CREATED, () => { loadData() })

    useEffect(() => {
        if (!filtersOpen) return
        const handler = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false)
        }
        const keyHandler = (e) => { if (e.key === 'Escape') setFiltersOpen(false) }
        document.addEventListener('mousedown', handler)
        document.addEventListener('keydown', keyHandler)
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler) }
    }, [filtersOpen])

    const loadData = async () => {
        try {
            const params = { search, limit: 100 }
            if (filterCategory) params.category_id = filterCategory
            if (filterBrand) params.brand_id = filterBrand
            if (filterStatus === 'active') params.is_active = true
            if (filterStatus === 'inactive') params.is_active = false
            if (filterLowStock) params.low_stock = true
            if (filterTrackStock === 'yes') params.track_stock = true
            if (filterTrackStock === 'no') params.track_stock = false
            const [productsRes, categoriesRes, unitsRes, brandsRes] = await Promise.all([
                productsAPI.list(params),
                categoriesAPI.list(),
                unitsAPI.list(),
                brandsAPI.list()
            ])
            setProducts(productsRes.data || [])
            console.log('[Products] categories from API:', categoriesRes.data?.length, 'items')
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
        if (scanGuardRef.current) {
            scanGuardRef.current = false
            return
        }
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

    const resetForm = useCallback(() => {
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
        scanGuardRef.current = false
    }, [])

    const openCreateView = () => {
        resetForm()
        setView('form')
        window.scrollTo(0, 0)
    }

    const openEditView = useCallback((product) => {
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
    }, [])

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

    const handleBarcodeScan = useCallback((code) => {
        const cleanCode = String(code || '').trim()
        if (!cleanCode) return

        const found = products.find((p) =>
            String(p.barcode || '') === cleanCode ||
            String(p.code || '').toLowerCase() === cleanCode.toLowerCase()
        )

        if (view === 'form') {
            setFormData(prev => ({ ...prev, barcode: cleanCode }))
            if (found) {
                toast(`${found.name} — barcode exists`, { icon: '⚠️' })
            } else {
                toast.info('Barcode filled')
            }
            return
        }

    if (found) {
        scanGuardRef.current = true
        openEditView(found)
        toast.success(`Opened: ${found.name}`)
        return
    }

    resetForm()
    setFormData(prev => ({ ...prev, barcode: cleanCode }))
    setView('form')
    toast.info('Product not found — creating new with barcode')
}, [products, view, openEditView, resetForm])

    const handleManualBarcode = () => {
        if (manualBarcode.trim()) {
            handleBarcodeScan(manualBarcode)
            setManualBarcode('')
            setBarcodeInputOpen(false)
        }
    }

    useBarcodeScanner(useCallback((code) => {
        handleBarcodeScan(code)
    }, [handleBarcodeScan]))

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

    if (loading && view === 'list') return <PageLoader />

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
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input type="text" value={formData.barcode} onChange={(e) => handleFormChange('barcode', e.target.value)} placeholder="Scan or enter barcode" style={{ flex: 1 }} />
                                        <button type="button" onClick={() => setBarcodeInputOpen(true)} title="Scan barcode" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', color: 'var(--color-text)', cursor: 'pointer', flexShrink: 0 }}>
                                            <ScanLine size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Category <span className="required">*</span></label>
                                    <CategorySelector value={formData.category_id} onChange={(val) => handleFormChange('category_id', val)} categories={categories} onCategoriesChange={setCategories} error={formErrors.category_id} />
                                </div>
                                <div className="form-group">
                                    <label>Brand</label>
                                    <BrandSelector value={formData.brand_id} onChange={(val) => handleFormChange('brand_id', val)} brands={brands} onBrandsChange={setBrands} />
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
                                    <input type="number" className={formErrors.cost_price ? 'error' : ''} value={formData.cost_price} onChange={(e) => handleFormChange('cost_price', e.target.value)} step="0.01" placeholder="0.00" onWheel={e => e.target.blur()} />
                                    {formErrors.cost_price && <span className="error-text">{formErrors.cost_price}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Retail Price (PKR) <span className="required">*</span></label>
                                    <input type="number" className={(formErrors.retail_price || profitData.isInvalid) ? 'error' : ''} value={formData.retail_price} onChange={(e) => handleFormChange('retail_price', e.target.value)} step="0.01" placeholder="0.00" onWheel={e => e.target.blur()} />
                                    {profitData.isInvalid && <span className="warning-text">Retail price must be higher than cost price</span>}
                                    {formErrors.retail_price && <span className="error-text">{formErrors.retail_price}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Wholesale Price (PKR)</label>
                                    <input type="number" value={formData.wholesale_price} onChange={(e) => handleFormChange('wholesale_price', e.target.value)} step="0.01" placeholder="0.00" onWheel={e => e.target.blur()} />
                                </div>
                                <div className="form-group">
                                    <label>Tax Rate (%)</label>
                                    <input type="number" value={formData.tax_rate} onChange={(e) => handleFormChange('tax_rate', e.target.value)} step="0.1" placeholder="0" onWheel={e => e.target.blur()} />
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
                                    <input type="number" value={formData.weight} onChange={(e) => handleFormChange('weight', e.target.value)} step="0.001" placeholder="0.0" onWheel={e => e.target.blur()} />
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
                                        <input type="number" value={formData.opening_stock} onChange={(e) => handleFormChange('opening_stock', e.target.value)} placeholder="0" onWheel={e => e.target.blur()} />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Minimum Stock Alert Level</label>
                                    <input type="number" value={formData.min_stock_level} onChange={(e) => handleFormChange('min_stock_level', e.target.value)} placeholder="5" onWheel={e => e.target.blur()} />
                                </div>
                                <div className="form-group">
                                    <label>Reorder Quantity</label>
                                    <input type="number" value={formData.reorder_quantity} onChange={(e) => handleFormChange('reorder_quantity', e.target.value)} placeholder="10" onWheel={e => e.target.blur()} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={submitting}>Cancel</button>
                                <button type="submit" className="btn btn-primary" onClick={handleSubmit} disabled={submitting || profitData.isInvalid} title={profitData.isInvalid ? "Fix pricing to create product" : ""}>
                                    {submitting ? <><span className="spinner"></span> {editingProduct ? 'Updating...' : 'Creating...'}</> : editingProduct ? 'Update Product' : 'Create Product'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <style>{`
                    .product-form-page { background: var(--color-bg); min-height: 100vh; color: var(--color-text); }
                    .form-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2.5rem; background: var(--color-panel); border-bottom: 2px solid var(--border-surface); position: sticky; top: 0; z-index: 100; }
                    .header-left { display: flex; align-items: center; gap: 1.5rem; }
                    .btn-back { background: none; border: none; color: var(--color-muted); cursor: pointer; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 6px; }
                    .btn-back:hover { color: var(--color-text); }
                    .form-header h1 { font-size: 1.25rem; margin: 0; font-weight: 700; color: var(--color-text); }
                    .form-container { max-width: 900px; margin: 2rem auto; width: 100%; padding: 0 1.5rem; }
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
                    .btn { padding: 0.75rem 2rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
                    .btn-primary { background: var(--blue); color: #fff; }
                    .btn-primary:hover:not(:disabled) { background: #2563eb; }
                    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                    .btn-ghost { background: transparent; color: var(--color-muted); border: 1px solid var(--border-surface); }
                    .btn-ghost:hover { background: var(--color-panel-2); color: var(--color-text); }
                    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } .profit-summary-card { flex-direction: column; gap: 1rem; } .border-l { border-left: none; padding-left: 0; border-top: 1px solid var(--border-surface); padding-top: 1rem; } }
                    @media (max-width: 640px) {
                        .page-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
                        .page-header .add-btn { width: 100% !important; justify-content: center !important; }
                        .metrics-row { flex-direction: column !important; }
                        .search-row { flex-wrap: wrap !important; }
                        .search-row .search-wrap { max-width: none !important; flex: 1 1 100% !important; }
                        .filter-popover { min-width: 0 !important; width: calc(100vw - 48px) !important; right: -16px !important; }
                        .table-wrap { overflow-x: auto !important; }
                        .table-wrap table { min-width: 640px; }
                    }
                `}</style>
            </div>
        )
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color="var(--blue)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Products</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Manage your product catalog and inventory</p>
                    </div>
                </div>
                {can(userRole, 'products.create') && (
                    <button onClick={() => { setShowImportModal(true); setImportState('idle'); setImportFile(null); setImportResult(null) }} style={{ height: '38px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-text)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Upload size={15} />
                        Import
                    </button>
                )}
                <button className="add-btn" onClick={openCreateView} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}>
                    <Plus size={16} />
                    Add Product
                </button>
            </div>

            {/* Metrics Row */}
            <div className="metrics-row" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <MetricCard label="Total Products" value={aggregates.totalProducts} icon={Package} color="#3b82f6" subtext="In catalog" />
                <MetricCard label="Inventory Value" value={formatCurrency(aggregates.totalValue)} icon={TrendingUp} color="#10b981" subtext="At retail" />
                <MetricCard label="Low Stock" value={aggregates.lowStock} icon={AlertTriangle} color="#f59e0b" subtext="Need reorder" />
            </div>

            {/* Search */}
            <div className="search-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-panel)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-surface)' }}>
                <div className="search-wrap" style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-hint)' }} />
                    <input type="text" placeholder="Search by name, SKU, or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const match = products.find(p => p.barcode && p.barcode === search.trim()); if (match) openEditView(match) } }} style={{ width: '100%', height: '36px', background: 'var(--color-panel-2)', border: '1px solid var(--border-surface)', borderRadius: '8px', paddingLeft: '36px', paddingRight: '12px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border-surface)'} />
                </div>
                <button type="button" onClick={() => setBarcodeInputOpen(p => !p)} title="Scan barcode" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: barcodeInputOpen ? 'var(--blue)' : 'var(--color-panel-2)', border: `1px solid ${barcodeInputOpen ? 'var(--blue)' : 'var(--border-surface)'}`, borderRadius: '8px', color: barcodeInputOpen ? '#fff' : 'var(--color-text)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <ScanLine size={16} />
                </button>
                <div ref={filterRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setFiltersOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: filtersOpen ? 'var(--blue)' : 'var(--color-panel-2)', color: filtersOpen ? '#fff' : 'var(--color-text)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <Filter size={14} />
                        Filters
                        {(() => { const n = (filterCategory ? 1 : 0) + (filterBrand ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0) + (filterLowStock ? 1 : 0) + (filterTrackStock !== 'all' ? 1 : 0); return n > 0 ? <span style={{ marginLeft: '4px', background: filtersOpen ? 'rgba(255,255,255,0.25)' : 'var(--blue)', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span> : null })()}
                        <ChevronDown size={12} style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    {filtersOpen && (
                        <div className="filter-popover" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--color-panel)', border: '1px solid var(--border-surface)', borderRadius: '12px', padding: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', zIndex: 100, minWidth: '520px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-panel-2)', color: 'var(--color-text)', fontSize: '13px', outline: 'none', minWidth: '140px', cursor: 'pointer' }}>
                                    <option value="">All Categories</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'var(--color-panel-2)', color: 'var(--color-text)', fontSize: '13px', outline: 'none', minWidth: '140px', cursor: 'pointer' }}>
                                    <option value="">All Brands</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                                    {['all', 'active', 'inactive'].map(s => (
                                        <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: 'none', background: filterStatus === s ? 'var(--blue)' : 'transparent', color: filterStatus === s ? '#fff' : 'var(--color-text-dim)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
                                        </button>
                                    ))}
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-dim)', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: filterLowStock ? 'rgba(239, 68, 68, 0.1)' : 'transparent', borderColor: filterLowStock ? '#ef4444' : 'var(--border-surface)', userSelect: 'none', transition: 'all 0.15s' }}>
                                    <input type="checkbox" checked={filterLowStock} onChange={e => setFilterLowStock(e.target.checked)} style={{ accentColor: '#ef4444' }} />
                                    Low stock
                                </label>
                                <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--border-surface)', overflow: 'hidden' }}>
                                    {['all', 'yes', 'no'].map(t => (
                                        <button key={t} onClick={() => setFilterTrackStock(t)} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: 'none', background: filterTrackStock === t ? 'var(--blue)' : 'transparent', color: filterTrackStock === t ? '#fff' : 'var(--color-text-dim)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {t === 'all' ? 'All stock' : t === 'yes' ? 'Tracked' : 'Untracked'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="table-wrap" style={{ background: 'var(--color-panel)', borderRadius: '12px', border: '1px solid var(--border-surface)', overflowX: 'auto' }}>
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

            {/* Import Modal */}
            {showImportModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => { if (importState !== 'importing') { setShowImportModal(false) } }}>
                    <div style={{ background: 'var(--color-panel)', borderRadius: '16px', border: '1px solid var(--border-surface)', width: '560px', maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-surface)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileSpreadsheet size={18} color="var(--blue)" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>Import Products</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-hint)' }}>Upload Excel or CSV file</p>
                                </div>
                            </div>
                            <button onClick={() => { if (importState !== 'importing') setShowImportModal(false) }} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            {importState === 'done' && importResult ? (
                                /* Result View */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '16px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                            <CheckCircle size={22} color="#10b981" style={{ marginBottom: '6px' }} />
                                            <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981' }}>{importResult.imported}</div>
                                            <div style={{ fontSize: '11px', color: '#10b981', opacity: 0.8 }}>Imported</div>
                                        </div>
                                        <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', padding: '16px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            <X size={22} color="#ef4444" style={{ marginBottom: '6px' }} />
                                            <div style={{ fontSize: '22px', fontWeight: 700, color: '#ef4444' }}>{importResult.skipped}</div>
                                            <div style={{ fontSize: '11px', color: '#ef4444', opacity: 0.8 }}>Skipped</div>
                                        </div>
                                    </div>

                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>Row Errors</div>
                                            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-surface)', borderRadius: '8px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                    <thead>
                                                        <tr style={{ background: 'var(--color-panel-2)', borderBottom: '1px solid var(--border-surface)' }}>
                                                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-muted)', width: '50px' }}>Row</th>
                                                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-muted)' }}>Product</th>
                                                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-muted)' }}>Error</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importResult.errors.map((e, i) => (
                                                            <tr key={i} style={{ borderBottom: i < importResult.errors.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                                                <td style={{ padding: '8px 10px', color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{e.row}</td>
                                                                <td style={{ padding: '8px 10px', color: 'var(--color-text)', fontWeight: 500 }}>{e.product}</td>
                                                                <td style={{ padding: '8px 10px', color: '#ef4444' }}>{e.errors.join('; ')}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <button onClick={() => {
                                                const csvContent = 'Row,Product,Error\n' + importResult.errors.map(e => `"${e.row}","${e.product}","${e.errors.join('; ')}"`).join('\n');
                                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a'); a.href = url; a.download = 'import-errors.csv'; a.click();
                                                URL.revokeObjectURL(url);
                                            }} style={{ marginTop: '10px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-text)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <Download size={13} />
                                                Download Errors CSV
                                            </button>
                                        </div>
                                    )}

                                    <button onClick={() => { setShowImportModal(false); loadData() }} style={{ padding: '10px 0', borderRadius: '8px', border: 'none', background: 'var(--blue)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                        Done
                                    </button>
                                </div>
                            ) : importState === 'importing' ? (
                                /* Importing View */
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0' }}>
                                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-surface)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Processing Import...</div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-hint)', marginTop: '4px' }}>Validating and importing products</div>
                                    </div>
                                </div>
                            ) : (
                                /* Upload View */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {!importFile ? (
                                        <div onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }} onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-surface)'; e.currentTarget.style.background = 'transparent' }} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && ['.xlsx','.xls','.csv'].some(ext => f.name.toLowerCase().endsWith(ext))) { setImportFile(f) } else { toast.error('Invalid file format') } }} onClick={() => document.getElementById('import-file-input').click()} style={{ border: '2px dashed var(--border-surface)', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                            <Upload size={32} color="var(--color-hint)" style={{ marginBottom: '12px' }} />
                                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>Drop your file here or click to browse</div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-hint)', marginTop: '6px' }}>Supports .xlsx, .xls, .csv (max 5MB)</div>
                                            <input id="import-file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) setImportFile(f) }} />
                                        </div>
                                    ) : (
                                        <div style={{ background: 'var(--color-panel-2)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-surface)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <FileSpreadsheet size={20} color="var(--blue)" />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{importFile.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-hint)', marginTop: '2px' }}>{(importFile.size / 1024).toFixed(1)} KB</div>
                                                </div>
                                                <button onClick={() => setImportFile(null)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => { setShowImportModal(false); setImportFile(null) }} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-surface)', background: 'transparent', color: 'var(--color-text)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                            Cancel
                                        </button>
                                        <button onClick={() => {
                                            if (!importFile) { toast.error('Please select a file'); return }
                                            setImportState('importing');
                                            const formData = new FormData();
                                            formData.append('file', importFile);
                                            productsAPI.importFile(formData).then(res => {
                                                setImportResult(res.data);
                                                setImportState('done');
                                            }).catch(err => {
                                                setImportState('idle');
                                                toast.error(err.response?.data?.message || 'Import failed');
                                            });
                                        }} disabled={!importFile} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: importFile ? 'var(--blue)' : 'var(--color-panel-2)', color: importFile ? '#fff' : 'var(--color-text-dim)', fontSize: '13px', fontWeight: 600, cursor: importFile ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Upload size={15} />
                                            Import
                                        </button>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border-surface)', paddingTop: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>Need a template?</span>
                                            <button onClick={() => {
                                                productsAPI.downloadTemplate().then(blob => {
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a'); a.href = url; a.download = 'product-import-template.xlsx'; a.click();
                                                    URL.revokeObjectURL(url);
                                                }).catch(() => toast.error('Failed to download template'));
                                            }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Download size={12} />
                                                Download Template
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default Products
