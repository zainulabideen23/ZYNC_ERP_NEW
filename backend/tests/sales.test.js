const request = require('supertest');
const express = require('express');

// Mocks
const mockSaleServiceInstance = {
    createSale: jest.fn(),
    createSaleReturn: jest.fn()
};

// Mock SaleService constructor
const mockSaleServiceClass = jest.fn(() => mockSaleServiceInstance);

jest.doMock('../src/services/sale.service', () => mockSaleServiceClass);
jest.doMock('../src/middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
    },
    authorize: (...roles) => (req, res, next) => next()
}));

// We need to mock database too because routes use db directly for getters
// but we are testing POST / which uses service.
// However, the route file requires db.
const mockDb = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([])
}));
mockDb.raw = jest.fn();

jest.doMock('../src/config/database', () => mockDb);

const saleRoutes = require('../src/routes/sale.routes');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Sales Module', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/sales', saleRoutes);
        app.use(errorHandler);
    });

    it('SALE-001: Should process a valid cash sale', async () => {
        const saleData = {
            items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
            paid_amount: 100,
            payment_method: 'cash'
        };

        const expectedResponse = {
            id: 1,
            invoice_number: 'INV-000001',
            total_amount: 100,
            payment_status: 'paid'
        };

        mockSaleServiceInstance.createSale.mockResolvedValue(expectedResponse);

        const res = await request(app)
            .post('/api/sales')
            .send(saleData);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.invoice_number).toBe('INV-000001');
        expect(mockSaleServiceInstance.createSale).toHaveBeenCalledWith(expect.objectContaining({
            items: saleData.items,
            paid_amount: 100
        }));
    });

    it('SALE-003: Should reject Walk-in Customer Credit Sale (Service validated)', async () => {
        // Here we simulate the Service throwing the error we just implemented logic for.
        // In a unit test for the Route, we mock the service to throw.
        // (Integration test would verify the service logic logic, but here we test the API response).

        mockSaleServiceInstance.createSale.mockRejectedValue(new Error('Walk-in customers cannot have credit sales'));

        const saleData = {
            customer_id: null,
            items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
            paid_amount: 0 // Credit
        };

        const res = await request(app)
            .post('/api/sales')
            .send(saleData);

        expect(res.statusCode).toBe(500); // Or 400 if we map the error?
        // The default error handler maps unknown errors to 500. 
        // To get 400, the Service should throw AppError or we assert 500/check error message.
        // Let's check error message.
        expect(res.body.error).toBe('Walk-in customers cannot have credit sales');
    });

    it('SALE-002: Should process a valid sale return', async () => {
        const returnData = {
            original_sale_id: 1,
            items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
            notes: 'Customer return'
        };

        const expectedResponse = {
            id: 2,
            invoice_number: 'CN-000001',
            total_amount: -100,
            payment_status: 'returned'
        };

        mockSaleServiceInstance.createSaleReturn.mockResolvedValue(expectedResponse);

        const res = await request(app)
            .post('/api/sales/return')
            .send(returnData);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.invoice_number).toBe('CN-000001');
        expect(mockSaleServiceInstance.createSaleReturn).toHaveBeenCalledWith(expect.objectContaining({
            original_sale_id: 1,
            notes: 'Customer return'
        }));
    });

    it('SALE-005: Should reject sale when stock is insufficient (Service level)', async () => {
        mockSaleServiceInstance.createSale.mockRejectedValue(new Error('Insufficient stock for Test Product. Available: 0'));

        const saleData = {
            items: [{ product_id: 1, quantity: 5, unit_price: 100 }],
            paid_amount: 500
        };

        const res = await request(app)
            .post('/api/sales')
            .send(saleData);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Insufficient stock for Test Product. Available: 0');
    });

    it('Should validate missing items', async () => {
        const res = await request(app)
            .post('/api/sales')
            .send({ customer_id: 1, items: [] });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('At least one item is required');
    });

    it('SALE-006: Should handle overpayment and return change_amount', async () => {
        const saleData = {
            items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
            paid_amount: 150, // Overpayment
            payment_method: 'cash'
        };

        const expectedResponse = {
            id: 3,
            invoice_number: 'INV-000003',
            total_amount: 100,
            paid_amount: 100,
            change_amount: 50, // The change
            payment_status: 'paid'
        };

        mockSaleServiceInstance.createSale.mockResolvedValue(expectedResponse);

        const res = await request(app)
            .post('/api/sales')
            .send(saleData);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.change_amount).toBe(50);
        expect(res.body.data.payment_status).toBe('paid');
    });
});
