import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Products from './Products'
import { productsAPI, categoriesAPI, suppliersAPI, unitsAPI, brandsAPI } from '../services/api'

// ── Mocks ──────────────────────────────────────────────

vi.mock('../services/api', () => ({
    productsAPI: { list: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn() },
    categoriesAPI: { list: vi.fn() },
    suppliersAPI: { list: vi.fn() },
    unitsAPI: { list: vi.fn() },
    brandsAPI: { list: vi.fn() },
}))

vi.mock('../utils/dataSync', () => ({
    DataSyncEvents: { PRODUCT_CREATED: 'product:created', PRODUCT_UPDATED: 'product:updated' },
    useDataSync: vi.fn(() => ({ publish: vi.fn() })),
}))

vi.mock('../store/auth.store', () => ({
    useAuthStore: vi.fn(() => ({ user: { role: 'admin', id: 'u-1' } })),
}))

vi.mock('../utils/permissions', () => ({
    can: vi.fn(() => true),
}))

vi.mock('../components/UnitSelector', () => ({
    default: ({ value, onChange, units, onUnitsChange, error }) => (
        <select
            data-testid="unit-selector"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'error' : ''}
        >
            <option value="">Select a Unit</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
    ),
}))

vi.mock('../components/CategorySelector', () => ({
    default: ({ value, onChange, categories, error }) => (
        <select
            data-testid="category-selector"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'error' : ''}
        >
            <option value="">Select a Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
    ),
}))

vi.mock('../components/BrandSelector', () => ({
    default: ({ value, onChange, brands }) => (
        <select
            data-testid="brand-selector"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">No Brand</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
    ),
}))

vi.mock('../hooks/useBarcodeScanner', () => ({
    useBarcodeScanner: vi.fn(),
}))

vi.mock('../components/PageLoader', () => ({
    default: () => <div data-testid="page-loader">Loading...</div>,
}))

// ── Helpers ────────────────────────────────────────────

function renderProducts() {
    return render(
        <MemoryRouter>
            <Products />
        </MemoryRouter>
    )
}

async function openCreateForm() {
    const addBtn = await screen.findByText(/add product|new product/i)
    fireEvent.click(addBtn)
    await screen.findByText('Basic Information')
}

// ── Test Data ──────────────────────────────────────────

const mockProduct = {
    id: 'prod-1',
    name: 'Test Product',
    code: 'TST-001',
    category_id: 'cat-1',
    unit_id: 'unit-1',
    brand_id: 'brand-1',
    cost_price: 50,
    retail_price: 100,
    track_stock: true,
    is_active: true,
}

const mockCategories = [{ id: 'cat-1', name: 'Electronics' }]
const mockUnits = [{ id: 'unit-1', name: 'Piece', abbreviation: 'pc' }]
const mockBrands = [{ id: 'brand-1', name: 'Sony' }]

beforeEach(() => {
    vi.clearAllMocks()
    productsAPI.list.mockResolvedValue({ data: [mockProduct] })
    categoriesAPI.list.mockResolvedValue({ data: mockCategories })
    unitsAPI.list.mockResolvedValue({ data: mockUnits })
    brandsAPI.list.mockResolvedValue({ data: mockBrands })
    suppliersAPI.list.mockResolvedValue({ data: [] })
    window.confirm = vi.fn(() => true)
})

// ── Tests: track_stock ─────────────────────────────────

describe('track_stock radio', () => {
    it('defaults to Yes (true) on create form', async () => {
        renderProducts()
        await openCreateForm()

        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(false)
    })

    it('selecting No sets track_stock to false', async () => {
        renderProducts()
        await openCreateForm()

        fireEvent.click(screen.getByLabelText('No'))

        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(false)
    })

    it('toggles back to Yes after selecting No', async () => {
        renderProducts()
        await openCreateForm()

        fireEvent.click(screen.getByLabelText('No'))
        fireEvent.click(screen.getByLabelText('Yes'))

        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(false)
    })

    it('sends track_stock: false in create payload when No is selected', async () => {
        productsAPI.create.mockResolvedValue({ data: { ...mockProduct, track_stock: false } })
        renderProducts()
        await openCreateForm()

        // Fill required fields
        fireEvent.change(screen.getByPlaceholderText('Enter full product name'), { target: { value: 'New Product' } })
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. ELE-MSE-001/), { target: { value: 'NEW-001' } })
        fireEvent.change(screen.getByTestId('category-selector'), { target: { value: 'cat-1' } })
        fireEvent.change(screen.getByTestId('unit-selector'), { target: { value: 'unit-1' } })
        fireEvent.change(screen.getByPlaceholderText(/enter or scan barcode|scan or enter barcode/i), { target: { value: '' } })
        const priceInputs = screen.getAllByPlaceholderText('0.00')
        fireEvent.change(priceInputs[0], { target: { value: '50' } })
        fireEvent.change(priceInputs[1], { target: { value: '100' } })

        // Select track_stock = No
        fireEvent.click(screen.getByLabelText('No'))

        // Submit
        const submitBtn = screen.getByText('Create Product')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(productsAPI.create).toHaveBeenCalled()
        })

        const payload = productsAPI.create.mock.calls[0][0]
        expect(payload.track_stock).toBe(false)
    })

    async function clickEdit() {
        const btn = screen.getByRole('button', { name: /edit test product/i })
        fireEvent.click(btn)
        await screen.findByText('Basic Information')
    }

    it('pre-populates from product data when editing (false)', async () => {
        const inactiveStockProduct = { ...mockProduct, track_stock: false }
        productsAPI.list.mockResolvedValue({ data: [inactiveStockProduct] })
        renderProducts()
        await screen.findByText('TST-001')

        await clickEdit()

        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(false)
    })

    it('pre-populates from product data when editing (true)', async () => {
        renderProducts()
        await screen.findByText('TST-001')

        await clickEdit()

        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(false)
    })
})

// ── Tests: is_active (Status) ──────────────────────────

describe('is_active (Status) radio', () => {
    it('defaults to Active (true) on create form', async () => {
        renderProducts()
        await openCreateForm()

        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Inactive' }).checked).toBe(false)
    })

    it('selecting Inactive sets is_active to false', async () => {
        renderProducts()
        await openCreateForm()

        fireEvent.click(screen.getByLabelText('Inactive'))

        expect(screen.getByRole('radio', { name: 'Inactive' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(false)
    })

    it('toggles back to Active after selecting Inactive', async () => {
        renderProducts()
        await openCreateForm()

        fireEvent.click(screen.getByLabelText('Inactive'))
        fireEvent.click(screen.getByLabelText('Active'))

        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Inactive' }).checked).toBe(false)
    })

    it('sends is_active: false in update payload when set to Inactive', async () => {
        productsAPI.create.mockResolvedValue({ data: mockProduct })
        renderProducts()
        await openCreateForm()

        // Fill required fields
        fireEvent.change(screen.getByPlaceholderText('Enter full product name'), { target: { value: 'New Product' } })
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. ELE-MSE-001/), { target: { value: 'NEW-002' } })
        fireEvent.change(screen.getByTestId('category-selector'), { target: { value: 'cat-1' } })
        fireEvent.change(screen.getByTestId('unit-selector'), { target: { value: 'unit-1' } })
        const priceInputs = screen.getAllByPlaceholderText('0.00')
        fireEvent.change(priceInputs[0], { target: { value: '50' } })
        fireEvent.change(priceInputs[1], { target: { value: '100' } })

        fireEvent.click(screen.getByLabelText('Inactive'))

        const submitBtn = screen.getByText('Create Product')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(productsAPI.create).toHaveBeenCalled()
        })

        const payload = productsAPI.create.mock.calls[0][0]
        expect(payload.is_active).toBe(false)
    })

    it('pre-populates from product data when editing (inactive)', async () => {
        const inactiveProduct = { ...mockProduct, is_active: false }
        productsAPI.list.mockResolvedValue({ data: [inactiveProduct] })
        renderProducts()
        await screen.findByText('TST-001')

        const btn = screen.getByRole('button', { name: /edit test product/i })
        fireEvent.click(btn)
        await screen.findByText('Basic Information')

        expect(screen.getByRole('radio', { name: 'Inactive' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(false)
    })
})

// ── Edge cases ─────────────────────────────────────────

describe('track_stock + is_active edge cases', () => {
    it('both radios maintain independent state', async () => {
        renderProducts()
        await openCreateForm()

        // Defaults
        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(true)

        // Switch both
        fireEvent.click(screen.getByLabelText('No'))
        fireEvent.click(screen.getByLabelText('Inactive'))

        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Inactive' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(false)
        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(false)
    })

    it('create payload includes both fields', async () => {
        productsAPI.create.mockResolvedValue({ data: mockProduct })
        renderProducts()
        await openCreateForm()

        fireEvent.change(screen.getByPlaceholderText('Enter full product name'), { target: { value: 'Edge Test' } })
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. ELE-MSE-001/), { target: { value: 'EDGE-001' } })
        fireEvent.change(screen.getByTestId('category-selector'), { target: { value: 'cat-1' } })
        fireEvent.change(screen.getByTestId('unit-selector'), { target: { value: 'unit-1' } })
        const priceInputs = screen.getAllByPlaceholderText('0.00')
        fireEvent.change(priceInputs[0], { target: { value: '50' } })
        fireEvent.change(priceInputs[1], { target: { value: '100' } })

        fireEvent.click(screen.getByLabelText('No'))
        fireEvent.click(screen.getByLabelText('Inactive'))

        const submitBtn = screen.getByText('Create Product')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(productsAPI.create).toHaveBeenCalled()
        })

        const payload = productsAPI.create.mock.calls[0][0]
        expect(payload).toHaveProperty('track_stock', false)
        expect(payload).toHaveProperty('is_active', false)
    })

    it('resetForm restores both to defaults', async () => {
        renderProducts()
        await openCreateForm()

        // Change both
        fireEvent.click(screen.getByLabelText('No'))
        fireEvent.click(screen.getByLabelText('Inactive'))
        expect(screen.getByRole('radio', { name: 'No' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Inactive' }).checked).toBe(true)

        // Cancel resets to defaults
        const cancelBtn = screen.getByText('Cancel')
        fireEvent.click(cancelBtn)

        // Reopen create form
        await openCreateForm()

        expect(screen.getByRole('radio', { name: 'Yes' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Active' }).checked).toBe(true)
    })
})
