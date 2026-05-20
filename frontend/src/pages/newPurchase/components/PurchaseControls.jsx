import { Maximize2, Minimize2, ScanLine } from 'lucide-react'
import SupplierSelector from './SupplierSelector'
import { formatCurrency, getSupplierBalance } from '../utils'

export default function PurchaseControls({
	suppliers,
	supplierId,
	onSelectSupplier,
	purchaseDate,
	onPurchaseDateChange,
	referenceNumber,
	onReferenceNumberChange,
	barcodeInputOpen,
	onOpenBarcodeInput,
	barcodeInputRef,
	barcodeInput,
	onBarcodeInputChange,
	onSubmitBarcode,
	toggleFullscreen,
	isFullscreen,
	selectedSupplier,
	categoryOptions,
	categoryFilter,
	onCategoryFilterChange,
}) {
	return (
		<section className="pos-controls">
			<div className="pos-control-row">
				<SupplierSelector
					suppliers={suppliers}
					selectedId={supplierId}
					onSelect={onSelectSupplier}
				/>

				<div className="pos-action-group purchase-top-fields">
					<input
						type="date"
						className="purchase-inline-input"
						value={purchaseDate}
						onChange={(event) => onPurchaseDateChange(event.target.value)}
						aria-label="Purchase date"
					/>

					<input
						type="text"
						className="purchase-inline-input"
						value={referenceNumber}
						onChange={(event) => onReferenceNumberChange(event.target.value)}
						placeholder="Ref or Supplier Bill"
						aria-label="Reference number"
					/>

					{!barcodeInputOpen && (
						<button
							type="button"
							className="pos-icon-btn"
							onClick={onOpenBarcodeInput}
							aria-label="Open barcode input"
						>
							<ScanLine size={16} />
						</button>
					)}

					{barcodeInputOpen && (
						<form className="pos-barcode-form" onSubmit={onSubmitBarcode}>
							<input
								ref={barcodeInputRef}
								type="text"
								value={barcodeInput}
								onChange={(event) => onBarcodeInputChange(event.target.value)}
								placeholder="Scan barcode"
								aria-label="Barcode input"
							/>
							<button type="submit" aria-label="Submit barcode">
								<ScanLine size={16} />
							</button>
						</form>
					)}

					<button
						type="button"
						className="pos-icon-btn"
						onClick={toggleFullscreen}
						aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
					>
						{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
					</button>
				</div>
			</div>

			{selectedSupplier && (
				<div className="purchase-supplier-note">
					Supplier payable balance: {formatCurrency(getSupplierBalance(selectedSupplier))}
				</div>
			)}

			<div className="pos-categories" role="tablist" aria-label="Product categories">
				{categoryOptions.map((category) => {
					const active = String(categoryFilter) === String(category.id)
					return (
						<button
							key={category.id}
							type="button"
							className={`pos-category-chip${active ? ' is-active' : ''}`}
							onClick={() => onCategoryFilterChange(category.id)}
							role="tab"
							aria-selected={active}
						>
							{category.name}
						</button>
					)
				})}
			</div>
		</section>
	)
}
