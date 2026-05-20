export const todayInputDate = () => new Date().toISOString().split('T')[0]

export const formatCurrency = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`

export const toNumber = (value) => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

export const getSupplierBalance = (supplier) => toNumber(
	supplier?.ledger_balance ?? supplier?.current_balance ?? 0
)

export const buildQuickAmounts = (total) => {
	const exact = Math.ceil(Number(total || 0))
	if (exact <= 0) return []

	return [
		exact,
		Math.ceil(exact / 100) * 100,
		Math.ceil(exact / 500) * 500,
		Math.ceil(exact / 1000) * 1000,
	]
		.filter((amount, index, all) => all.indexOf(amount) === index)
		.slice(0, 4)
}
