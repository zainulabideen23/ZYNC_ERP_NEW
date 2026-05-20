const request = require('supertest');
const express = require('express');

const createThenableChain = (result, methods = []) => {
    const chain = {};
    methods.forEach((method) => {
        chain[method] = jest.fn(() => chain);
    });
    chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    chain.catch = (reject) => Promise.resolve(result).catch(reject);
    return chain;
};

const createFirstChain = (firstResult, methods = []) => {
    const chain = createThenableChain([], methods);
    chain.first = jest.fn().mockResolvedValue(firstResult);
    return chain;
};

// Mocks
const mockSaleServiceInstance = {
    createSale: jest.fn(),
};

const mockSaleReturnServiceInstance = {
    createReturn: jest.fn(),
    listReturns: jest.fn(),
    getReturnById: jest.fn(),
    getReturnPreview: jest.fn(),
};

// Mock SaleService constructor
const mockSaleServiceClass = jest.fn(() => mockSaleServiceInstance);
const mockSaleReturnServiceClass = jest.fn(() => mockSaleReturnServiceInstance);

jest.doMock('../src/services/sale.service', () => mockSaleServiceClass);
jest.doMock('../src/services/saleReturn.service', () => mockSaleReturnServiceClass);
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
        mockSaleServiceInstance.createSale.mockResolvedValue({
            id: 1,
            invoice_number: 'INV-000001',
            total_amount: 0,
            payment_status: 'paid'
        });
        mockSaleReturnServiceInstance.createReturn.mockResolvedValue({
            id: 'sr-1',
            return_number: 'SRN-000001',
            invoice_number: 'SRN-000001',
            original_sale_id: 1,
            total_amount: 100,
        });
        mockSaleReturnServiceInstance.listReturns.mockResolvedValue({
            data: [{ id: 'sr-1', return_number: 'SRN-000001' }],
            pagination: { page: 1, limit: 50, total: 1, pages: 1 },
        });
        mockSaleReturnServiceInstance.getReturnById.mockResolvedValue({
            id: 'sr-1',
            return_number: 'SRN-000001',
            items: [{ id: 'line-1', product_id: 1, quantity: 1 }],
        });
        mockSaleReturnServiceInstance.getReturnPreview.mockResolvedValue({
            returnAmount: 300,
            previousLedgerBalance: 500,
            applyToPreviousAmount: 300,
            cashRefundIfApplied: 0,
            cashRefundIfNotApplied: 300,
            needsChoice: true,
        });
        app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { id: 1, role: 'admin' };
            req.tenantId = 'tenant-1';
            next();
        });
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
        expect(mockSaleServiceInstance.createSale).toHaveBeenCalledWith(
            expect.objectContaining({
                items: saleData.items,
                paid_amount: 100
            }),
            1
        );
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

    it('SALE-002: Should create a sale return through legacy /return route', async () => {
        const res = await request(app)
            .post('/api/sales/return')
            .send({
                original_sale_id: 1,
                items: [{ product_id: 1, quantity: 1, unit_price: 100 }]
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.return_number).toBe('SRN-000001');
        expect(mockSaleReturnServiceInstance.createReturn).toHaveBeenCalledWith(
            1,
            expect.objectContaining({
                original_sale_id: 1,
                items: expect.any(Array),
                applyToPrevious: false,
            }),
            1
        );
    });

    it('SALE-008: Should return return-impact preview data', async () => {
        const res = await request(app)
            .post('/api/sales/1/return-preview')
            .send({
                items: [{ sale_item_id: 'line-1', quantity: 2 }],
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(
            expect.objectContaining({
                returnAmount: 300,
                previousLedgerBalance: 500,
                applyToPreviousAmount: 300,
                cashRefundIfNotApplied: 300,
                needsChoice: true,
            })
        );
        expect(mockSaleReturnServiceInstance.getReturnPreview).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({
                items: expect.any(Array),
            })
        );
    });

    it('SALE-009: Should pass applyToPrevious=true to return service', async () => {
        await request(app)
            .post('/api/sales/1/returns')
            .send({
                items: [{ sale_item_id: 'line-1', quantity: 1 }],
                applyToPrevious: true,
            });

        expect(mockSaleReturnServiceInstance.createReturn).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({
                applyToPrevious: true,
                items: expect.any(Array),
            }),
            1
        );
    });

    it('SALE-004: Should list sale returns', async () => {
        const res = await request(app)
            .get('/api/sales/returns');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(mockSaleReturnServiceInstance.listReturns).toHaveBeenCalled();
    });

    it('SALE-006: Should get single sale return by id', async () => {
        const res = await request(app)
            .get('/api/sales/returns/sr-1');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.return_number).toBe('SRN-000001');
        expect(mockSaleReturnServiceInstance.getReturnById).toHaveBeenCalledWith('sr-1');
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
        const validationError = new Error('At least one item is required');
        validationError.statusCode = 400;
        mockSaleServiceInstance.createSale.mockRejectedValue(validationError);

        const res = await request(app)
            .post('/api/sales')
            .send({ customer_id: 1, items: [] });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('At least one item is required');
    });

    it('SALE-007: Should aggregate core and legacy returned quantities in sale detail', async () => {
        const saleId = 'sale-1';

        const saleQuery = createFirstChain(
            {
                id: saleId,
                invoice_number: 'INV-000001',
                customer_name: 'Acme',
                customer_phone: null,
                customer_address: null,
                total_amount: 1000,
                returned_amount: 500,
                return_count: 2,
            },
            ['leftJoin', 'select', 'where']
        );

        const itemsQuery = createThenableChain(
            [{
                id: 'si-1',
                sale_id: saleId,
                product_id: 'p-1',
                quantity: 10,
                unit_price: 100,
                line_total: 1000,
                product_name: 'Test Product',
                product_code: 'T-001',
            }],
            ['join', 'leftJoin', 'select', 'where']
        );

        const coreItemReturnsQuery = createThenableChain(
            [{ original_sale_item_id: 'si-1', returned_qty: '2' }],
            ['join', 'where', 'whereNotNull', 'select', 'sum', 'groupBy']
        );

        const legacyItemReturnsQuery = createThenableChain(
            [{ sale_item_id: 'si-1', returned_qty: '3' }],
            ['join', 'where', 'select', 'sum', 'groupBy']
        );

        const subqueryChain = {
            select: jest.fn().mockReturnThis(),
            sum: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            as: jest.fn().mockReturnThis(),
        };

        mockDb.mockImplementation((table) => {
            if (table === 'sales as rs') return subqueryChain;
            if (table === 'sale_returns as sr') return subqueryChain;
            if (table === 'sales as s') return saleQuery;
            if (table === 'sale_items as si') return itemsQuery;
            if (table === 'sale_items as rsi') return coreItemReturnsQuery;
            if (table === 'sale_return_items as sri') return legacyItemReturnsQuery;

            return {
                where: jest.fn().mockReturnThis(),
                insert: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue([{ count: 0 }]),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockResolvedValue([]),
            };
        });

        const res = await request(app).get(`/api/sales/${saleId}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.returned_amount).toBe(500);
        expect(res.body.data.return_count).toBe(2);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].returned_quantity).toBe(5);
        expect(res.body.data.items[0].returnable_quantity).toBe(5);
    });
});
