const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');

// GET /api/brands — all brands for current tenant
router.get('/', async (req, res, next) => {
    try {
        const includeInactive = req.query.all === 'true';
        let query = db('brands').where('tenant_id', req.tenantId).orderBy('name');
        if (!includeInactive) query = query.where('is_active', true);
        const brands = await query;
        res.json({ success: true, data: brands });
    } catch (error) {
        next(error);
    }
});

// POST /api/brands — create a brand
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) throw new AppError('Name is required', 400);

        const [brand] = await db('brands').insert({
            name,
            description,
            created_by: req.user.id,
            tenant_id: req.tenantId
        }).returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'brands',
            recordId: brand.id,
            newValues: { id: brand.id, name: brand.name },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: brand });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Brand name already exists', 409));
        }
        next(error);
    }
});

// PUT /api/brands/:id — update a brand
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description, is_active } = req.body;

        const oldBrand = await db('brands')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        if (!oldBrand) throw new AppError('Brand not found', 404);

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (is_active !== undefined) updateData.is_active = is_active;
        updateData.updated_at = db.fn.now();

        const [brand] = await db('brands')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update(updateData)
            .returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'brands',
            recordId: req.params.id,
            oldValues: { name: oldBrand.name, is_active: oldBrand.is_active },
            newValues: { name: brand.name, is_active: brand.is_active },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: brand });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/brands/:id — delete a brand (check products first)
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const brand = await db('brands')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        if (!brand) throw new AppError('Brand not found', 404);

        // Check if products reference this brand
        const [{ count }] = await db('products')
            .where({ brand_id: req.params.id, is_deleted: false })
            .count();

        if (parseInt(count) > 0) {
            return next(new AppError(`Cannot delete: ${count} products are using this brand. Reassign them first.`, 409));
        }

        await db('brands')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .del();

        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'brands',
            recordId: req.params.id,
            oldValues: { name: brand.name },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: 'Brand deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
