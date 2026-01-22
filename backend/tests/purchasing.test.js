const request = require('supertest');
const express = require('express');

// Mocks
const mockPurchaseServiceInstance = {
    createPurchase: jest.fn()
};

const mockPurchaseServiceClass = jest.fn(() => mockPurchaseServiceInstance);

jest.doMock('../src/services/purchase.service', () => mockPurchaseServiceClass);

// Auth Mock
jest.doMock('../src/middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
    },
    authorize: (...roles) => (req, res, next) => next()
}));

// DB Mock for Routes getters
const mockDb = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([])
}));
mockDb.raw = jest.fn();

jest.doMock('../src/config/database', () => mockDb);

const purchaseRoutes = require('../src/routes/purchase.routes');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Purchasing Module', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/purchases', purchaseRoutes);
        app.use(errorHandler);
    });

    it('PUR-001: Should create a purchase invoice successfully', async () => {
        const purchaseData = {
            supplier_id: 1,
            items: [{ product_id: 1, quantity: 100, unit_price: 50 }],
            payment_method: 'bank_transfer',
            paid_amount: 5000
        };

        const expectedResponse = {
            id: 1,
            invoice_number: 'PO-000001',
            total_amount: 5000,
            payment_status: 'paid'
        };

        mockPurchaseServiceInstance.createPurchase.mockResolvedValue(expectedResponse);

        const res = await request(app)
            .post('/api/purchases')
            .send(purchaseData);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.invoice_number).toBe('PO-000001');

        expect(mockPurchaseServiceInstance.createPurchase).toHaveBeenCalledWith(expect.objectContaining({
            supplier_id: 1,
            items: purchaseData.items,
            paid_amount: 5000
        }));
    });
});
