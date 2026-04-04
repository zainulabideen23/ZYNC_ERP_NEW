const request = require('supertest');
const express = require('express');

const mockProductServiceInstance = {
    create: jest.fn()
};

const mockProductServiceClass = jest.fn(() => mockProductServiceInstance);

jest.doMock('../src/services/product.service', () => mockProductServiceClass);

jest.doMock('../src/middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
    },
    authorize: () => (_req, _res, next) => next()
}));

const mockDbChain = {
    insert: jest.fn().mockResolvedValue([1]),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null)
};

const mockDb = jest.fn(() => mockDbChain);
mockDb.raw = jest.fn();

jest.doMock('../src/config/database', () => mockDb);

const productRoutes = require('../src/routes/product.routes');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Inventory Module', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();

        app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { id: 1, role: 'admin' };
            req.tenantId = 'tenant-1';
            next();
        });
        app.use('/api/products', productRoutes);
        app.use(errorHandler);
    });

    it('INV-001: Should create a new product successfully', async () => {
        const newProduct = {
            name: 'Test Product',
            code: 'P-001',
            retail_price: 100,
            cost_price: 50
        };

        mockProductServiceInstance.create.mockResolvedValue({
            id: 1,
            ...newProduct
        });

        const res = await request(app)
            .post('/api/products')
            .send(newProduct);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.code).toBe('P-001');
        expect(mockProductServiceInstance.create).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Test Product',
                code: 'P-001'
            }),
            1
        );
    });

    it('INV-002: Should validate duplicate product code', async () => {
        const newProduct = {
            name: 'Duplicate Product',
            code: 'P-DUP',
            retail_price: 100,
            cost_price: 50
        };

        const duplicateError = new Error('Duplicate entry');
        duplicateError.code = '23505';
        duplicateError.detail = 'Key (code)=(P-DUP) already exists.';

        mockProductServiceInstance.create.mockRejectedValue(duplicateError);

        const res = await request(app)
            .post('/api/products')
            .send(newProduct);

        expect(res.statusCode).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Product code already exists');
    });
});
