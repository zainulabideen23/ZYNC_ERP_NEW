export default function PurchaseHero({ cartUnits, visibleProducts, lowStockCount }) {
	return (
		<section className="pos-hero">
			<div className="pos-hero-copy">
				<p className="pos-eyebrow">Procurement Workspace</p>
				<h1>New Purchase</h1>
				<p>Modern purchase desk for intake, payable balancing, and clean stock updates.</p>
			</div>

			<div className="pos-hero-metrics" aria-label="Purchase overview">
				<div className="pos-metric-card">
					<span>Order Units</span>
					<strong>{cartUnits}</strong>
				</div>
				<div className="pos-metric-card">
					<span>Visible Products</span>
					<strong>{visibleProducts}</strong>
				</div>
				<div className="pos-metric-card">
					<span>Low Stock</span>
					<strong>{lowStockCount}</strong>
				</div>
			</div>
		</section>
	)
}
