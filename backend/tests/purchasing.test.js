const request = require('supertest');
const express = require('express');

// Mocks
const mockPurchaseServiceInstance = {
    list: jest.fn(),
    createPurchase: jest.fn(),
    createDraft: jest.fn(),
    updateDraft: jest.fn(),
    cancelPurchase: jest.fn(),
    getJournalPreview: jest.fn(),
    checkDuplicateRisk: jest.fn(),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    archiveTemplate: jest.fn(),
    applyTemplate: jest.fn(),
};

const mockPurchaseReturnServiceInstance = {
    createReturn: jest.fn(),
    listReturns: jest.fn(),
    getReturnById: jest.fn(),
};

const mockPurchaseServiceClass = jest.fn(() => mockPurchaseServiceInstance);
const mockPurchaseReturnServiceClass = jest.fn(() => mockPurchaseReturnServiceInstance);

jest.doMock('../src/services/purchase.service', () => mockPurchaseServiceClass);
jest.doMock('../src/services/purchaseReturn.service', () => mockPurchaseReturnServiceClass);

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
    first: jest.fn().mockResolvedValue({
        id: 'draft-1',
        supplier_id: 1,
        subtotal: 1000,
        total_amount: 1000,
        status: 'draft',
        notes: 'existing notes',
    }),
    select: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    as: jest.fn().mockReturnThis(),
    sum: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue([1]),
    del: jest.fn().mockResolvedValue(1),
}));
mockDb.raw = jest.fn();

jest.doMock('../src/config/database', () => mockDb);

const purchaseRoutes = require('../src/routes/purchase.routes');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Purchasing Module', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPurchaseServiceInstance.list.mockResolvedValue({
            data: [{ id: 'draft-1', bill_number: 'PDR-000001', status: 'draft' }],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        });
        mockPurchaseServiceInstance.createDraft.mockResolvedValue({
            id: 'draft-1',
            bill_number: 'PDR-000001',
            status: 'draft',
            total_amount: 1200,
            supplier_id: 1,
        });
        mockPurchaseServiceInstance.updateDraft.mockResolvedValue({
            id: 'draft-1',
            bill_number: 'PDR-000001',
            status: 'draft',
            total_amount: 1500,
            supplier_id: 2,
            subtotal: 1500,
        });
        mockPurchaseServiceInstance.cancelPurchase.mockResolvedValue({
            id: 'draft-1',
            bill_number: 'PDR-000001',
            status: 'cancelled',
            notes: 'Cancelled from test',
        });
        mockPurchaseServiceInstance.getJournalPreview.mockResolvedValue({
            status: 'billed',
            subtotal: 1000,
            total_amount: 1000,
            amount_paid: 0,
            amount_due: 1000,
            overpayment: 0,
            journal_entries: [
                { account_id: 'acc-inv', entry_type: 'debit', amount: 1000 },
                { account_id: 'acc-pay', entry_type: 'credit', amount: 1000 },
            ],
            is_balanced: true,
        });
        mockPurchaseServiceInstance.checkDuplicateRisk.mockResolvedValue({
            is_duplicate_risk: true,
            duplicate_fingerprint: 'hash-1',
            evaluated_candidates: 1,
            matches: [{ id: 'pur-1', bill_number: 'PUR-000001', risk_score: 90 }],
        });
        mockPurchaseServiceInstance.listTemplates.mockResolvedValue({
            data: [{ id: 'tpl-1', name: 'Default Template', item_count: 2 }],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        });
        mockPurchaseServiceInstance.getTemplate.mockResolvedValue({
            id: 'tpl-1',
            name: 'Default Template',
            supplier_id: 1,
            item_count: 2,
            items: [{ product_id: 1, quantity: 2, unit_cost: 100 }],
        });
        mockPurchaseServiceInstance.createTemplate.mockResolvedValue({
            id: 'tpl-1',
            name: 'Default Template',
            supplier_id: 1,
            item_count: 2,
            is_active: true,
        });
        mockPurchaseServiceInstance.updateTemplate.mockResolvedValue({
            id: 'tpl-1',
            name: 'Updated Template',
            supplier_id: 1,
            item_count: 3,
            is_active: true,
        });
        mockPurchaseServiceInstance.archiveTemplate.mockResolvedValue({
            id: 'tpl-1',
            is_active: false,
            is_deleted: true,
        });
        mockPurchaseServiceInstance.applyTemplate.mockResolvedValue({
            template_id: 'tpl-1',
            template_name: 'Default Template',
            data: {
                supplier_id: 1,
                total_amount: 800,
                items: [{ product_id: 1, quantity: 2, unit_cost: 400 }],
            },
        });
        mockPurchaseReturnServiceInstance.createReturn.mockResolvedValue({
            id: 'pr-1',
            bill_number: 'PRN-000001',
            original_purchase_id: 1,
            total_amount: 500,
        });
        mockPurchaseReturnServiceInstance.listReturns.mockResolvedValue({
            data: [{ id: 'pr-1', return_number: 'PRN-000001' }],
            pagination: { page: 1, limit: 50, total: 1, pages: 1 },
        });
        mockPurchaseReturnServiceInstance.getReturnById.mockResolvedValue({
            id: 'pr-1',
            return_number: 'PRN-000001',
            items: [{ id: 'line-1', product_id: 1, quantity: 1 }],
        });
        app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { id: 1, role: 'admin' };
            req.tenantId = 'tenant-1';
            next();
        });
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

        expect(mockPurchaseServiceInstance.createPurchase).toHaveBeenCalledWith(
            expect.objectContaining({
                supplier_id: 1,
                items: purchaseData.items,
                paid_amount: 5000
            }),
            1
        );
    });

    it('PUR-002: Should create a purchase return via /:id/returns', async () => {
        const res = await request(app)
            .post('/api/purchases/1/returns')
            .send({
                items: [{ product_id: 1, quantity: 2, unit_cost: 250 }],
                return_date: '2026-04-08',
                notes: 'Return from test',
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.bill_number).toBe('PRN-000001');
        expect(mockPurchaseReturnServiceInstance.createReturn).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({
                items: expect.any(Array),
                return_date: '2026-04-08',
            }),
            1
        );
    });

    it('PUR-003: Should create a purchase return via legacy /return endpoint', async () => {
        const res = await request(app)
            .post('/api/purchases/return')
            .send({
                original_purchase_id: 1,
                items: [{ product_id: 1, quantity: 1, unit_cost: 250 }],
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.bill_number).toBe('PRN-000001');
        expect(mockPurchaseReturnServiceInstance.createReturn).toHaveBeenCalledWith(
            1,
            expect.objectContaining({
                original_purchase_id: 1,
                items: expect.any(Array),
            }),
            1
        );
    });

    it('PUR-004: Should list purchase returns', async () => {
        const res = await request(app)
            .get('/api/purchases/returns');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(mockPurchaseReturnServiceInstance.listReturns).toHaveBeenCalledWith({});
    });

    it('PUR-005: Should list returns for a single purchase', async () => {
        const res = await request(app)
            .get('/api/purchases/1/returns')
            .query({ limit: '20' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockPurchaseReturnServiceInstance.listReturns).toHaveBeenCalledWith(
            expect.objectContaining({
                purchase_id: '1',
                limit: '20',
            })
        );
    });

    it('PUR-006: Should get single purchase return by id', async () => {
        const res = await request(app)
            .get('/api/purchases/returns/pr-1');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.return_number).toBe('PRN-000001');
        expect(mockPurchaseReturnServiceInstance.getReturnById).toHaveBeenCalledWith('pr-1');
    });

    it('PUR-007: Should reject legacy return when original_purchase_id is missing', async () => {
        const res = await request(app)
            .post('/api/purchases/return')
            .send({ items: [{ product_id: 1, quantity: 1 }] });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('original_purchase_id is required');
        expect(mockPurchaseReturnServiceInstance.createReturn).not.toHaveBeenCalled();
    });

    it('PUR-008: Should create a purchase draft successfully', async () => {
        const draftData = {
            supplier_id: 1,
            items: [{ product_id: 1, quantity: 3, unit_cost: 400 }],
            payment_method: 'bank_transfer',
        };

        const res = await request(app)
            .post('/api/purchases/drafts')
            .send(draftData);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.bill_number).toBe('PDR-000001');
        expect(mockPurchaseServiceInstance.createDraft).toHaveBeenCalledWith(
            expect.objectContaining({ supplier_id: 1, items: draftData.items }),
            1
        );
    });

    it('PUR-009: Should update an existing purchase draft', async () => {
        const res = await request(app)
            .put('/api/purchases/draft-1')
            .send({
                supplier_id: 2,
                items: [{ product_id: 1, quantity: 5, unit_cost: 300 }],
                discount_amount: 0,
                tax_amount: 0,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe('draft-1');
        expect(mockPurchaseServiceInstance.updateDraft).toHaveBeenCalledWith(
            'draft-1',
            expect.objectContaining({ supplier_id: 2, items: expect.any(Array) }),
            1
        );
    });

    it('PUR-010: Should cancel a draft purchase', async () => {
        const res = await request(app)
            .post('/api/purchases/draft-1/cancel')
            .send({ reason: 'Supplier changed quotation' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('cancelled');
        expect(mockPurchaseServiceInstance.cancelPurchase).toHaveBeenCalledWith(
            'draft-1',
            expect.objectContaining({ reason: 'Supplier changed quotation' }),
            1
        );
    });

    it('PUR-011: Should list purchase drafts', async () => {
        const res = await request(app)
            .get('/api/purchases/drafts')
            .query({ page: '1', limit: '20' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(mockPurchaseServiceInstance.list).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'draft', page: '1', limit: '20' })
        );
    });

    it('PUR-012: Should preview purchase journal entries', async () => {
        const res = await request(app)
            .post('/api/purchases/preview')
            .send({
                supplier_id: 1,
                items: [{ product_id: 1, quantity: 2, unit_cost: 500 }],
                amount_paid: 0,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_balanced).toBe(true);
        expect(mockPurchaseServiceInstance.getJournalPreview).toHaveBeenCalledWith(
            expect.objectContaining({ supplier_id: 1, items: expect.any(Array) })
        );
    });

    it('PUR-013: Should run duplicate-risk check', async () => {
        const res = await request(app)
            .post('/api/purchases/duplicate-check')
            .send({
                supplier_id: 1,
                reference_number: 'INV-11',
                total_amount: 1000,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_duplicate_risk).toBe(true);
        expect(mockPurchaseServiceInstance.checkDuplicateRisk).toHaveBeenCalledWith(
            expect.objectContaining({ supplier_id: 1, reference_number: 'INV-11' })
        );
    });

    it('PUR-014: Should create purchase template', async () => {
        const res = await request(app)
            .post('/api/purchases/templates')
            .send({
                name: 'Default Template',
                supplier_id: 1,
                items: [{ product_id: 1, quantity: 2, unit_cost: 400 }],
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Default Template');
        expect(mockPurchaseServiceInstance.createTemplate).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Default Template' }),
            1
        );
    });

    it('PUR-015: Should list purchase templates', async () => {
        const res = await request(app)
            .get('/api/purchases/templates')
            .query({ page: '1', limit: '20', search: 'default' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(mockPurchaseServiceInstance.listTemplates).toHaveBeenCalledWith(
            expect.objectContaining({ page: '1', limit: '20', search: 'default' })
        );
    });

    it('PUR-016: Should update purchase template', async () => {
        const res = await request(app)
            .put('/api/purchases/templates/tpl-1')
            .send({ name: 'Updated Template' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Updated Template');
        expect(mockPurchaseServiceInstance.updateTemplate).toHaveBeenCalledWith(
            'tpl-1',
            expect.objectContaining({ name: 'Updated Template' }),
            1
        );
    });

    it('PUR-017: Should archive purchase template', async () => {
        const res = await request(app)
            .delete('/api/purchases/templates/tpl-1');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_deleted).toBe(true);
        expect(mockPurchaseServiceInstance.archiveTemplate).toHaveBeenCalledWith('tpl-1', 1);
    });

    it('PUR-018: Should apply purchase template to draft payload', async () => {
        const res = await request(app)
            .post('/api/purchases/templates/tpl-1/apply')
            .send({ supplier_id: 1 });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.template_id).toBe('tpl-1');
        expect(mockPurchaseServiceInstance.applyTemplate).toHaveBeenCalledWith(
            'tpl-1',
            expect.objectContaining({ supplier_id: 1 })
        );
    });
});
