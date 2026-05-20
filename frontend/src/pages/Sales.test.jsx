import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sales from './Sales'
import { salesAPI } from '../services/api'

vi.mock('../services/api', () => ({
    salesAPI: {
        list: vi.fn(),
        get: vi.fn(),
    },
}))

vi.mock('../utils/dataSync', () => ({
    DataSyncEvents: { SALE_CREATED: 'sale:created' },
    useDataSync: vi.fn(),
}))

vi.mock('../components/SaleDetailModal', () => ({
    default: () => null,
}))

function makeListResponse(status = 'confirmed') {
    return {
        data: [
            {
                id: 'sale-1',
                invoice_number: 'INV-000001',
                sale_date: '2026-03-01T10:00:00.000Z',
                customer_name: 'Acme Corp',
                total_amount: 1250,
                amount_paid: 250,
                amount_due: 1000,
                status,
            },
        ],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
        aggregates: {
            total_revenue: 1250,
            total_invoices: 1,
            total_paid: 250,
            total_due: 1000,
        },
    }
}

describe('Sales page', () => {
    it('renders confirmed sales with the Confirmed status badge', async () => {
        salesAPI.list.mockResolvedValue(makeListResponse('confirmed'))

        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(salesAPI.list).toHaveBeenCalled()
        }, { timeout: 3000 })

        expect(screen.getByText('#INV-000001')).toBeInTheDocument()
        expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    })

    it('passes confirmed filter to API when status filter changes', async () => {
        salesAPI.list.mockResolvedValue(makeListResponse('confirmed'))

        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(salesAPI.list).toHaveBeenCalled()
        }, { timeout: 3000 })

        const statusSelect = screen.getByDisplayValue('All Statuses')
        fireEvent.change(statusSelect, { target: { value: 'confirmed' } })

        await waitFor(() => {
            const lastCallArgs = salesAPI.list.mock.calls.at(-1)?.[0] || {}
            expect(lastCallArgs.status).toBe('confirmed')
        }, { timeout: 3000 })
    })
})
