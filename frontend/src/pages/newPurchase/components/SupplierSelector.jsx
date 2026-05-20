import { useEffect, useMemo, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import { formatCurrency, getSupplierBalance, toNumber } from '../utils'

export default function SupplierSelector({ suppliers, selectedId, onSelect }) {
	const [menuOpen, setMenuOpen] = useState(false)
	const [query, setQuery] = useState('')
	const menuRef = useRef(null)

	const selectedSupplier = useMemo(
		() => suppliers.find((supplier) => String(supplier.id) === String(selectedId)),
		[suppliers, selectedId]
	)

	const filteredSuppliers = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		if (!normalizedQuery) return suppliers.slice(0, 12)

		return suppliers
			.filter((supplier) => {
				const name = String(supplier.name || '').toLowerCase()
				const phone = String(supplier.phone_number || '').toLowerCase()
				return name.includes(normalizedQuery) || phone.includes(normalizedQuery)
			})
			.slice(0, 12)
	}, [suppliers, query])

	useEffect(() => {
		const handlePointerDown = (event) => {
			if (menuRef.current && !menuRef.current.contains(event.target)) {
				setMenuOpen(false)
			}
		}

		document.addEventListener('mousedown', handlePointerDown)
		return () => document.removeEventListener('mousedown', handlePointerDown)
	}, [])

	return (
		<div className="pos-customer-wrap" ref={menuRef}>
			<button
				type="button"
				className="pos-customer-trigger"
				onClick={() => setMenuOpen((open) => !open)}
				aria-expanded={menuOpen}
				aria-haspopup="listbox"
				aria-label="Select supplier"
			>
				<span className="left">
					<UserRound size={16} />
					<span>{selectedSupplier?.name || 'Select Supplier'}</span>
				</span>
				<span className={`caret${menuOpen ? ' is-open' : ''}`}>▾</span>
			</button>

			{menuOpen && (
				<div className="pos-customer-menu">
					<input
						type="text"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search supplier by name or phone"
						aria-label="Search supplier"
					/>

					<ul role="listbox">
						{filteredSuppliers.map((supplier) => {
							const balance = getSupplierBalance(supplier)
							const creditLimit = toNumber(supplier.credit_limit)
							const usagePercent = creditLimit > 0 ? (balance / creditLimit) * 100 : null
							const nearLimit = usagePercent !== null && usagePercent >= 80

							return (
								<li key={supplier.id}>
									<button
										type="button"
										onClick={() => {
											onSelect(supplier.id)
											setMenuOpen(false)
											setQuery('')
										}}
									>
										<span className="name-wrap">
											<span>{supplier.name}</span>
											<small>Balance: {formatCurrency(balance)}</small>
											{nearLimit && <small className="purchase-credit-warning">Near credit limit</small>}
										</span>
										{String(supplier.id) === String(selectedId) && (
											<span className="selected">Selected</span>
										)}
									</button>
								</li>
							)
						})}

						{filteredSuppliers.length === 0 && (
							<li className="empty">No suppliers found</li>
						)}
					</ul>
				</div>
			)}
		</div>
	)
}
