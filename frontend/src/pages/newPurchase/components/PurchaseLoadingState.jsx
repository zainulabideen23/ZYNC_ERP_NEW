import { ProductSkeletonGrid } from './PurchaseProductCard'

export default function PurchaseLoadingState({ draftLoading }) {
	return (
		<div className="pos-page purchase-pos-page">
			<div className="pos-shell">
				<section className="pos-products-panel">
					<header className="pos-panel-head">
						<div className="pos-panel-title">
							<h2>{draftLoading ? 'Loading Draft Purchase...' : 'Loading Purchase Data...'}</h2>
							<p>Please wait while data is prepared.</p>
						</div>
					</header>
					<div className="pos-products-scroll">
						<ProductSkeletonGrid />
					</div>
				</section>
			</div>
		</div>
	)
}
