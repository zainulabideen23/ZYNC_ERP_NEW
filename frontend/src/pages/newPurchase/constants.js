import { CreditCard, Landmark, Wallet } from 'lucide-react'

export const PAYMENT_METHODS = [
	{ id: 'cash', label: 'Cash', icon: Wallet },
	{ id: 'bank_transfer', label: 'Bank', icon: Landmark },
	{ id: 'credit', label: 'Credit', icon: CreditCard },
]
