import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
    persist(
        (set, get) => ({
            // State
            items: [],
            customerId: null,
            customerName: null,
            notes: '',
            globalDiscount: 0,
            globalDiscountType: 'amount', // 'amount' or 'percent'
            taxRate: 0,
            paymentMethod: 'cash',
            paidAmount: 0,
            quotationId: null,

            // Computed values
            getSubtotal: () => {
                return get().items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
            },

            getDiscountAmount: () => {
                const subtotal = get().getSubtotal()
                const { globalDiscount, globalDiscountType } = get()
                return globalDiscountType === 'percent'
                    ? (subtotal * globalDiscount / 100)
                    : globalDiscount
            },

            getTaxAmount: () => {
                const subtotal = get().getSubtotal()
                const discountAmount = get().getDiscountAmount()
                const { taxRate } = get()
                return (subtotal - discountAmount) * (taxRate / 100)
            },

            getTotal: () => {
                const subtotal = get().getSubtotal()
                const discountAmount = get().getDiscountAmount()
                const taxAmount = get().getTaxAmount()
                return subtotal - discountAmount + taxAmount
            },

            getBalance: () => {
                return get().getTotal() - get().paidAmount
            },

            getReturnToCustomer: () => {
                const balance = get().getBalance()
                return balance < 0 ? Math.abs(balance) : 0
            },

            // Actions
            addItem: (product, stockProducts = []) => {
                const items = get().items
                const existing = items.find(i => i.product_id === product.id)
                const currentQty = existing?.quantity || 0
                const productStock = stockProducts.find(p => p.id === product.id)?.current_stock || product.current_stock || 0

                // Stock validation
                if (productStock <= currentQty) {
                    return { success: false, message: `${product.name} is out of stock`, type: 'error' }
                }

                const newQty = currentQty + 1
                const remaining = productStock - newQty

                if (existing) {
                    set({
                        items: items.map(i =>
                            i.product_id === product.id
                                ? { ...i, quantity: newQty }
                                : i
                        )
                    })
                } else {
                    set({
                        items: [...items, {
                            product_id: product.id,
                            name: product.name,
                            code: product.code,
                            unit_price: product.retail_price,
                            quantity: 1,
                            discount_percent: 0,
                            discount_amount: 0,
                            tax_percent: 0,
                            max_stock: productStock
                        }]
                    })
                }

                // Return warning if low stock
                if (remaining > 0 && remaining <= 5) {
                    return { success: true, message: `Only ${remaining} left in stock`, type: 'warning' }
                }

                return { success: true }
            },

            updateQuantity: (productId, qty, maxStock) => {
                if (qty <= 0) {
                    set({ items: get().items.filter(i => i.product_id !== productId) })
                    return { success: true }
                }

                if (maxStock !== undefined && qty > maxStock) {
                    return { success: false, message: `Cannot exceed stock (${maxStock} available)`, type: 'error' }
                }

                set({
                    items: get().items.map(i =>
                        i.product_id === productId ? { ...i, quantity: qty } : i
                    )
                })
                return { success: true }
            },

            updateItemPrice: (productId, price) => {
                set({
                    items: get().items.map(i =>
                        i.product_id === productId ? { ...i, unit_price: price } : i
                    )
                })
            },

            updateItemDiscount: (productId, discountAmount, discountPercent = 0) => {
                set({
                    items: get().items.map(i =>
                        i.product_id === productId
                            ? { ...i, discount_amount: discountAmount, discount_percent: discountPercent }
                            : i
                    )
                })
            },

            removeItem: (productId) => {
                set({ items: get().items.filter(i => i.product_id !== productId) })
            },

            setCustomer: (customerId, customerName = null) => {
                set({ customerId, customerName })
            },

            setNotes: (notes) => set({ notes }),

            setGlobalDiscount: (discount, type = 'amount') => {
                set({ globalDiscount: discount, globalDiscountType: type })
            },

            setTaxRate: (rate) => set({ taxRate: rate }),

            setPaymentMethod: (method) => set({ paymentMethod: method }),

            setPaidAmount: (amount) => set({ paidAmount: amount }),

            setQuotationId: (id) => set({ quotationId: id }),

            // Load from quotation
            loadFromQuotation: (quotation) => {
                set({
                    quotationId: quotation.id,
                    customerId: quotation.customer_id,
                    customerName: quotation.customer_name,
                    items: quotation.items.map(item => ({
                        product_id: item.product_id,
                        name: item.product_name,
                        code: item.product_code,
                        unit_price: item.unit_price,
                        quantity: item.quantity,
                        discount_percent: item.discount_percent || 0,
                        discount_amount: item.discount_amount || 0,
                        tax_percent: item.tax_percent || 0
                    })),
                    notes: `Converted from Quotation ${quotation.quotation_number}. ${quotation.notes || ''}`,
                    globalDiscount: quotation.discount_amount || 0,
                    globalDiscountType: quotation.discount_type || 'amount',
                    taxRate: quotation.tax_rate || 0
                })
            },

            // Clear entire cart
            clearCart: () => set({
                items: [],
                customerId: null,
                customerName: null,
                notes: '',
                globalDiscount: 0,
                globalDiscountType: 'amount',
                taxRate: 0,
                paymentMethod: 'cash',
                paidAmount: 0,
                quotationId: null
            }),

            // Get sale data for API submission
            getSaleData: () => {
                const state = get()
                return {
                    customer_id: state.customerId || null,
                    sale_date: new Date().toISOString(),
                    items: state.items.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        line_discount: item.discount_amount || (item.unit_price * item.quantity * item.discount_percent / 100),
                        tax_rate: item.tax_percent || 0
                    })),
                    discount_amount: state.getDiscountAmount(),
                    discount_percentage: state.globalDiscountType === 'percent' ? state.globalDiscount : 0,
                    tax_amount: state.getTaxAmount(),
                    amount_paid: state.paidAmount,
                    payment_method: state.paymentMethod,
                    notes: state.notes || `Sale via POS - ${new Date().toLocaleString()}`
                }
            }
        }),
        {
            name: 'zync-cart',
            partialize: (state) => ({
                items: state.items,
                customerId: state.customerId,
                customerName: state.customerName,
                notes: state.notes,
                globalDiscount: state.globalDiscount,
                globalDiscountType: state.globalDiscountType,
                taxRate: state.taxRate,
                paymentMethod: state.paymentMethod,
                quotationId: state.quotationId
                // Note: paidAmount is NOT persisted (should reset on page reload)
            })
        }
    )
)
