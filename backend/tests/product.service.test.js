const ProductService = require('../src/services/product.service');

describe('ProductService.create — track_stock', () => {
    let service;
    let mockDb;
    let mockTrx;

    function makeMocks() {
        mockTrx = {
            products: {
                insert: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([{
                    id: 'prod-1', code: 'TEST-001', name: 'Test',
                    track_stock: true, is_active: true,
                }]),
            },
        };
        // make trx('products') return the mock chain
        mockTrx.products = jest.fn((table) => {
            if (table === 'products') return mockTrx.products;
        });
        // simpler: just make it a function that returns the chain
        const tableFn = jest.fn(() => ({
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
                id: 'prod-1', code: 'TEST-001', name: 'Test',
                track_stock: true, is_active: true,
            }]),
        }));
        mockTrx = jest.fn(tableFn);
        // make trx('products') work
        mockTrx.mockImplementation((table) => {
            if (table === 'products') {
                return {
                    insert: jest.fn().mockReturnThis(),
                    returning: jest.fn().mockResolvedValue([{
                        id: 'prod-1', code: 'TEST-001', name: 'Test',
                        track_stock: true, is_active: true,
                    }]),
                };
            }
            return { insert: jest.fn().mockReturnThis(), returning: jest.fn() };
        });

        mockDb = {
            transaction: jest.fn((cb) => cb(mockTrx)),
        };
    }

    beforeEach(() => {
        makeMocks();
        service = new ProductService(mockDb, 'tenant-1');
        // mock stockService.createMovement to no-op
        service.stockService.createMovement = jest.fn().mockResolvedValue({ id: 'mv-1' });
    });

    const basePayload = {
        code: 'TEST-001', name: 'Test', category_id: 'cat-1', unit_id: 'unit-1',
        cost_price: 50, retail_price: 100, tax_rate: 10,
    };

    it('stores track_stock=true when set to true', async () => {
        const product = await service.create({ ...basePayload, track_stock: true }, 'u-1');
        const insertArgs = mockTrx.mock.results[0].value.insert.mock.calls[0][0];
        expect(insertArgs.track_stock).toBe(true);
    });

    it('stores track_stock=false when set to false', async () => {
        const product = await service.create({ ...basePayload, track_stock: false }, 'u-1');
        const insertArgs = mockTrx.mock.results[0].value.insert.mock.calls[0][0];
        expect(insertArgs.track_stock).toBe(false);
    });

    it('coerces undefined track_stock to true (DB default)', async () => {
        const { track_stock, ...payload } = basePayload;
        await service.create(payload, 'u-1');
        const insertArgs = mockTrx.mock.results[0].value.insert.mock.calls[0][0];
        expect(insertArgs.track_stock).toBe(true);
    });

    it('coerces null track_stock to true', async () => {
        await service.create({ ...basePayload, track_stock: null }, 'u-1');
        const insertArgs = mockTrx.mock.results[0].value.insert.mock.calls[0][0];
        expect(insertArgs.track_stock).toBe(true);
    });

    it('coerces 0 to true (only literal false becomes false)', async () => {
        await service.create({ ...basePayload, track_stock: 0 }, 'u-1');
        const insertArgs = mockTrx.mock.results[0].value.insert.mock.calls[0][0];
        expect(insertArgs.track_stock).toBe(true);
    });

    it('does NOT pass is_active in insert — relies on DB default true', async () => {
        await service.create({ ...basePayload, is_active: false }, 'u-1');
        const insertArgs = mockTrx.mock.results[0].value.insert.mock.calls[0][0];
        expect(insertArgs).not.toHaveProperty('is_active');
    });

    it('creates opening stock movement when opening_stock > 0', async () => {
        await service.create({ ...basePayload, opening_stock: 10 }, 'u-1');
        expect(service.stockService.createMovement).toHaveBeenCalledWith(
            expect.objectContaining({
                movement_type: 'IN',
                reference_type: 'opening',
                quantity: 10,
            }),
            mockTrx
        );
    });

    it('does NOT create opening stock movement when opening_stock is 0', async () => {
        await service.create({ ...basePayload, opening_stock: 0 }, 'u-1');
        expect(service.stockService.createMovement).not.toHaveBeenCalled();
    });
});

describe('ProductService.update — track_stock & is_active', () => {
    let service;
    let mockDb;

    beforeEach(() => {
        mockDb = jest.fn();
        mockDb.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
                id: 'prod-1', code: 'TEST-001', name: 'Test',
                track_stock: true, is_active: true,
            }]),
        });
        service = new ProductService(mockDb, 'tenant-1');
    });

    const baseUpdate = {
        code: 'TEST-001', name: 'Updated', category_id: 'cat-1', unit_id: 'unit-1',
        cost_price: 60, retail_price: 120,
    };

    it('updates track_stock when explicitly set to false', async () => {
        await service.update('prod-1', { ...baseUpdate, track_stock: false }, 'u-1');
        const updateData = mockDb.mock.results[0].value.update.mock.calls[0][0];
        expect(updateData.track_stock).toBe(false);
    });

    it('updates track_stock when explicitly set to true', async () => {
        await service.update('prod-1', { ...baseUpdate, track_stock: true }, 'u-1');
        const updateData = mockDb.mock.results[0].value.update.mock.calls[0][0];
        expect(updateData.track_stock).toBe(true);
    });

    it('does NOT include track_stock in update when undefined', async () => {
        await service.update('prod-1', baseUpdate, 'u-1');
        const updateData = mockDb.mock.results[0].value.update.mock.calls[0][0];
        expect(updateData).not.toHaveProperty('track_stock');
    });

    it('updates is_active when explicitly set to false', async () => {
        await service.update('prod-1', { ...baseUpdate, is_active: false }, 'u-1');
        const updateData = mockDb.mock.results[0].value.update.mock.calls[0][0];
        expect(updateData.is_active).toBe(false);
    });

    it('updates is_active when explicitly set to true', async () => {
        await service.update('prod-1', { ...baseUpdate, is_active: true }, 'u-1');
        const updateData = mockDb.mock.results[0].value.update.mock.calls[0][0];
        expect(updateData.is_active).toBe(true);
    });

    it('does NOT include is_active in update when undefined', async () => {
        await service.update('prod-1', baseUpdate, 'u-1');
        const updateData = mockDb.mock.results[0].value.update.mock.calls[0][0];
        expect(updateData).not.toHaveProperty('is_active');
    });

    it('throws 404 when product not found', async () => {
        mockDb.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([]),
        });
        await expect(service.update('nonexistent', baseUpdate, 'u-1'))
            .rejects.toThrow('Product not found');
    });
});

describe('ProductService.getAll — active_only filtering', () => {
    let service;
    let dbFn;

    function makeChain() {
        const chain = {
            leftJoin: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            whereILike: jest.fn().mockReturnThis(),
            orWhereILike: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
            count: jest.fn().mockResolvedValue([{ count: '10' }]),
        };
        // Make chain thenable for `await query.orderBy(...).limit(...).offset(...)`
        chain.then = (resolve) => {
            resolve([]);
            return Promise.resolve([]);
        };
        return chain;
    }

    beforeEach(() => {
        dbFn = jest.fn(() => makeChain());
        service = new ProductService(dbFn, 'tenant-1');
    });

    it('adds is_active=true filter when active_only=true (default)', async () => {
        const chain = makeChain();
        dbFn.mockReturnValue(chain);

        await service.getAll({});

        // Called for both the main query and the count query
        const calls = chain.where.mock.calls.filter(
            ([col]) => col === 'p.is_active'
        );
        expect(calls.length).toBeGreaterThanOrEqual(1);
    });

    it('omits is_active filter when active_only=false', async () => {
        const chain = makeChain();
        dbFn.mockReturnValue(chain);

        await service.getAll({ active_only: false });

        const calls = chain.where.mock.calls.filter(
            ([col]) => col === 'p.is_active'
        );
        expect(calls).toHaveLength(0);
    });
});
