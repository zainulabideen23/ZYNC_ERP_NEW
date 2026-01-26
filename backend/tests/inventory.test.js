const request = require('supertest');
const express = require('express');

describe('Inventory Module', () => {
    let app;
    let mockDb, mockChain, mockFirst, mockUpdate, mockInsert, mockWhere, mockReturning;
    let mockSequenceService;

    beforeEach(() => {
        jest.resetModules();

        // Database Mocks
        mockFirst = jest.fn();
        mockUpdate = jest.fn();
        mockInsert = jest.fn(); // Insert returns chain or promise
        mockWhere = jest.fn();
        mockReturning = jest.fn();

        mockChain = {
            where: mockWhere,
            first: mockFirst,
            update: mockUpdate,
            insert: mockInsert,
            returning: mockReturning,
            leftJoin: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnValue([{ count: 0 }]),
            transaction: jest.fn((cb) => cb({}))
        };

        // Chaining setup
        mockWhere.mockReturnValue(mockChain);
        mockInsert.mockReturnValue(mockChain);
        mockUpdate.mockReturnValue(mockChain);
        mockReturning.mockReturnValue(mockChain);

        mockDb = jest.fn(() => mockChain);
        // Add transaction method to db object
        mockDb.transaction = jest.fn((cb) => cb({}));

        jest.doMock('../src/config/database', () => mockDb);

        // Sequence Service Mock
        mockSequenceService = {
            getNextSequenceValue: jest.fn().mockResolvedValue('P-001')
        };
        // Mock the Class constructor
        jest.doMock('../src/services/sequence.service', () => {
            return jest.fn(() => mockSequenceService);
        });

        // Auth Middleware Mock
        jest.doMock('../src/middleware/auth', () => ({
            authenticate: (req, res, next) => {
                req.user = { id: 1, role: 'admin' };
                next();
            },
            authorize: (...roles) => (req, res, next) => next()
        }));

        const productRoutes = require('../src/routes/product.routes');
        const { errorHandler } = require('../src/middleware/errorHandler');

        app = express();
        app.use(express.json());
        app.use('/api/products', productRoutes);
        app.use(errorHandler);
    });

    it('INV-001: Should create a new product successfully', async () => {
        const newProduct = {
            name: 'Test Product',
            retail_price: 100,
            cost_price: 50
        };

        // Mock Insert return
        mockInsert.mockReturnThis(); // needed for returning chaining? No, insert returns chain
        mockReturning.mockResolvedValue([{ id: 1, code: 'P-001', ...newProduct }]);

        const res = await request(app)
            .post('/api/products')
            .send(newProduct);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.code).toBe('P-001');
    });

    it('INV-002: Should validate duplicate product code', async () => {
        const newProduct = {
            name: 'Duplicate Product',
            code: 'P-DUP',
            retail_price: 100
        };

        const error = new Error('Duplicate entry');
        error.code = '23505';
        error.detail = 'Key (code)=(P-DUP) already exists.';

        // Mock Insert to fail
        // Since insert is chained with returning, we need insertion to return a promise that rejects
        // OR mockReturning to reject?
        // route: await db(...).insert(...).returning(...)

        // If we make Insert return the chain, then returning must be called.
        mockReturning.mockRejectedValue(error);

        const res = await request(app)
            .post('/api/products')
            .send(newProduct);

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toBe('Product code already exists');
    });
});
