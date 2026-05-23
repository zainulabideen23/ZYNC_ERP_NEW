const ProductService = require('../src/services/product.service');
const XLSX = require('xlsx');

describe('ProductService.importProducts', () => {
    let service;
    let mockDb;
    let mockTrx;

    function buildXlsxBuffer(rows) {
        const headers = ['Product Name', 'SKU', 'Barcode', 'Category', 'Brand', 'Unit', 'Cost Price', 'Retail Price', 'Wholesale Price', 'Tax Rate %', 'Opening Stock', 'Min Stock Level', 'Reorder Qty', 'Track Stock', 'Description'];
        const data = rows.map(r => [
            r.product_name || '', r.sku || '', r.barcode || '',
            r.category || '', r.brand || '', r.unit || '',
            String(r.cost_price ?? ''), String(r.retail_price ?? ''),
            String(r.wholesale_price ?? ''), String(r.tax_rate ?? ''),
            String(r.opening_stock ?? ''), String(r.min_stock_level ?? ''),
            String(r.reorder_qty ?? ''), String(r.track_stock ?? ''),
            r.description || ''
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    function setupMocks({ existingProducts = [], categories = [], brands = [], units = [] } = {}) {
        function makeChain(resolveValue) {
            const chain = {
                where: jest.fn(() => chain),
                andWhere: jest.fn(() => chain),
                orWhere: jest.fn(() => chain),
                select: jest.fn(() => chain),
                max: jest.fn(() => chain),
                first: jest.fn(() => chain),
                orderBy: jest.fn(() => chain),
                limit: jest.fn(() => chain),
                offset: jest.fn(() => chain),
                insert: jest.fn(() => chain),
                update: jest.fn(() => chain),
                del: jest.fn(() => chain),
                returning: jest.fn(() => chain),
                then: undefined,
            };
            const thenFn = (resolve) => Promise.resolve(resolveValue).then(resolve);
            chain.then = thenFn;
            chain.catch = (reject) => Promise.resolve(resolveValue).catch(reject);
            return chain;
        }

        const catChain = makeChain([{ id: 'new-cat', name: 'NewCat' }]);
        catChain.max = jest.fn(() => catChain);
        catChain.first = jest.fn().mockResolvedValue({ max: 10 });

        const brandChain = makeChain([{ id: 'new-brand', name: 'NewBrand' }]);

        const prodChain = makeChain([{ id: 'new-prod', code: 'TEST', name: 'Test Product', cost_price: 100 }]);

        const stockChain = makeChain([{ id: 'mov-1' }]);

        mockTrx = jest.fn((table) => {
            if (table === 'categories') return catChain;
            if (table === 'brands') return brandChain;
            if (table === 'products') return prodChain;
            if (table === 'stock_movements') return stockChain;
            return makeChain(null);
        });

        mockDb = jest.fn((table) => mockDb[table] || makeChain(null));
        mockDb.transaction = jest.fn(async (cb) => cb(mockTrx));
        mockDb.raw = jest.fn((str, bindings) => ({ __raw: true, str, bindings }));

        mockDb.products = makeChain(existingProducts.map(p => ({ code: p.code })));
        mockDb.categories = makeChain(categories);
        mockDb.brands = makeChain(brands);
        mockDb.units = makeChain(units);

        service = new ProductService(mockDb, 'tenant-1');
        service.stockService = {
            createMovement: jest.fn().mockResolvedValue({ id: 'mov-1' }),
        };
    }

    it('imports valid products successfully', async () => {
        setupMocks({
            categories: [{ id: 'cat-1', name: 'Electronics' }],
            brands: [{ id: 'brand-1', name: 'Samsung' }],
            units: [{ id: 'unit-1', name: 'Pieces', abbreviation: 'pcs' }],
        });

        const buffer = buildXlsxBuffer([
            { product_name: 'Galaxy S25', sku: 'S25-001', category: 'Electronics', brand: 'Samsung', unit: 'pcs', cost_price: 50000, retail_price: 65000, opening_stock: 10 },
            { product_name: 'Galaxy Buds', sku: 'BUDS-001', category: 'Electronics', brand: 'Samsung', unit: 'Pieces', cost_price: 8000, retail_price: 12000, track_stock: 'yes' },
        ]);

        const result = await service.importProducts(buffer, 'user-1');
        expect(result.imported).toBe(2);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
    });

    it('returns errors for invalid rows and skips them', async () => {
        setupMocks({
            categories: [{ id: 'cat-1', name: 'Electronics' }],
            units: [{ id: 'unit-1', name: 'Pieces', abbreviation: 'pcs' }],
        });

        const buffer = buildXlsxBuffer([
            { product_name: 'Valid', sku: 'VALID-01', category: 'Electronics', unit: 'pcs', cost_price: 100, retail_price: 150 },
            { product_name: '', sku: 'INVALID-01', category: 'Electronics', unit: 'pcs', cost_price: 100, retail_price: 150 },
            { product_name: 'Bad Price', sku: 'INVALID-02', category: 'Electronics', unit: 'pcs', cost_price: 200, retail_price: 100 },
            { product_name: 'No Unit', sku: 'INVALID-03', category: 'Electronics', unit: 'nonexistent', cost_price: 100, retail_price: 150 },
        ]);

        const result = await service.importProducts(buffer, 'user-1');
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(3);
        expect(result.errors).toHaveLength(3);
        // row 2: empty product name
        expect(result.errors[0].errors.some(e => /required/i.test(e))).toBe(true);
        // row 3: retail <= cost
        expect(result.errors[1].errors.some(e => /greater.*Cost/i.test(e))).toBe(true);
        // row 4: unit not found
        expect(result.errors[2].errors.some(e => /not found/i.test(e))).toBe(true);
    });

    it('rejects SKU duplicates within the file', async () => {
        setupMocks({ units: [{ id: 'unit-1', name: 'Pieces' }] });

        const buffer = buildXlsxBuffer([
            { product_name: 'Product A', sku: 'DUP-001', category: 'NewCat', unit: 'Pieces', cost_price: 100, retail_price: 150 },
            { product_name: 'Product B', sku: 'DUP-001', category: 'NewCat', unit: 'Pieces', cost_price: 100, retail_price: 150 },
        ]);

        const result = await service.importProducts(buffer, 'user-1');
        expect(result.imported).toBe(1);
        expect(result.errors[0].errors[0]).toMatch(/duplicate/i);
    });

    it('rejects SKU that already exists in DB', async () => {
        setupMocks({
            existingProducts: [{ code: 'EXISTING' }],
            units: [{ id: 'unit-1', name: 'Pieces' }],
        });

        const buffer = buildXlsxBuffer([
            { product_name: 'Duplicate', sku: 'EXISTING', category: 'NewCat', unit: 'Pieces', cost_price: 100, retail_price: 150 },
        ]);

        const result = await service.importProducts(buffer, 'user-1');
        expect(result.imported).toBe(0);
        expect(result.errors[0].errors[0]).toMatch(/already exists/i);
    });

    it('auto-creates categories and brands', async () => {
        setupMocks({ units: [{ id: 'unit-1', name: 'Pieces' }] });

        const buffer = buildXlsxBuffer([
            { product_name: 'New Product', sku: 'NEW-001', category: 'AutoCategory', brand: 'AutoBrand', unit: 'Pieces', cost_price: 100, retail_price: 150 },
        ]);

        const result = await service.importProducts(buffer, 'user-1');
        expect(result.imported).toBe(1);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects file with more than 2000 rows', async () => {
        setupMocks({ units: [{ id: 'unit-1', name: 'Pieces' }] });
        const rows = Array.from({ length: 2001 }, (_, i) => ({
            product_name: `Product ${i}`, sku: `SKU-${i}`, category: 'Cat', unit: 'Pieces', cost_price: 100, retail_price: 150
        }));
        const buffer = buildXlsxBuffer(rows);
        await expect(service.importProducts(buffer, 'user-1')).rejects.toThrow(/2000/);
    });
});
