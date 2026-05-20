import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ShoppingCart } from 'lucide-react'
import { productsAPI, suppliersAPI, purchasesAPI, categoriesAPI } from '../services/api'
import { emit, DataSyncEvents } from '../utils/dataSync'
import PurchaseCartPanel from './newPurchase/components/PurchaseCartPanel'
import PurchaseControls from './newPurchase/components/PurchaseControls'
import PurchaseProductsPanel from './newPurchase/components/PurchaseProductsPanel'
import PurchaseHero from './newPurchase/components/PurchaseHero'
import PurchaseLoadingState from './newPurchase/components/PurchaseLoadingState'
import { useBarcodeScanner, useDesktopCartDrawer, useFullscreenToggle, usePurchaseShortcuts } from './newPurchase/hooks'
import { todayInputDate } from './newPurchase/utils'
import './NewPurchase.css'

function NewPurchase() {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const draftIdParam = searchParams.get('draftId')
	const isEditingDraft = Boolean(draftIdParam)

	const searchRef = useRef(null)
	const barcodeInputRef = useRef(null)
	const [products, setProducts] = useState([])
	const [suppliers, setSuppliers] = useState([])
	const [categories, setCategories] = useState([])
	const [loading, setLoading] = useState(true)
	const [draftLoading, setDraftLoading] = useState(false)

	const { isDesktopCart, cartOpen, setCartOpen, openCartDrawerIfNeeded, drawerOpen } = useDesktopCartDrawer()
	const { isFullscreen, toggleFullscreen } = useFullscreenToggle()

	const [search, setSearch] = useState('')
	const [categoryFilter, setCategoryFilter] = useState('all')
	const [showLowStockOnly, setShowLowStockOnly] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [savingDraft, setSavingDraft] = useState(false)

	const [barcodeInputOpen, setBarcodeInputOpen] = useState(false)
	const [barcodeInput, setBarcodeInput] = useState('')

	const [pulseProductId, setPulseProductId] = useState(null)
	const [bumpItemId, setBumpItemId] = useState(null)

	const [cart, setCart] = useState([])
	const [supplierId, setSupplierId] = useState('')
	const [purchaseDate, setPurchaseDate] = useState(todayInputDate())
	const [referenceNumber, setReferenceNumber] = useState('')
	const [globalDiscount, setGlobalDiscount] = useState(0)
	const [globalDiscountType, setGlobalDiscountType] = useState('amount')
	const [taxRate, setTaxRate] = useState(0)
	const [paidAmount, setPaidAmount] = useState(0)
	const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
	const [draftBillNumber, setDraftBillNumber] = useState('')

	const selectedSupplier = useMemo(
		() => suppliers.find((supplier) => String(supplier.id) === String(supplierId)),
		[suppliers, supplierId]
	)

	const { subtotal, discountAmount, taxAmount, total, balance } = useMemo(() => {
		const sub = cart.reduce(
			(sum, item) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 0)),
			0
		)
		const discount = globalDiscountType === 'percent'
			? (sub * Number(globalDiscount || 0) / 100)
			: Number(globalDiscount || 0)
		const afterDiscount = Math.max(0, sub - discount)
		const tax = afterDiscount * (Number(taxRate || 0) / 100)
		const finalTotal = afterDiscount + tax

		return {
			subtotal: sub,
			discountAmount: discount,
			taxAmount: tax,
			total: finalTotal,
			balance: finalTotal - Number(paidAmount || 0),
		}
	}, [cart, globalDiscount, globalDiscountType, taxRate, paidAmount])

	const categoryOptions = useMemo(() => {
		const normalized = categories
			.filter((category) => category && category.id)
			.map((category) => ({ id: String(category.id), name: category.name }))

		return [{ id: 'all', name: 'All' }, ...normalized]
	}, [categories])

	const filteredProducts = useMemo(() => {
		const query = search.trim().toLowerCase()
		let result = products
			.filter((product) => {
				if (categoryFilter !== 'all' && String(product.category_id) !== String(categoryFilter)) {
					return false
				}

				if (!query) return true

				const name = String(product.name || '').toLowerCase()
				const sku = String(product.code || '').toLowerCase()
				const barcode = String(product.barcode || '').toLowerCase()

				return name.includes(query) || sku.includes(query) || barcode.includes(query)
			})

		if (showLowStockOnly) {
			result = result.filter((product) => (
				Number(product.current_stock || 0) <= Number(product.min_stock_level || 5)
			))
		}

		return result.slice(0, 120)
	}, [products, search, categoryFilter, showLowStockOnly])

	const noProductsReason = useMemo(
		() => (showLowStockOnly ? 'low-stock' : (search.trim() ? 'search' : (categoryFilter !== 'all' ? 'category' : 'empty'))),
		[showLowStockOnly, search, categoryFilter]
	)

	const cartUnits = useMemo(
		() => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[cart]
	)

	const lowStockCount = useMemo(
		() => filteredProducts.filter((product) => {
			const stock = Number(product.current_stock || 0)
			const minStock = Number(product.min_stock_level || 5)
			return stock <= minStock  // Include products with 0 stock
		}).length,
		[filteredProducts]
	)

	const getCartQuantity = useCallback((productId) => {
		const item = cart.find((entry) => String(entry.product_id) === String(productId))
		return item?.quantity || 0
	}, [cart])

	const loadData = useCallback(async () => {
		try {
			setLoading(true)
			const [productsRes, suppliersRes, categoriesRes] = await Promise.all([
				productsAPI.list({ limit: 500 }),
				suppliersAPI.list({ limit: 500 }),
				categoriesAPI.list().catch(() => ({ data: [] })),
			])

			setProducts(productsRes.data || [])
			setSuppliers(suppliersRes.data || [])
			setCategories(categoriesRes.data || categoriesRes || [])
		} catch (error) {
			toast.error('Failed to load purchase data')
			console.error('Purchase load error:', error)
		} finally {
			setLoading(false)
		}
	}, [])

	const loadDraft = useCallback(async (draftId) => {
		try {
			setDraftLoading(true)
			const response = await purchasesAPI.get(draftId)
			const draft = response.data

			if (!draft) {
				toast.error('Draft not found')
				navigate('/purchases')
				return
			}

			if (draft.status !== 'draft') {
				toast.error('Only draft purchases can be edited')
				navigate('/purchases')
				return
			}

			const draftItems = Array.isArray(draft.items) ? draft.items : []
			const subtotalAmount = Number(draft.subtotal || 0)
			const discount = Number(draft.discount_amount || 0)
			const taxableBase = Math.max(0, subtotalAmount - discount)
			const taxAmountValue = Number(draft.tax_amount || 0)
			const taxRateValue = taxableBase > 0
				? Number(((taxAmountValue / taxableBase) * 100).toFixed(2))
				: 0
			const draftDate = draft.purchase_date
				? new Date(draft.purchase_date).toISOString().split('T')[0]
				: todayInputDate()

			setSupplierId(draft.supplier_id || '')
			setPurchaseDate(draftDate)
			setReferenceNumber(draft.reference_number || '')
			setGlobalDiscount(discount)
			setGlobalDiscountType('amount')
			setTaxRate(taxRateValue)
			setPaidAmount(Number(draft.amount_paid || 0))
			setPaymentMethod(draft.payment_method || 'bank_transfer')
			setDraftBillNumber(draft.bill_number || '')
			setCart(
				draftItems.map((item) => ({
					product_id: item.product_id,
					name: item.product_name || item.name || 'Product',
					code: item.product_code || item.code || '',
					unit_price: Number(item.unit_cost || item.unit_price || 0),
					quantity: Number(item.quantity || 1),
				}))
			)
			openCartDrawerIfNeeded()
		} catch (error) {
			toast.error(error.message || 'Failed to load draft purchase')
			navigate('/purchases')
		} finally {
			setDraftLoading(false)
		}
	}, [navigate, openCartDrawerIfNeeded])

	const handleAddToCart = useCallback((product) => {
		setCart((previous) => {
			const existing = previous.find((item) => String(item.product_id) === String(product.id))
			if (existing) {
				return previous.map((item) => (
					String(item.product_id) === String(product.id)
						? { ...item, quantity: Number(item.quantity || 0) + 1 }
						: item
				))
			}

			return [
				...previous,
				{
					product_id: product.id,
					name: product.name,
					code: product.code,
					unit_price: Number(product.cost_price || 0),
					quantity: 1,
				},
			]
		})

		setPulseProductId(product.id)
		setBumpItemId(product.id)
		openCartDrawerIfNeeded()
		toast.success(`${product.name} added to cart`)

		setTimeout(() => {
			setPulseProductId(null)
			setBumpItemId(null)
		}, 420)
	}, [openCartDrawerIfNeeded])

	// Add all low stock products to cart
	const handleAddAllToCart = useCallback((products) => {
		setCart((previous) => {
			const newItems = products.map((product) => {
				const existing = previous.find((item) => String(item.product_id) === String(product.id))
				return {
					product_id: product.id,
					name: product.name,
					code: product.code,
					unit_price: Number(product.cost_price || 0),
					quantity: existing ? Number(existing.quantity || 0) + 1 : 1,
				}
			})
			
			// Merge with existing cart, replacing quantities for these products
			const otherItems = previous.filter((prev) => 
				!newItems.find((newItem) => String(newItem.product_id) === String(prev.product_id))
			)
			return [...otherItems, ...newItems]
		})
		
		openCartDrawerIfNeeded()
		toast.success(`${products.length} products added to cart`)
	}, [openCartDrawerIfNeeded, toast])

	const handleUpdateQuantity = useCallback((productId, quantity) => {
		const parsedQuantity = Number(quantity || 0)
		if (parsedQuantity <= 0) {
			setCart((previous) => previous.filter((item) => String(item.product_id) !== String(productId)))
			return
		}

		setCart((previous) => previous.map((item) => (
			String(item.product_id) === String(productId)
				? { ...item, quantity: parsedQuantity }
				: item
		)))

		setBumpItemId(productId)
		setTimeout(() => setBumpItemId(null), 300)
	}, [])

	const handleUpdateUnitCost = useCallback((productId, unitCost) => {
		const safeUnitCost = Math.max(0, Number(unitCost || 0))
		setCart((previous) => previous.map((item) => (
			String(item.product_id) === String(productId)
				? { ...item, unit_price: safeUnitCost }
				: item
		)))
	}, [])

	const handleRemoveItem = useCallback((productId, productName) => {
		setCart((previous) => previous.filter((item) => String(item.product_id) !== String(productId)))
		toast.success(`${productName} removed from cart`)
	}, [])

	const processBarcode = useCallback((code) => {
		const cleanCode = String(code || '').trim()
		if (!cleanCode) return

		const found = products.find((product) => (
			String(product.barcode || '') === cleanCode
			|| String(product.code || '').toLowerCase() === cleanCode.toLowerCase()
		))

		if (!found) {
			toast.error(`Product not found: ${cleanCode}`)
			return
		}

		handleAddToCart(found)
	}, [products, handleAddToCart])

	const handleOpenBarcodeInput = useCallback(() => {
		setBarcodeInputOpen(true)
		setTimeout(() => barcodeInputRef.current?.focus(), 40)
	}, [])

	const handleBarcodeSubmit = useCallback((event) => {
		event.preventDefault()
		processBarcode(barcodeInput)
		setBarcodeInput('')
		setBarcodeInputOpen(false)
	}, [barcodeInput, processBarcode])

	const buildLineItems = useCallback((items) => items.map((item) => ({
		product_id: item.product_id,
		quantity: Number(item.quantity || 0),
		unit_cost: Number(item.unit_price || 0),
		line_discount: 0,
		tax_rate: 0,
	})), [])

	const buildPurchasePayload = useCallback((items, notesText) => ({
		supplier_id: supplierId || null,
		purchase_date: purchaseDate,
		reference_number: referenceNumber,
		items: buildLineItems(items),
		discount_amount: 0,
		tax_amount: taxAmount,
		amount_paid: Number(paidAmount || 0),
		payment_method: paymentMethod,
		notes: notesText,
	}), [
		supplierId,
		purchaseDate,
		referenceNumber,
		buildLineItems,
		taxAmount,
		paidAmount,
		paymentMethod,
	])

	const handleSaveDraft = useCallback(async () => {
		const validItems = cart.filter((item) => Number(item.quantity || 0) > 0)
		if (validItems.length === 0) {
			toast.error('Add at least one item before saving draft')
			return
		}

		setSavingDraft(true)
		try {
			const payload = buildPurchasePayload(
				validItems,
				`Draft via Purchase POS - ${new Date().toLocaleString()}`
			)

			const response = isEditingDraft
				? await purchasesAPI.updateDraft(draftIdParam, payload)
				: await purchasesAPI.createDraft(payload)

			const draft = response.data || {}
			emit(DataSyncEvents.PURCHASE_UPDATED, draft)
			toast.success(
				isEditingDraft
					? `Draft ${draft.bill_number || ''} updated`
					: `Draft ${draft.bill_number || ''} saved`
			)
			navigate('/purchases')
		} catch (error) {
			toast.error(error.message || 'Failed to save draft purchase')
		} finally {
			setSavingDraft(false)
		}
	}, [cart, buildPurchasePayload, isEditingDraft, draftIdParam, navigate])

	const resetFormState = useCallback(() => {
		setCart([])
		setSupplierId('')
		setPurchaseDate(todayInputDate())
		setReferenceNumber('')
		setGlobalDiscount(0)
		setGlobalDiscountType('amount')
		setTaxRate(0)
		setPaidAmount(0)
		setPaymentMethod('bank_transfer')
		setDraftBillNumber('')
		setBarcodeInputOpen(false)
		setBarcodeInput('')
	}, [])

	const handleCheckout = useCallback(async () => {
		const validItems = cart.filter((item) => Number(item.quantity || 0) > 0)

		if (validItems.length === 0) {
			toast.error('Add at least one product before checkout')
			return
		}

		if (!supplierId) {
			toast.error('Please select a supplier')
			return
		}

		if (Number(paidAmount || 0) < 0) {
			toast.error('Amount paid cannot be negative')
			return
		}

		if (total <= 0) {
			toast.error('Purchase total must be greater than 0')
			return
		}

		setSubmitting(true)

		try {
			const notePrefix = isEditingDraft && draftBillNumber
				? `Purchase finalized from draft ${draftBillNumber}`
				: 'Purchase via POS'

			const purchaseData = buildPurchasePayload(
				validItems,
				`${notePrefix} - ${new Date().toLocaleString()}`
			)

			const response = await purchasesAPI.create(purchaseData)

			if (isEditingDraft && draftIdParam) {
				try {
					await purchasesAPI.cancelDraft(draftIdParam, {
						reason: `Finalized as ${response.data?.bill_number || 'purchase'}`,
					})
					emit(DataSyncEvents.PURCHASE_UPDATED, {
						id: draftIdParam,
						status: 'cancelled',
					})
				} catch (cancelError) {
					console.error('Failed to auto-cancel finalized draft:', cancelError)
				}
			}

			emit(DataSyncEvents.PURCHASE_CREATED, response.data)
			toast.success(`Purchase completed. Bill: ${response.data?.bill_number || 'N/A'}`)
			resetFormState()
			navigate('/purchases')
		} catch (error) {
			toast.error(error.message || 'Failed to complete purchase')
			console.error('Purchase checkout error:', error)
		} finally {
			setSubmitting(false)
		}
	}, [
		cart,
		supplierId,
		paidAmount,
		total,
		isEditingDraft,
		draftBillNumber,
		buildPurchasePayload,
		draftIdParam,
		resetFormState,
		navigate,
	])

	const closeCartDrawer = useCallback(() => setCartOpen(false), [setCartOpen])
	const closeBarcodeInput = useCallback(() => setBarcodeInputOpen(false), [])

	usePurchaseShortcuts({
		searchRef,
		handleCheckout,
		isDesktopCart,
		cartOpen,
		onCloseCart: closeCartDrawer,
		onCloseBarcode: closeBarcodeInput,
	})

	useBarcodeScanner(processBarcode)

	useEffect(() => { loadData() }, [loadData])

	useEffect(() => {
		if (!draftIdParam) {
			setDraftBillNumber('')
			setPurchaseDate(todayInputDate())
			return
		}
		loadDraft(draftIdParam)
	}, [draftIdParam, loadDraft])

	const cartPanelProps = {
		items: cart,
		subtotal,
		discountAmount,
		taxAmount,
		total,
		balance,
		globalDiscount,
		globalDiscountType,
		taxRate,
		paymentMethod,
		paidAmount,
		bumpItemId,
		onUpdateQuantity: handleUpdateQuantity,
		onUpdateUnitCost: handleUpdateUnitCost,
		onRemoveItem: handleRemoveItem,
		onSetDiscount: setGlobalDiscount,
		onSetDiscountType: setGlobalDiscountType,
		onSetTaxRate: setTaxRate,
		onSetPaymentMethod: setPaymentMethod,
		onSetPaidAmount: setPaidAmount,
		onCheckout: handleCheckout,
		onSaveDraft: handleSaveDraft,
		saveDraftLabel: isEditingDraft ? 'Update Draft' : 'Save Draft',
		isSubmitting: submitting,
		isSavingDraft: savingDraft,
	}

	if (loading || draftLoading) {
		return <PurchaseLoadingState draftLoading={draftLoading} />
	}

	return (
		<div className="pos-page purchase-pos-page">
			<div className="pos-shell">
				<PurchaseHero
					cartUnits={cartUnits}
					visibleProducts={filteredProducts.length}
					lowStockCount={lowStockCount}
				/>

				{isEditingDraft && (
					<section className="purchase-draft-banner" aria-label="Draft edit mode">
						Editing draft: {draftBillNumber || draftIdParam}
					</section>
				)}

				<PurchaseControls
					suppliers={suppliers}
					supplierId={supplierId}
					onSelectSupplier={setSupplierId}
					purchaseDate={purchaseDate}
					onPurchaseDateChange={setPurchaseDate}
					referenceNumber={referenceNumber}
					onReferenceNumberChange={setReferenceNumber}
					barcodeInputOpen={barcodeInputOpen}
					onOpenBarcodeInput={handleOpenBarcodeInput}
					barcodeInputRef={barcodeInputRef}
					barcodeInput={barcodeInput}
					onBarcodeInputChange={setBarcodeInput}
					onSubmitBarcode={handleBarcodeSubmit}
					toggleFullscreen={toggleFullscreen}
					isFullscreen={isFullscreen}
					selectedSupplier={selectedSupplier}
					categoryOptions={categoryOptions}
					categoryFilter={categoryFilter}
					onCategoryFilterChange={setCategoryFilter}
				/>

				<section className="pos-content-grid">
					<PurchaseProductsPanel
						filteredProducts={filteredProducts}
						noProductsReason={noProductsReason}
						searchRef={searchRef}
						search={search}
						onSearchChange={setSearch}
						showLowStockOnly={showLowStockOnly}
						onToggleLowStockOnly={() => setShowLowStockOnly((current) => !current)}
						getCartQuantity={getCartQuantity}
						pulseProductId={pulseProductId}
						onAddToCart={handleAddToCart}
						onAddAllToCart={() => handleAddAllToCart(filteredProducts)}
					/>

					<div className="pos-cart-column">
						<PurchaseCartPanel isDrawer={false} {...cartPanelProps} />
					</div>
				</section>
			</div>

			{!isDesktopCart && (
				<button
					type="button"
					className="pos-mobile-cart-btn"
					onClick={() => setCartOpen(true)}
					aria-label="Open cart"
				>
					<ShoppingCart size={22} />
					{cart.length > 0 && <span>{cart.length}</span>}
				</button>
			)}

			{drawerOpen && (
				<>
					<button
						type="button"
						className="pos-drawer-overlay"
						onClick={closeCartDrawer}
						aria-label="Close cart drawer"
					/>
					<div className="pos-drawer-panel">
						<PurchaseCartPanel
							isDrawer={true}
							onClose={closeCartDrawer}
							{...cartPanelProps}
						/>
					</div>
				</>
			)}
		</div>
	)
}

export default NewPurchase
