import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from './cart.store'

const sampleProduct = {
    id: 'p1',
    name: 'USB Cable',
    code: 'SKU001',
    retail_price: 100,
    current_stock: 2,
}

describe('cart store', () => {
    beforeEach(() => {
        localStorage.clear()
        useCartStore.getState().clearCart()
    })

    it('addItem respects stock limit', () => {
        const firstAdd = useCartStore.getState().addItem(sampleProduct, [{ id: 'p1', current_stock: 1 }])
        const secondAdd = useCartStore.getState().addItem(sampleProduct, [{ id: 'p1', current_stock: 1 }])

        expect(firstAdd.success).toBe(true)
        expect(secondAdd.success).toBe(false)
        expect(useCartStore.getState().items[0].quantity).toBe(1)
    })

    it('updateQuantity enforces maxStock when provided', () => {
        useCartStore.getState().addItem(sampleProduct, [{ id: 'p1', current_stock: 5 }])

        const result = useCartStore.getState().updateQuantity('p1', 6, 5)
        expect(result.success).toBe(false)
        expect(useCartStore.getState().items[0].quantity).toBe(1)

        const ok = useCartStore.getState().updateQuantity('p1', 3, 5)
        expect(ok.success).toBe(true)
        expect(useCartStore.getState().items[0].quantity).toBe(3)
    })

    it('computes discount and total correctly', () => {
        useCartStore.getState().addItem(sampleProduct, [{ id: 'p1', current_stock: 10 }])
        useCartStore.getState().updateQuantity('p1', 2, 10)
        useCartStore.getState().setGlobalDiscount(10, 'percent')
        useCartStore.getState().setTaxRate(5)

        const state = useCartStore.getState()
        expect(state.getSubtotal()).toBe(200)
        expect(state.getDiscountAmount()).toBe(20)
        expect(state.getTaxAmount()).toBe(9)
        expect(state.getTotal()).toBe(189)
    })

    it('clearCart resets mutable state', () => {
        useCartStore.getState().addItem(sampleProduct, [{ id: 'p1', current_stock: 10 }])
        useCartStore.getState().setCustomer('c1', 'Walk-in')
        useCartStore.getState().setGlobalDiscount(50, 'amount')
        useCartStore.getState().setTaxRate(17)
        useCartStore.getState().setPaidAmount(1000)

        useCartStore.getState().clearCart()

        const state = useCartStore.getState()
        expect(state.items).toEqual([])
        expect(state.customerId).toBeNull()
        expect(state.customerName).toBeNull()
        expect(state.globalDiscount).toBe(0)
        expect(state.taxRate).toBe(0)
        expect(state.paidAmount).toBe(0)
    })
})
