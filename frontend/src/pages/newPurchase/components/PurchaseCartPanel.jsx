import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { PAYMENT_METHODS } from '../constants'
import { buildQuickAmounts, formatCurrency } from '../utils'

export default function PurchaseCartPanel({
	isDrawer,
	items,
	subtotal,
	taxAmount,
	total,
	balance,
	taxRate,
	paymentMethod,
	paidAmount,
	bumpItemId,
	onClose,
	onUpdateQuantity,
	onUpdateUnitCost,
	onRemoveItem,
	onSetTaxRate,
	onSetPaymentMethod,
	onSetPaidAmount,
	onCheckout,
	onSaveDraft,
	saveDraftLabel,
	isSubmitting,
	isSavingDraft,
}) {
	const [draftQuantities, setDraftQuantities] = useState({})
	const quantityInputRefs = useRef({})

	const quickAmounts = useMemo(() => buildQuickAmounts(total), [total])
	const totalUnits = useMemo(
		() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[items]
	)

	const dueBalance = Number(balance || 0)
	const paymentState = dueBalance > 0.001 ? 'insufficient' : (dueBalance < -0.001 ? 'change' : 'exact')

	useEffect(() => {
		setDraftQuantities((previous) => {
			const next = {}
			for (const item of items) {
				const key = String(item.product_id)
				next[key] = String(item.quantity ?? 1)

				if (document.activeElement === quantityInputRefs.current[key] && previous[key] !== undefined) {
					next[key] = previous[key]
				}
			}
			return next
		})
	}, [items])

	const commitQuantity = useCallback((item, rawValue) => {
		const key = String(item.product_id)
		const cleanValue = String(rawValue ?? '').trim()
		const parsed = Number.parseInt(cleanValue, 10)

		if (!Number.isFinite(parsed) || parsed <= 0) {
			setDraftQuantities((previous) => ({
				...previous,
				[key]: String(item.quantity ?? 1),
			}))
			return false
		}

		onUpdateQuantity(item.product_id, parsed)
		setDraftQuantities((previous) => ({
			...previous,
			[key]: String(parsed),
		}))
		return true
	}, [onUpdateQuantity])

	const focusQuantityInputByIndex = useCallback((index) => {
		const nextItem = items[index]
		if (!nextItem) return

		const input = quantityInputRefs.current[String(nextItem.product_id)]
		if (!input) return

		input.focus()
		input.select()
	}, [items])

	const stopAccidentalNumberChange = useCallback((event) => {
		if (document.activeElement === event.currentTarget) {
			event.currentTarget.blur()
		}
	}, [])

	const preventArrowStep = useCallback((event) => {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault()
		}
	}, [])

	return (
		<aside className={`pos-cart-panel${isDrawer ? ' is-drawer' : ' is-desktop'}`} aria-label="Cart panel">
			<header className="pos-cart-head">
				<div>
					<h2>Purchase Cart</h2>
					<p>{items.length} item{items.length === 1 ? '' : 's'} - {totalUnits} units</p>
				</div>
				{onClose && (
					<button type="button" onClick={onClose} className="pos-icon-btn" aria-label="Close cart drawer">
						<X size={16} />
					</button>
				)}
			</header>

			<div className="pos-cart-body">
				{items.length === 0 ? (
					<div className="pos-empty-card">
						<ShoppingCart size={28} />
						<p>Cart is empty</p>
						<span>Add products to begin checkout.</span>
					</div>
				) : (
					<ul className="pos-cart-list">
						{items.map((item) => (
							<li
								key={item.product_id}
								className={`pos-cart-item${bumpItemId === item.product_id ? ' is-bump' : ''}`}
							>
								<div className="pos-cart-item-top">
									<div className="pos-cart-item-title">
										<p title={item.name}>{item.name}</p>
										<span>SKU: {item.code || 'N/A'}</span>
									</div>
									<button
										type="button"
										className="pos-icon-btn danger"
										onClick={() => onRemoveItem(item.product_id, item.name)}
										aria-label={`Remove ${item.name}`}
									>
										<Trash2 size={16} />
									</button>
								</div>

								<div className="purchase-cart-row">
									<div className="purchase-unit-cost-wrap">
										<label htmlFor={`unit-cost-${item.product_id}`} className="purchase-mini-label">Unit Cost</label>
										<input
											id={`unit-cost-${item.product_id}`}
											className="purchase-unit-cost-input"
											type="number"
											min="0"
											step="0.01"
											value={item.unit_price || 0}
											onChange={(event) => onUpdateUnitCost(item.product_id, Number(event.target.value) || 0)}
											onWheel={stopAccidentalNumberChange}
											onKeyDown={preventArrowStep}
											aria-label={`Unit cost for ${item.name}`}
										/>
									</div>

									<div className="pos-qty-stepper">
										<button
											type="button"
											onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
											aria-label={`Decrease quantity for ${item.name}`}
										>
											<Minus size={14} />
										</button>
										<input
											ref={(node) => {
												const key = String(item.product_id)
												if (node) {
													quantityInputRefs.current[key] = node
												} else {
													delete quantityInputRefs.current[key]
												}
											}}
											type="text"
											inputMode="numeric"
											pattern="[0-9]*"
											value={draftQuantities[String(item.product_id)] ?? String(item.quantity ?? 1)}
											onChange={(event) => {
												const key = String(item.product_id)
												const onlyDigits = event.target.value.replace(/\D/g, '')
												setDraftQuantities((previous) => ({
													...previous,
													[key]: onlyDigits,
												}))
											}}
											onFocus={(event) => event.target.select()}
											onBlur={(event) => {
												commitQuantity(item, event.target.value)
											}}
											onKeyDown={(event) => {
												if (event.key !== 'Enter') return

												event.preventDefault()
												const currentIndex = items.findIndex(
													(entry) => String(entry.product_id) === String(item.product_id)
												)
												const didCommit = commitQuantity(item, event.currentTarget.value)
												if (!didCommit) return

												requestAnimationFrame(() => {
													focusQuantityInputByIndex(currentIndex + 1)
												})
											}}
											aria-label={`Quantity for ${item.name}`}
										/>
										<button
											type="button"
											onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
											aria-label={`Increase quantity for ${item.name}`}
										>
											<Plus size={14} />
										</button>
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="pos-cart-foot">
				<section className="pos-summary-card">
					<div className="pos-row">
						<span>Subtotal</span>
						<strong>{formatCurrency(subtotal)}</strong>
					</div>

					<div className="pos-adjust-grid">
						<div>
							<label htmlFor="global-tax-rate">Tax Rate (%)</label>
							<input
								id="global-tax-rate"
								type="number"
								min="0"
								step="0.5"
								value={taxRate || ''}
								onChange={(event) => onSetTaxRate(Number(event.target.value) || 0)}
								onWheel={stopAccidentalNumberChange}
								onKeyDown={preventArrowStep}
								aria-label="Tax rate"
							/>
						</div>
					</div>

					<div className="pos-summary-meta">
						{taxAmount > 0 && (
							<div className="pos-row warning">
								<span>Tax</span>
								<strong>+ {formatCurrency(taxAmount)}</strong>
							</div>
						)}
					</div>
				</section>

				<section className="pos-total-card">
					<p>Final Total</p>
					<strong>{formatCurrency(total)}</strong>
				</section>

				<section className="pos-payment-card">
					<label className="pos-label">Payment Method</label>
					<div className="pos-payment-methods">
						{PAYMENT_METHODS.map((method) => {
							const Icon = method.icon
							const active = paymentMethod === method.id
							return (
								<button
									key={method.id}
									type="button"
									className={`pos-payment-method${active ? ' is-active' : ''}`}
									onClick={() => onSetPaymentMethod(method.id)}
									aria-pressed={active}
								>
									<Icon size={13} />
									{method.label}
								</button>
							)
						})}
					</div>

					<div className="pos-field">
						<label htmlFor="amount-paid">Amount Paid</label>
						<input
							id="amount-paid"
							className="pos-amount-input"
							type="number"
							min="0"
							value={paidAmount || ''}
							onChange={(event) => onSetPaidAmount(Number(event.target.value) || 0)}
							onWheel={stopAccidentalNumberChange}
							onKeyDown={preventArrowStep}
							placeholder="0"
							aria-label="Amount paid"
						/>
					</div>

					{paymentMethod === 'cash' && quickAmounts.length > 0 && (
						<div className="pos-quick-amounts">
							{quickAmounts.map((amount) => {
								const active = paidAmount === amount
								return (
									<button
										key={`quick-${amount}`}
										type="button"
										className={`pos-quick-amount${active ? ' is-active' : ''}`}
										onClick={() => onSetPaidAmount(amount)}
									>
										{formatCurrency(amount)}
									</button>
								)
							})}
						</div>
					)}

					<div className={`pos-payment-state is-${paymentState}`} role="status">
						{paymentState === 'insufficient' && `Due: ${formatCurrency(balance)}`}
						{paymentState === 'exact' && 'Exact amount entered'}
						{paymentState === 'change' && `Overpaid: ${formatCurrency(Math.abs(balance))}`}
					</div>
				</section>

				{onSaveDraft && (
					<button
						type="button"
						className="purchase-save-draft-btn"
						onClick={onSaveDraft}
						disabled={isSavingDraft || isSubmitting || items.length === 0}
					>
						{isSavingDraft ? 'Saving draft...' : saveDraftLabel}
					</button>
				)}

				<button
					type="button"
					className="pos-checkout-btn"
					onClick={onCheckout}
					disabled={isSubmitting || items.length === 0}
				>
					{isSubmitting ? 'Processing...' : 'Complete Purchase (Ctrl/Cmd + Enter)'}
				</button>
			</div>
		</aside>
	)
}
