import { Command, Search, ShoppingCart, CircleOff } from 'lucide-react'
import { PurchaseProductCard } from './PurchaseProductCard'

export default function PurchaseProductsPanel({
	filteredProducts,
	noProductsReason,
	searchRef,
	search,
	onSearchChange,
	showLowStockOnly,
	onToggleLowStockOnly,
	getCartQuantity,
	pulseProductId,
	onAddToCart,
	onAddAllToCart,
}) {
	return (
		<div className="pos-products-panel">
			<header className="pos-panel-head">
				<div className="pos-panel-title">
					<h2>Products</h2>
					<p>{filteredProducts.length} products visible in current filters</p>
				</div>

				<div className="pos-panel-actions">
					<div className="pos-search-row">
						<Search size={18} className="search-icon" />
						<input
							ref={searchRef}
							type="text"
							value={search}
							onChange={(event) => onSearchChange(event.target.value)}
							placeholder="Search by product name, SKU, or barcode"
							aria-label="Search products"
						/>
						<span className="search-hint">
							<Command size={12} />
							/
						</span>
					</div>

					<div className="pos-shortcut-list">
						<button
							type="button"
							className={`pos-low-stock-toggle${showLowStockOnly ? ' is-active' : ''}`}
							onClick={onToggleLowStockOnly}
							aria-pressed={showLowStockOnly}
						>
							Show Low Stock Only
						</button>
						{showLowStockOnly && filteredProducts.length > 0 && (
							<button
								type="button"
								className="pos-add-all-btn"
								onClick={onAddAllToCart}
								title="Add all low stock products to cart"
							>
								Add All to Cart
							</button>
						)}
						<span>Ctrl/Cmd + Enter Checkout</span>
					</div>
				</div>
			</header>

			<div className="pos-products-scroll">
				{filteredProducts.length > 0 ? (
					<div className="pos-product-grid">
						{filteredProducts.map((product) => (
							<PurchaseProductCard
								key={product.id}
								product={product}
								cartQuantity={getCartQuantity(product.id)}
								pulse={pulseProductId === product.id}
								onAdd={onAddToCart}
							/>
						))}
					</div>
				) : (
					<div className="pos-empty-products">
						{noProductsReason === 'search' && <Search size={24} />}
						{noProductsReason === 'low-stock' && <Search size={24} />}
						{noProductsReason === 'category' && <ShoppingCart size={24} />}
						{noProductsReason === 'empty' && <CircleOff size={24} />}

						<p>
							{noProductsReason === 'search' && 'No products match your search'}
							{noProductsReason === 'low-stock' && 'No low-stock products match current filters'}
							{noProductsReason === 'category' && 'No products in this category'}
							{noProductsReason === 'empty' && 'No products available'}
						</p>
						<span>
							{noProductsReason === 'search' && 'Try another name, SKU, or barcode.'}
							{noProductsReason === 'low-stock' && 'Turn off low-stock-only mode or change search/category filters.'}
							{noProductsReason === 'category' && 'Switch category or add products to this category.'}
							{noProductsReason === 'empty' && 'Create products first to start purchasing.'}
						</span>
					</div>
				)}
			</div>
		</div>
	)
}
