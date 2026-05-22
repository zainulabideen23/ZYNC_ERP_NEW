import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Customers from './Customers'
import { customersAPI } from '../services/api'

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../services/api', () => ({
    customersAPI: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock('../store/auth.store', () => ({
    useAuthStore: vi.fn(() => ({ user: { role: 'admin', id: 'u-1' } })),
}))

vi.mock('../utils/permissions', () => ({
    can: vi.fn(() => true),
}))

const CUSTOMER_FIXTURES = [
    { id: 'c1', code: 'CUST-001', name: 'Alpha Corp', phone_number: '+923001234567', city: 'Karachi', credit_limit: 50000, current_balance: 12000, company_name: 'Alpha Corp Ltd', cnic_number: '', is_active: true, address_line1: 'Suite 1', address_line2: 'Floor 2', postal_code: '74000', email: 'a@b.com', phone_number_alt: '', province_state: 'Sindh', country: 'Pakistan', opening_balance: 0, account_id: 'a1' },
    { id: 'c2', code: 'CUST-002', name: 'Beta Store', phone_number: '+923001234568', city: 'Lahore', credit_limit: 25000, current_balance: 0, company_name: '', cnic_number: '42201-1234567-1', is_active: false, address_line1: 'Shop 5', address_line2: '', postal_code: '', email: '', phone_number_alt: '', province_state: 'Punjab', country: 'Pakistan', opening_balance: 0, account_id: 'a2' },
]

function renderPage() {
    return render(
        <MemoryRouter>
            <Customers />
        </MemoryRouter>
    )
}

describe('Customers page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the page header', async () => {
        customersAPI.list.mockResolvedValue({ data: [] })
        renderPage()
        expect(await screen.findByText('Customers')).toBeTruthy()
        expect(screen.getByText('Manage your customer database')).toBeTruthy()
    })

    it('renders metric cards with zeros when no customers', async () => {
        customersAPI.list.mockResolvedValue({ data: [] })
        renderPage()
        expect(await screen.findByText('Total Customers')).toBeTruthy()
        expect(screen.getByText('With Balance')).toBeTruthy()
        expect(screen.getByText('Total Receivable')).toBeTruthy()
    })

    it('shows empty state when no customers', async () => {
        customersAPI.list.mockResolvedValue({ data: [] })
        renderPage()
        expect(await screen.findByText('No customers found')).toBeTruthy()
    })

    it('renders customer rows from API', async () => {
        customersAPI.list.mockResolvedValue({ data: CUSTOMER_FIXTURES })
        renderPage()
        expect(await screen.findByText('Alpha Corp')).toBeTruthy()
        expect(screen.getByText('Beta Store')).toBeTruthy()
        expect(screen.getByText('CUST-001')).toBeTruthy()
        expect(screen.getByText('CUST-002')).toBeTruthy()
    })

    it('displays correct metric values', async () => {
        customersAPI.list.mockResolvedValue({ data: CUSTOMER_FIXTURES })
        renderPage()
        await screen.findByText('Alpha Corp')
        expect(screen.getByText('2')).toBeTruthy()
        expect(screen.getByText('1')).toBeTruthy()
        const formattedValues = screen.getAllByText('Rs. 12,000')
        expect(formattedValues.length).toBe(2)
    })

    it('shows credit limit column for admin', async () => {
        customersAPI.list.mockResolvedValue({ data: CUSTOMER_FIXTURES })
        renderPage()
        await screen.findByText('Alpha Corp')
        expect(screen.getByText('Credit Limit')).toBeTruthy()
        expect(screen.getByText('Rs. 50,000')).toBeTruthy()
    })

    it('shows delete button for admin on each row', async () => {
        customersAPI.list.mockResolvedValue({ data: CUSTOMER_FIXTURES })
        renderPage()
        await screen.findByText('Alpha Corp')
        const deleteButtons = screen.getAllByLabelText(/Delete/)
        expect(deleteButtons.length).toBe(2)
    })

    it('shows Edit button on each row', async () => {
        customersAPI.list.mockResolvedValue({ data: CUSTOMER_FIXTURES })
        renderPage()
        await screen.findByText('Alpha Corp')
        const editButtons = screen.getAllByText('Edit')
        expect(editButtons.length).toBe(2)
    })

    it('shows Ledger link on each row', async () => {
        customersAPI.list.mockResolvedValue({ data: CUSTOMER_FIXTURES })
        renderPage()
        await screen.findByText('Alpha Corp')
        const ledgerLinks = screen.getAllByText('Ledger')
        expect(ledgerLinks.length).toBe(2)
    })

    it('opens create modal on Add Customer click', async () => {
        customersAPI.list.mockResolvedValue({ data: [] })
        renderPage()
        await screen.findByText('Customers')
        const addBtn = screen.getByText('Add Customer')
        fireEvent.mouseDown(addBtn)
        fireEvent.mouseUp(addBtn)
        fireEvent.click(addBtn)
        expect(await screen.findByText('Name *')).toBeTruthy()
    })

    it('opens edit modal with customer data', async () => {
        customersAPI.list.mockResolvedValue({ data: [CUSTOMER_FIXTURES[0]] })
        renderPage()
        await screen.findByText('Alpha Corp')
        fireEvent.click(screen.getByText('Edit'))
        expect(screen.getByText('Edit Customer')).toBeTruthy()
        expect(screen.getByDisplayValue('Alpha Corp')).toBeTruthy()
        expect(screen.getByDisplayValue('+923001234567')).toBeTruthy()
        expect(screen.getByDisplayValue('Alpha Corp Ltd')).toBeTruthy()
    })

    it('submits create form and reloads', async () => {
        customersAPI.list.mockResolvedValue({ data: [] })
        customersAPI.create.mockResolvedValue({ data: { id: 'c3' } })
        renderPage()
        await screen.findByText('Customers')
        const addButtons = screen.getAllByText('Add Customer')
        fireEvent.click(addButtons[0])
        const inputs = screen.getAllByRole('textbox')
        fireEvent.change(inputs[1], { target: { value: 'New Co' } })
        fireEvent.change(inputs[4], { target: { value: '+923001234569' } })
        fireEvent.submit(screen.getByRole('button', { name: /Create/i }).closest('form'))
        await waitFor(() => expect(customersAPI.create).toHaveBeenCalled())
        expect(customersAPI.list).toHaveBeenCalledTimes(2)
    })

    it('confirms and executes delete', async () => {
        customersAPI.list.mockResolvedValue({ data: [CUSTOMER_FIXTURES[0]] })
        customersAPI.delete.mockResolvedValue({})
        renderPage()
        await screen.findByText('Alpha Corp')
        fireEvent.click(screen.getByLabelText('Delete Alpha Corp'))
        expect(screen.getByText('Delete Customer?')).toBeTruthy()
        fireEvent.click(screen.getByText('Delete'))
        await waitFor(() => expect(customersAPI.delete).toHaveBeenCalledWith('c1'))
    })

    it('cancels delete dialog', async () => {
        customersAPI.list.mockResolvedValue({ data: [CUSTOMER_FIXTURES[0]] })
        renderPage()
        await screen.findByText('Alpha Corp')
        fireEvent.click(screen.getByLabelText('Delete Alpha Corp'))
        fireEvent.click(screen.getByText('Cancel'))
        expect(screen.queryByText('Delete Customer?')).toBeNull()
    })

    it('supports inactive toggle in edit modal', async () => {
        customersAPI.list.mockResolvedValue({ data: [CUSTOMER_FIXTURES[1]] })
        renderPage()
        await screen.findByText('Beta Store')
        fireEvent.click(screen.getByText('Edit'))
        expect(screen.getByText('Inactive')).toBeTruthy()
        fireEvent.click(screen.getByLabelText('Toggle active status'))
        expect(screen.getByText('Active')).toBeTruthy()
    })

    it('submits edit form and reloads', async () => {
        customersAPI.list.mockResolvedValue({ data: [CUSTOMER_FIXTURES[0]] })
        customersAPI.update.mockResolvedValue({ data: { id: 'c1' } })
        renderPage()
        await screen.findByText('Alpha Corp')
        fireEvent.click(screen.getByText('Edit'))
        fireEvent.change(screen.getByDisplayValue('Alpha Corp'), { target: { value: 'Alpha Corp Updated' } })
        fireEvent.click(screen.getByText('Update'))
        await waitFor(() => expect(customersAPI.update).toHaveBeenCalled())
        expect(customersAPI.list).toHaveBeenCalledTimes(2)
    })
})
