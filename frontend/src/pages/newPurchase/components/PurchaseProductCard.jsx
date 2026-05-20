import { AlertTriangle, CircleOff } from 'lucide-react'
import { formatCurrency } from '../utils'

function StockBadge({ stock, minStock }) {
	if (stock <= 0) {
		return (
			<span className="pos-stock-badge is-out">
				<CircleOff size={12} />
				Out
			</span>
		)
	}

	if (stock <= minStock) {
		return (
			<span className="pos-stock-badge is-low">
				<AlertTriangle size={12} />
				Low
			</span>
		)
	}

	return <span className="pos-stock-badge is-healthy">In Stock</span>
}

export function PurchaseProductCard({ product, cartQuantity, pulse, onAdd }) {
	const stock = Number(product.current_stock || 0)
	const minStock = Number(product.min_stock_level || 5)
	const isOut = stock <= 0
	const isLowStock = stock <= minStock

	return (
		<button
			type="button"
			onClick={() => onAdd(product)}
			className={`pos-product-card${isOut ? ' is-out-of-stock' : ''}${pulse ? ' is-pulse' : ''}`}
			aria-label={`${product.name}, ${formatCurrency(product.cost_price)}, stock ${stock}`}
		>
			<div className="pos-product-head">
				<h3 title={product.name}>{product.name}</h3>
				<StockBadge stock={stock} minStock={minStock} />
			</div>

			<p className="pos-product-sku">SKU: {product.code || 'N/A'}</p>
			{isLowStock && <p className="pos-product-low-stock">Low Stock: {stock}</p>}

			<div className="pos-product-foot">
				<strong>{formatCurrency(product.cost_price)}</strong>
				{cartQuantity > 0 && <span className="pos-chip">In order: {cartQuantity}</span>}
			</div>
		</button>
	)
}

export function ProductSkeletonGrid() {
	return (
		<div className="pos-product-grid">
			{Array.from({ length: 12 }).map((_, index) => (
				<div key={`skeleton-${index}`} className="pos-product-skeleton" aria-hidden="true">
					<div className="pos-skeleton-title" />
					<div className="pos-skeleton-sku" />
					<div className="pos-skeleton-price" />
				</div>
			))}
		</div>
	)
}
