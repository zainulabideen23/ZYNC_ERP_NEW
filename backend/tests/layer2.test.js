/**
 * Layer 2 Reference Data — Unit Tests
 * 
 * Tests all features introduced in the Layer 2 fix:
 *   - Brands CRUD (brand.routes.js)
 *   - Units CRUD + quick-create (unit.routes.js)
 *   - Categories tree + depth enforcement + safe delete (category.routes.js)
 *   - Settings new fields + validation (settings.routes.js)
 *   - Product service brand_id support (product.service.js)
 */

const request = require('supertest');
const express = require('express');

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers to build a mock Knex chain
// ─────────────────────────────────────────────────────────────────────────────
function createMockDb() {
    const mockFirst = jest.fn();
    const mockUpdate = jest.fn();
    const mockInsert = jest.fn();
    const mockWhere = jest.fn();
    const mockReturning = jest.fn();
    const mockDel = jest.fn();
    const mockMax = jest.fn();
    const mockCount = jest.fn().mockResolvedValue([{ count: '0' }]);
    const mockWhereNot = jest.fn();
    const mockWhereRaw = jest.fn();
    const mockOrWhereRaw = jest.fn();
    const mockWhereIn = jest.fn();
    const mockSelect = jest.fn();
    const mockLeftJoin = jest.fn();
    const mockOrderBy = jest.fn();
    const mockLimit = jest.fn();
    const mockOffset = jest.fn();

    const chain = {
        where: mockWhere,
        whereNot: mockWhereNot,
        whereRaw: mockWhereRaw,
        orWhereRaw: mockOrWhereRaw,
        whereIn: mockWhereIn,
        first: mockFirst,
        update: mockUpdate,
        insert: mockInsert,
        returning: mockReturning,
        del: mockDel,
        max: mockMax,
        count: mockCount,
        select: mockSelect,
        leftJoin: mockLeftJoin,
        orderBy: mockOrderBy,
        limit: mockLimit,
        offset: mockOffset,
    };

    // Every chain method returns the chain (for fluent API)
    for (const key of Object.keys(chain)) {
        if (typeof chain[key] === 'function' && !chain[key].mockReturnValue) {
            // already a jest.fn
        }
        chain[key].mockReturnValue(chain);
    }

    // Specific overrides (MUST come after the loop so they aren't clobbered)
    mockFirst.mockResolvedValue(null);
    mockReturning.mockResolvedValue([]);
    mockDel.mockResolvedValue(1);
    mockCount.mockResolvedValue([{ count: '0' }]);

    // Make chain "thenable" so `await chain` resolves to test data.
    // This is critical when the route does:
    //   let q = db(table).where(...).orderBy(...);
    //   q = q.where(...);
    //   const rows = await q;   // ← needs chain to be awaitable
    let _chainResolveData = [];
    chain.then = function (resolve, reject) {
        return Promise.resolve(_chainResolveData).then(resolve, reject);
    };
    const setChainData = (data) => { _chainResolveData = data; };

    const mockDb = jest.fn(() => chain);
    mockDb.fn = { now: jest.fn().mockReturnValue('NOW()') };
    mockDb.transaction = jest.fn(async (cb) => cb(mockDb));

    return {
        mockDb,
        chain,
        mockFirst,
        mockUpdate,
        mockInsert,
        mockWhere,
        mockReturning,
        mockDel,
        mockMax,
        mockCount,
        mockWhereNot,
        mockWhereRaw,
        mockOrWhereRaw,
        mockWhereIn,
        mockSelect,
        mockLeftJoin,
        mockOrderBy,
        setChainData,
    };
}

function buildApp(routePath, routes) {
    const { errorHandler } = require('../src/middleware/errorHandler');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = req.user || { id: 'u1', role: 'admin' };
        req.tenantId = req.tenantId || 'tenant-1';
        next();
    });
    app.use(routePath, routes);
    app.use(errorHandler);
    return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. BRAND ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
describe('Brand Routes (/api/brands)', () => {
    let app, mocks;

    beforeEach(() => {
        jest.resetModules();
        mocks = createMockDb();

        jest.doMock('../src/config/database', () => mocks.mockDb);
        jest.doMock('../src/middleware/auth', () => ({
            authenticate: (req, _res, next) => {
                req.user = { id: 'u1', role: 'admin' };
                req.tenantId = 'tenant-1';
                next();
            },
            authorize: () => (_req, _res, next) => next(),
        }));
        jest.doMock('../src/utils/audit', () => jest.fn().mockResolvedValue(undefined));

        app = buildApp('/api/brands', require('../src/routes/brand.routes'));
    });

    // ── GET ───────────────────────────────────────────────────────────────────
    it('BRAND-001: GET /api/brands returns active brands for tenant', async () => {
        const fakeBrands = [{ id: 1, name: 'Samsung' }, { id: 2, name: 'Apple' }];
        mocks.setChainData(fakeBrands);

        const res = await request(app).get('/api/brands');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(fakeBrands);
    });

    // ── POST ──────────────────────────────────────────────────────────────────
    it('BRAND-002: POST /api/brands creates a brand successfully', async () => {
        const newBrand = { id: 10, name: 'Sony' };
        mocks.mockReturning.mockResolvedValue([newBrand]);

        const res = await request(app)
            .post('/api/brands')
            .send({ name: 'Sony' });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.name).toBe('Sony');
    });

    it('BRAND-003: POST /api/brands rejects missing name', async () => {
        const res = await request(app)
            .post('/api/brands')
            .send({});

        expect(res.statusCode).toBe(400);
    });

    it('BRAND-004: POST /api/brands returns 409 on duplicate', async () => {
        const err = new Error('dup');
        err.code = '23505';
        mocks.mockReturning.mockRejectedValue(err);

        const res = await request(app)
            .post('/api/brands')
            .send({ name: 'Dup' });

        expect(res.statusCode).toBe(409);
    });

    // ── PUT ───────────────────────────────────────────────────────────────────
    it('BRAND-005: PUT /api/brands/:id updates a brand', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'Old' });
        mocks.mockReturning.mockResolvedValue([{ id: 1, name: 'New' }]);

        const res = await request(app)
            .put('/api/brands/1')
            .send({ name: 'New' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe('New');
    });

    it('BRAND-006: PUT /api/brands/:id returns 404 for missing brand', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/brands/999')
            .send({ name: 'X' });

        expect(res.statusCode).toBe(404);
    });

    // ── DELETE ─────────────────────────────────────────────────────────────────
    it('BRAND-007: DELETE /api/brands/:id deletes brand with no products', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'Test' });
        mocks.mockCount.mockResolvedValue([{ count: '0' }]);

        const res = await request(app).delete('/api/brands/1');
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain('deleted');
    });

    it('BRAND-008: DELETE /api/brands/:id returns 409 when products use brand', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'InUse' });
        mocks.mockCount.mockResolvedValue([{ count: '5' }]);

        const res = await request(app).delete('/api/brands/1');
        expect(res.statusCode).toBe(409);
    });

    it('BRAND-009: DELETE /api/brands/:id returns 404 for missing brand', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app).delete('/api/brands/999');
        expect(res.statusCode).toBe(404);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 2. UNIT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
describe('Unit Routes (/api/units)', () => {
    let app, mocks;

    beforeEach(() => {
        jest.resetModules();
        mocks = createMockDb();

        jest.doMock('../src/config/database', () => mocks.mockDb);
        jest.doMock('../src/middleware/auth', () => ({
            authenticate: (req, _res, next) => {
                req.user = { id: 'u1', role: 'admin' };
                req.tenantId = 'tenant-1';
                next();
            },
            authorize: () => (_req, _res, next) => next(),
        }));
        jest.doMock('../src/utils/audit', () => jest.fn().mockResolvedValue(undefined));

        app = buildApp('/api/units', require('../src/routes/unit.routes'));
    });

    // ── GET ───────────────────────────────────────────────────────────────────
    it('UNIT-001: GET /api/units returns active units', async () => {
        const fakeUnits = [{ id: 1, name: 'Piece', abbreviation: 'pc' }];
        mocks.setChainData(fakeUnits);

        const res = await request(app).get('/api/units');
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toEqual(fakeUnits);
    });

    // ── POST ──────────────────────────────────────────────────────────────────
    it('UNIT-002: POST /api/units creates a unit', async () => {
        mocks.mockFirst.mockResolvedValue(null); // no existing
        mocks.mockReturning.mockResolvedValue([{ id: 1, name: 'Kilogram', abbreviation: 'kg' }]);

        const res = await request(app)
            .post('/api/units')
            .send({ name: 'Kilogram', abbreviation: 'kg' });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.abbreviation).toBe('kg');
    });

    it('UNIT-003: POST /api/units rejects missing name', async () => {
        const res = await request(app)
            .post('/api/units')
            .send({ abbreviation: 'x' });

        expect(res.statusCode).toBe(400);
    });

    it('UNIT-004: POST /api/units rejects missing abbreviation', async () => {
        const res = await request(app)
            .post('/api/units')
            .send({ name: 'Test' });

        expect(res.statusCode).toBe(400);
    });

    it('UNIT-005: POST /api/units rejects duplicate name/abbreviation', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 99, name: 'Piece' }); // existing

        const res = await request(app)
            .post('/api/units')
            .send({ name: 'Piece', abbreviation: 'pc' });

        expect(res.statusCode).toBe(409);
    });

    // ── QUICK-CREATE ──────────────────────────────────────────────────────────
    it('UNIT-006: POST /api/units/quick-create creates lightweight unit', async () => {
        mocks.mockFirst.mockResolvedValue(null);
        mocks.mockReturning.mockResolvedValue([{ id: 2, name: 'Meter', abbreviation: 'm' }]);

        const res = await request(app)
            .post('/api/units/quick-create')
            .send({ name: 'Meter', abbreviation: 'm' });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.name).toBe('Meter');
    });

    it('UNIT-007: POST /api/units/quick-create rejects short name', async () => {
        const res = await request(app)
            .post('/api/units/quick-create')
            .send({ name: 'M', abbreviation: 'm' });

        expect(res.statusCode).toBe(400);
    });

    // ── PUT ───────────────────────────────────────────────────────────────────
    it('UNIT-008: PUT /api/units/:id updates a unit', async () => {
        // First call: find existing unit
        mocks.mockFirst
            .mockResolvedValueOnce({ id: 1, name: 'Old', abbreviation: 'ol' })
            .mockResolvedValueOnce(null); // no duplicate
        mocks.mockReturning.mockResolvedValue([{ id: 1, name: 'New', abbreviation: 'nw' }]);

        const res = await request(app)
            .put('/api/units/1')
            .send({ name: 'New', abbreviation: 'nw' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe('New');
    });

    it('UNIT-009: PUT /api/units/:id returns 404 for missing unit', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/units/999')
            .send({ name: 'X' });

        expect(res.statusCode).toBe(404);
    });

    // ── DELETE ─────────────────────────────────────────────────────────────────
    it('UNIT-010: DELETE /api/units/:id deactivates unit with no products', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'Piece' });
        mocks.mockCount.mockResolvedValue([{ count: '0' }]);

        const res = await request(app).delete('/api/units/1');
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain('deactivated');
    });

    it('UNIT-011: DELETE /api/units/:id returns 409 when products use unit', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'Piece' });
        mocks.mockCount.mockResolvedValue([{ count: '3' }]);

        const res = await request(app).delete('/api/units/1');
        expect(res.statusCode).toBe(409);
        expect(res.body.product_count).toBe(3);
    });

    it('UNIT-012: DELETE /api/units/:id returns 404 for missing unit', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app).delete('/api/units/999');
        expect(res.statusCode).toBe(404);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. CATEGORY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
describe('Category Routes (/api/categories)', () => {
    let app, mocks;

    beforeEach(() => {
        jest.resetModules();
        mocks = createMockDb();

        jest.doMock('../src/config/database', () => mocks.mockDb);
        jest.doMock('../src/middleware/auth', () => ({
            authenticate: (req, _res, next) => {
                req.user = { id: 'u1', role: 'admin' };
                req.tenantId = 'tenant-1';
                next();
            },
            authorize: () => (_req, _res, next) => next(),
        }));
        jest.doMock('../src/utils/audit', () => jest.fn().mockResolvedValue(undefined));

        app = buildApp('/api/categories', require('../src/routes/category.routes'));
    });

    // ── GET (tree) ────────────────────────────────────────────────────────────
    it('CAT-001: GET /api/categories returns nested tree', async () => {
        const flat = [
            { id: 1, name: 'Electronics', parent_id: null, is_active: true, sequence_order: 10 },
            { id: 2, name: 'Phones', parent_id: 1, is_active: true, sequence_order: 20 },
            { id: 3, name: 'Clothing', parent_id: null, is_active: true, sequence_order: 30 },
        ];
        // The chain is thenable — set what `await chain` resolves to
        mocks.setChainData(flat);

        const res = await request(app).get('/api/categories');
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(2); // Electronics, Clothing (top-level)
        const electronics = res.body.data.find(c => c.name === 'Electronics');
        expect(electronics.children).toHaveLength(1);
        expect(electronics.children[0].name).toBe('Phones');
    });

    it('CAT-002: GET /api/categories?flat=true returns flat list', async () => {
        const flat = [{ id: 1, name: 'Test', parent_id: null }];
        mocks.setChainData(flat);

        const res = await request(app).get('/api/categories?flat=true');
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toEqual(flat);
    });

    // ── POST ──────────────────────────────────────────────────────────────────
    it('CAT-003: POST /api/categories creates top-level category', async () => {
        mocks.mockFirst.mockResolvedValue({ max: 20 }); // max sequence
        mocks.mockReturning.mockResolvedValue([{ id: 5, name: 'Food', parent_id: null }]);

        const res = await request(app)
            .post('/api/categories')
            .send({ name: 'Food' });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.name).toBe('Food');
    });

    it('CAT-004: POST /api/categories creates subcategory under parent', async () => {
        // First call: find parent (no parent_id = top-level)
        mocks.mockFirst
            .mockResolvedValueOnce({ id: 1, name: 'Electronics', parent_id: null }) // parent lookup
            .mockResolvedValueOnce({ max: 30 }); // max sequence
        mocks.mockReturning.mockResolvedValue([{ id: 6, name: 'Laptops', parent_id: 1 }]);

        const res = await request(app)
            .post('/api/categories')
            .send({ name: 'Laptops', parent_id: 1 });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.parent_id).toBe(1);
    });

    it('CAT-005: POST /api/categories rejects depth > 2 (subcategory of subcategory)', async () => {
        // Parent already has a parent_id → depth would be 3
        mocks.mockFirst.mockResolvedValue({ id: 2, name: 'Phones', parent_id: 1 });

        const res = await request(app)
            .post('/api/categories')
            .send({ name: 'iPhones', parent_id: 2 });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('depth');
    });

    it('CAT-006: POST /api/categories rejects missing name', async () => {
        const res = await request(app)
            .post('/api/categories')
            .send({});

        expect(res.statusCode).toBe(400);
    });

    it('CAT-007: POST /api/categories rejects invalid parent_id', async () => {
        mocks.mockFirst.mockResolvedValue(null); // parent not found

        const res = await request(app)
            .post('/api/categories')
            .send({ name: 'Test', parent_id: 999 });

        expect(res.statusCode).toBe(404);
    });

    // ── PUT ───────────────────────────────────────────────────────────────────
    it('CAT-008: PUT /api/categories/:id updates a category', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'Old', is_active: true });
        mocks.mockReturning.mockResolvedValue([{ id: 1, name: 'Updated', is_active: true }]);

        const res = await request(app)
            .put('/api/categories/1')
            .send({ name: 'Updated' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe('Updated');
    });

    it('CAT-009: PUT /api/categories/:id returns 404 for missing category', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/categories/999')
            .send({ name: 'X' });

        expect(res.statusCode).toBe(404);
    });

    // ── DELETE (safe cascade) ─────────────────────────────────────────────────
    it('CAT-010: DELETE /api/categories/:id deletes category with no products', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'Empty' });
        mocks.mockCount.mockResolvedValue([{ count: '0' }]);
        // subcats query — select returns the chain; we need the await to resolve to []
        mocks.chain.select.mockResolvedValueOnce([]);

        const res = await request(app).delete('/api/categories/1');
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain('deleted');
    });

    it('CAT-011: DELETE /api/categories/:id returns 409 when category has products', async () => {
        mocks.mockFirst.mockResolvedValue({ id: 1, name: 'InUse' });
        mocks.mockCount.mockResolvedValue([{ count: '3' }]);

        const res = await request(app).delete('/api/categories/1');
        expect(res.statusCode).toBe(409);
    });

    it('CAT-012: DELETE /api/categories/:id returns 404 for missing category', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app).delete('/api/categories/999');
        expect(res.statusCode).toBe(404);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 4. SETTINGS ROUTES — new fields & validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('Settings Routes (/api/settings)', () => {
    let app, mocks;

    beforeEach(() => {
        jest.resetModules();
        mocks = createMockDb();

        jest.doMock('../src/config/database', () => mocks.mockDb);
        jest.doMock('../src/middleware/auth', () => ({
            authenticate: (req, _res, next) => {
                req.user = { id: 'u1', role: 'admin' };
                req.tenantId = 'tenant-1';
                next();
            },
            authorize: () => (_req, _res, next) => next(),
        }));
        jest.doMock('../src/utils/audit', () => jest.fn().mockResolvedValue(undefined));

        // Settings routes expect authenticate at the app.use() level (not per-route)
        const { errorHandler } = require('../src/middleware/errorHandler');
        app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { id: 'u1', role: 'admin' };
            req.tenantId = 'tenant-1';
            next();
        });
        app.use('/api/settings', require('../src/routes/settings.routes'));
        app.use(errorHandler);
    });

    // ── GET ───────────────────────────────────────────────────────────────────
    it('SETTINGS-001: GET /api/settings/company-info returns bank & branding fields', async () => {
        mocks.mockFirst.mockResolvedValue({
            company_name: 'TestCo',
            tax_id: '1234567',
            strn_number: '1234567890123',
            phone_number: '042-111',
            email: 'a@b.com',
            website: 'web.com',
            city: 'Lahore',
            address_line1: '123 St',
            address_line2: null,
            province_state: 'Punjab',
            postal_code: '54000',
            country: 'PK',
            financial_year_start: 7,
            financial_year_end: 6,
            default_currency: 'PKR',
            registration_number: null,
            default_tax_rate: 17,
            logo_url: 'https://img.co/logo.png',
            bank_name: 'HBL',
            bank_account_number: '001122',
            bank_iban: 'PK00HBL001122',
            bank_branch_code: '0001',
        });

        const res = await request(app).get('/api/settings/company-info');
        expect(res.statusCode).toBe(200);
        expect(res.body.data.logo_url).toBe('https://img.co/logo.png');
        expect(res.body.data.bank_name).toBe('HBL');
        expect(res.body.data.bank_iban).toBe('PK00HBL001122');
        expect(res.body.data.bank_account_number).toBe('001122');
        expect(res.body.data.bank_branch_code).toBe('0001');
    });

    it('SETTINGS-002: GET /api/settings/company-info returns empty obj when no row', async () => {
        mocks.mockFirst.mockResolvedValue(null);

        const res = await request(app).get('/api/settings/company-info');
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toEqual({});
    });

    // ── PUT — validation ──────────────────────────────────────────────────────
    it('SETTINGS-003: PUT rejects invalid NTN (not 7 digits)', async () => {
        const res = await request(app)
            .put('/api/settings/company-info')
            .send({ ntn_number: '123' }); // only 3 digits

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('NTN');
    });

    it('SETTINGS-004: PUT rejects invalid STRN (not 13 digits)', async () => {
        const res = await request(app)
            .put('/api/settings/company-info')
            .send({ strn_number: '1234' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('STRN');
    });

    it('SETTINGS-005: PUT rejects invalid email format', async () => {
        const res = await request(app)
            .put('/api/settings/company-info')
            .send({ email: 'not-an-email' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('email');
    });

    it('SETTINGS-006: PUT accepts valid NTN', async () => {
        // Need to mock the read-back
        mocks.mockFirst
            .mockResolvedValueOnce({ company_name: 'X', tax_id: '1234567' }) // old row
            .mockResolvedValueOnce({
                company_name: 'X', tax_id: '1234567', strn_number: null,
                phone_number: null, email: null, website: null, city: null,
                address_line1: null, address_line2: null, province_state: null,
                postal_code: null, country: null, financial_year_start: 7,
                financial_year_end: 6, default_currency: 'PKR',
                registration_number: null, default_tax_rate: 0,
                logo_url: null, bank_name: null, bank_account_number: null,
                bank_iban: null, bank_branch_code: null
            }); // updated row

        const res = await request(app)
            .put('/api/settings/company-info')
            .send({ ntn_number: '1234567' });

        expect(res.statusCode).toBe(200);
    });

    it('SETTINGS-007: PUT accepts bank fields', async () => {
        mocks.mockFirst
            .mockResolvedValueOnce({ company_name: 'X' }) // old row
            .mockResolvedValueOnce({
                company_name: 'X', tax_id: null, strn_number: null,
                phone_number: null, email: null, website: null, city: null,
                address_line1: null, address_line2: null, province_state: null,
                postal_code: null, country: null, financial_year_start: 7,
                financial_year_end: 6, default_currency: 'PKR',
                registration_number: null, default_tax_rate: 0,
                logo_url: null, bank_name: 'HBL', bank_account_number: '1234',
                bank_iban: 'PK00HBL1234', bank_branch_code: '0001'
            });

        const res = await request(app)
            .put('/api/settings/company-info')
            .send({
                bank_name: 'HBL',
                bank_account_number: '1234',
                bank_iban: 'PK00HBL1234',
                bank_branch_code: '0001'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.bank_name).toBe('HBL');
    });

    it('SETTINGS-008: PUT allows empty NTN (clears the field)', async () => {
        mocks.mockFirst
            .mockResolvedValueOnce({ company_name: 'X', tax_id: '1234567' })
            .mockResolvedValueOnce({
                company_name: 'X', tax_id: '', strn_number: null,
                phone_number: null, email: null, website: null, city: null,
                address_line1: null, address_line2: null, province_state: null,
                postal_code: null, country: null, financial_year_start: 7,
                financial_year_end: 6, default_currency: 'PKR',
                registration_number: null, default_tax_rate: 0,
                logo_url: null, bank_name: null, bank_account_number: null,
                bank_iban: null, bank_branch_code: null
            });

        const res = await request(app)
            .put('/api/settings/company-info')
            .send({ ntn_number: '' });

        expect(res.statusCode).toBe(200);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 5. PRODUCT SERVICE — brand_id support
// ═══════════════════════════════════════════════════════════════════════════════
describe('Product Service — brand_id integration', () => {
    let ProductService, mocks;

    beforeEach(() => {
        jest.resetModules();
        mocks = createMockDb();

        jest.doMock('../src/config/database', () => mocks.mockDb);
        jest.doMock('../src/services/sequence.service', () => {
            return jest.fn(() => ({
                getNextSequenceValue: jest.fn().mockResolvedValue('P-001'),
            }));
        });

        ProductService = require('../src/services/product.service');
    });

    it('PROD-001: getAll() includes brand_name via LEFT JOIN', async () => {
        const svc = new ProductService(mocks.mockDb, 'tenant-1');
        // Set what `await chain` resolves to (products query)
        mocks.setChainData([
            { id: 1, name: 'Product A', brand_name: 'Samsung' },
        ]);

        const result = await svc.getAll({});

        // Verify LEFT JOIN brands was called
        expect(mocks.mockLeftJoin).toHaveBeenCalled();
        const joinCalls = mocks.mockLeftJoin.mock.calls;
        const brandJoin = joinCalls.find(c => c[0] === 'brands as b');
        expect(brandJoin).toBeTruthy();
    });

    it('PROD-002: create() passes brand_id into insert', async () => {
        const svc = new ProductService(mocks.mockDb, 'tenant-1');
        mocks.mockReturning.mockResolvedValue([{
            id: 1, name: 'Test', brand_id: 'brand-uuid', code: 'P-001'
        }]);
        mocks.mockFirst.mockResolvedValue(null); // no existing product

        await svc.create({
            name: 'Test',
            code: 'P-001',
            retail_price: 100,
            cost_price: 50,
            brand_id: 'brand-uuid'
        });

        // Check that insert was called with brand_id
        const insertCall = mocks.mockInsert.mock.calls[0][0];
        expect(insertCall.brand_id).toBe('brand-uuid');
    });

    it('PROD-003: create() sets brand_id null when not provided', async () => {
        const svc = new ProductService(mocks.mockDb, 'tenant-1');
        mocks.mockReturning.mockResolvedValue([{
            id: 1, name: 'Test', brand_id: null, code: 'P-001'
        }]);
        mocks.mockFirst.mockResolvedValue(null);

        await svc.create({
            name: 'Test',
            code: 'P-002',
            retail_price: 100,
            cost_price: 50,
        });

        const insertCall = mocks.mockInsert.mock.calls[0][0];
        expect(insertCall.brand_id).toBeNull();
    });
});
