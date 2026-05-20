describe('tenantQuery helpers', () => {
    let tdb;
    let tenantScope;
    let tInsert;
    let mockWhere;
    let mockInsert;
    let mockDb;

    beforeEach(() => {
        jest.resetModules();

        mockWhere = jest.fn().mockReturnValue('scoped-query');
        mockInsert = jest.fn().mockReturnValue('insert-query');
        mockDb = jest.fn(() => ({ where: mockWhere, insert: mockInsert }));

        jest.doMock('../src/config/database', () => mockDb);
        ({ tdb, tenantScope, tInsert } = require('../src/utils/tenantQuery'));
    });

    it('throws when tenant id is missing for tdb', () => {
        expect(() => tdb('products', null)).toThrow("tenantId is required for tenant-scoped query on 'products'");
    });

    it('applies tenant filter with default db executor', () => {
        const result = tdb('products', 'tenant-1');

        expect(mockDb).toHaveBeenCalledWith('products');
        expect(mockWhere).toHaveBeenCalledWith('products.tenant_id', 'tenant-1');
        expect(result).toBe('scoped-query');
    });

    it('uses transaction executor when provided', () => {
        const trxWhere = jest.fn().mockReturnValue('trx-scoped-query');
        const trx = jest.fn(() => ({ where: trxWhere }));

        const result = tdb('sales', 'tenant-2', trx);

        expect(trx).toHaveBeenCalledWith('sales');
        expect(trxWhere).toHaveBeenCalledWith('sales.tenant_id', 'tenant-2');
        expect(result).toBe('trx-scoped-query');
    });

    it('returns tenant scope payload', () => {
        expect(tenantScope('tenant-9')).toEqual({ tenant_id: 'tenant-9' });
    });

    it('throws when tenant id is missing for tenantScope', () => {
        expect(() => tenantScope()).toThrow('tenantId is required for tenantScope');
    });

    it('adds tenant id to insert payload object', () => {
        const payload = { name: 'Widget' };
        const result = tInsert('products', payload, 'tenant-1');

        expect(mockDb).toHaveBeenCalledWith('products');
        expect(mockInsert).toHaveBeenCalledWith({ name: 'Widget', tenant_id: 'tenant-1' });
        expect(payload).toEqual({ name: 'Widget' });
        expect(result).toBe('insert-query');
    });

    it('adds tenant id to all rows for array insert', () => {
        const payload = [{ name: 'A' }, { name: 'B' }];
        tInsert('products', payload, 'tenant-3');

        expect(mockInsert).toHaveBeenCalledWith([
            { name: 'A', tenant_id: 'tenant-3' },
            { name: 'B', tenant_id: 'tenant-3' },
        ]);
        expect(payload).toEqual([{ name: 'A' }, { name: 'B' }]);
    });

    it('throws when tenant id is missing for tInsert', () => {
        expect(() => tInsert('products', { name: 'A' })).toThrow(
            "tenantId is required for tenant-scoped insert on 'products'"
        );
    });
});