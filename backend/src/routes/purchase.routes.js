const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const PurchaseService = require('../services/purchase.service');
const PurchaseReturnService = require('../services/purchaseReturn.service');
const audit = require('../utils/audit');

// Get all purchases
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const result = await purchaseService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get purchase drafts
router.get('/drafts', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const result = await purchaseService.list({ ...req.query, status: 'draft' });
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Preview accounting journal for a purchase payload
router.post('/preview', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const preview = await purchaseService.getJournalPreview(req.body);
        res.json({ success: true, data: preview });
    } catch (error) {
        next(error);
    }
});

// Check duplicate risk for incoming purchase payload
router.post('/duplicate-check', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const result = await purchaseService.checkDuplicateRisk(req.body || {});
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Create purchase
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const purchase = await purchaseService.createPurchase(req.body, req.user.id);

        // Audit purchase creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'purchases',
            recordId: purchase.id,
            newValues: { id: purchase.id, bill_number: purchase.bill_number, supplier_id: purchase.supplier_id, total_amount: purchase.total_amount, status: purchase.status },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
});

// Create purchase draft
router.post('/drafts', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const draft = await purchaseService.createDraft(req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'purchases',
            recordId: draft.id,
            newValues: {
                id: draft.id,
                bill_number: draft.bill_number,
                supplier_id: draft.supplier_id,
                total_amount: draft.total_amount,
                status: draft.status,
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: draft });
    } catch (error) {
        next(error);
    }
});

// List purchase templates
router.get('/templates', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const result = await purchaseService.listTemplates(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Create purchase template
router.post('/templates', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const template = await purchaseService.createTemplate(req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'purchase_templates',
            recordId: template.id,
            newValues: {
                id: template.id,
                name: template.name,
                supplier_id: template.supplier_id,
                item_count: template.item_count,
                is_active: template.is_active,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.status(201).json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
});

// Get purchase template by id
router.get('/templates/:templateId', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const template = await purchaseService.getTemplate(req.params.templateId);
        res.json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
});

// Update purchase template
router.put('/templates/:templateId', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const oldTemplate = await db('purchase_templates')
            .where({ id: req.params.templateId, tenant_id: req.tenantId, is_deleted: false })
            .first();

        const purchaseService = new PurchaseService(db, req.tenantId);
        const template = await purchaseService.updateTemplate(req.params.templateId, req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'purchase_templates',
            recordId: template.id,
            oldValues: oldTemplate
                ? {
                    name: oldTemplate.name,
                    supplier_id: oldTemplate.supplier_id,
                    item_count: oldTemplate.item_count,
                    is_active: oldTemplate.is_active,
                }
                : null,
            newValues: {
                name: template.name,
                supplier_id: template.supplier_id,
                item_count: template.item_count,
                is_active: template.is_active,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
});

// Archive purchase template
router.delete('/templates/:templateId', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const oldTemplate = await db('purchase_templates')
            .where({ id: req.params.templateId, tenant_id: req.tenantId, is_deleted: false })
            .first();

        const purchaseService = new PurchaseService(db, req.tenantId);
        const archived = await purchaseService.archiveTemplate(req.params.templateId, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'purchase_templates',
            recordId: archived.id,
            oldValues: oldTemplate
                ? {
                    name: oldTemplate.name,
                    supplier_id: oldTemplate.supplier_id,
                    item_count: oldTemplate.item_count,
                    is_active: oldTemplate.is_active,
                }
                : null,
            newValues: {
                is_deleted: archived.is_deleted,
                is_active: archived.is_active,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.json({ success: true, data: archived });
    } catch (error) {
        next(error);
    }
});

// Apply template and return normalized draft payload
router.post('/templates/:templateId/apply', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseService = new PurchaseService(db, req.tenantId);
        const result = await purchaseService.applyTemplate(req.params.templateId, req.body || {});
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// List purchase returns
router.get('/returns', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const result = await purchaseReturnService.listReturns(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Purchase return analytics summary
router.get('/returns/stats', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const stats = await purchaseReturnService.getReturnStats(req.query);
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

// Purchase return reasons frequency
router.get('/returns/reasons', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const reasons = await purchaseReturnService.getReturnReasons(req.query);
        res.json({ success: true, data: reasons });
    } catch (error) {
        next(error);
    }
});

// List returns for a single purchase
router.get('/:id/returns', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const result = await purchaseReturnService.listReturns({ ...req.query, purchase_id: req.params.id });
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single purchase return
router.get('/returns/:returnId', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const result = await purchaseReturnService.getReturnById(req.params.returnId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

const createPurchaseReturnHandler = async (req, res, next) => {
    try {
        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const purchaseReturn = await purchaseReturnService.createReturn(req.params.id, req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'purchases',
            recordId: purchaseReturn.id,
            newValues: {
                id: purchaseReturn.id,
                bill_number: purchaseReturn.bill_number,
                purchase_id: purchaseReturn.original_purchase_id,
                total_amount: purchaseReturn.total_amount,
                is_return: true,
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: purchaseReturn });
    } catch (error) {
        next(error);
    }
};

router.post('/:id/return', authorize('admin', 'manager'), createPurchaseReturnHandler);
router.post('/:id/returns', authorize('admin', 'manager'), createPurchaseReturnHandler);

// Create purchase return (legacy compatibility endpoint)
router.post('/return', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { original_purchase_id } = req.body;
        if (!original_purchase_id) {
            throw new AppError('original_purchase_id is required', 400);
        }

        const purchaseReturnService = new PurchaseReturnService(db, req.tenantId);
        const purchaseReturn = await purchaseReturnService.createReturn(original_purchase_id, req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'purchases',
            recordId: purchaseReturn.id,
            newValues: {
                id: purchaseReturn.id,
                bill_number: purchaseReturn.bill_number,
                purchase_id: purchaseReturn.original_purchase_id,
                total_amount: purchaseReturn.total_amount,
                is_return: true,
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: purchaseReturn });
    } catch (error) {
        next(error);
    }
});

// Update draft purchase
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const oldPurchase = await db('purchases')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        const purchaseService = new PurchaseService(db, req.tenantId);
        const updatedDraft = await purchaseService.updateDraft(req.params.id, req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'purchases',
            recordId: updatedDraft.id,
            oldValues: oldPurchase
                ? {
                    id: oldPurchase.id,
                    supplier_id: oldPurchase.supplier_id,
                    subtotal: oldPurchase.subtotal,
                    total_amount: oldPurchase.total_amount,
                    status: oldPurchase.status,
                }
                : null,
            newValues: {
                id: updatedDraft.id,
                supplier_id: updatedDraft.supplier_id,
                subtotal: updatedDraft.subtotal,
                total_amount: updatedDraft.total_amount,
                status: updatedDraft.status,
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: updatedDraft });
    } catch (error) {
        next(error);
    }
});

// Cancel draft purchase
router.post('/:id/cancel', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const oldPurchase = await db('purchases')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        const purchaseService = new PurchaseService(db, req.tenantId);
        const cancelledPurchase = await purchaseService.cancelPurchase(req.params.id, req.body, req.user.id);

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'purchases',
            recordId: cancelledPurchase.id,
            oldValues: oldPurchase
                ? { id: oldPurchase.id, status: oldPurchase.status, notes: oldPurchase.notes }
                : null,
            newValues: {
                id: cancelledPurchase.id,
                status: cancelledPurchase.status,
                notes: cancelledPurchase.notes,
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: cancelledPurchase });
    } catch (error) {
        next(error);
    }
});

// Get single purchase with items
router.get('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const returnAggSubquery = db('purchases as rp')
            .select('rp.original_purchase_id as purchase_id')
            .sum({ returned_amount: 'rp.total_amount' })
            .count('* as return_count')
            .where('rp.tenant_id', req.tenantId)
            .where('rp.is_return', true)
            .groupBy('rp.original_purchase_id')
            .as('ret_agg');

        const purchase = await db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .leftJoin(returnAggSubquery, 'ret_agg.purchase_id', 'p.id')
            .select(
                'p.*',
                's.name as supplier_name',
                db.raw('COALESCE(ret_agg.returned_amount, 0) as returned_amount'),
                db.raw('COALESCE(ret_agg.return_count, 0) as return_count')
            )
            .where('p.id', req.params.id)
            .where('p.tenant_id', req.tenantId)
            .first();

        if (!purchase) throw new AppError('Purchase not found', 404);

        const items = await db('purchase_items as pi')
            .join('products as pr', 'pi.product_id', 'pr.id')
            .select('pi.*', 'pr.name as product_name', 'pr.code as product_code')
            .where('pi.purchase_id', req.params.id)
            .where('pi.tenant_id', req.tenantId)
            .where('pr.tenant_id', req.tenantId)
            .where('pr.is_deleted', false);

        const itemReturns = await db('purchase_items as rpi')
            .join('purchases as rp', 'rpi.purchase_id', 'rp.id')
            .where('rp.tenant_id', req.tenantId)
            .where('rp.is_return', true)
            .where('rp.original_purchase_id', req.params.id)
            .whereNotNull('rpi.original_purchase_item_id')
            .select('rpi.original_purchase_item_id')
            .sum({ returned_qty: 'rpi.quantity' })
            .groupBy('rpi.original_purchase_item_id');

        const returnedMap = new Map();
        for (const row of itemReturns) {
            returnedMap.set(row.original_purchase_item_id, Number(row.returned_qty || 0));
        }

        const itemsWithReturnState = items.map((item) => {
            const returnedQuantity = Number(returnedMap.get(item.id) || 0);
            const purchasedQuantity = Number(item.quantity || 0);
            const returnableQuantity = Math.max(0, purchasedQuantity - returnedQuantity);

            return {
                ...item,
                returned_quantity: returnedQuantity,
                returnable_quantity: returnableQuantity,
            };
        });

        res.json({ success: true, data: { ...purchase, items: itemsWithReturnState } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

