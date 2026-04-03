const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');

// Build nested tree from flat list
const buildTree = (flat, parentId = null) =>
    flat
        .filter(c => c.parent_id == parentId)
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .map(c => ({ ...c, children: buildTree(flat, c.id) }));

// GET /api/categories — returns nested tree by default, flat with ?flat=true
router.get('/', authenticate, async (req, res, next) => {
    try {
        const includeInactive = req.query.all === 'true';
        let query = db('categories').where('tenant_id', req.tenantId).orderBy('sequence_order');
        if (!includeInactive) query = query.where('is_active', true);
        const categories = await query;

        if (req.query.flat === 'true') {
            return res.json({ success: true, data: categories });
        }

        res.json({ success: true, data: buildTree(categories) });
    } catch (error) {
        next(error);
    }
});

// POST /api/categories
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description, parent_id } = req.body;
        if (!name) throw new AppError('Name is required', 400);

        // Max depth = 2: parent must not itself have a parent
        if (parent_id) {
            const parent = await db('categories')
                .where({ id: parent_id, tenant_id: req.tenantId })
                .first();
            if (!parent) throw new AppError('Parent category not found', 404);
            if (parent.parent_id) throw new AppError('Maximum nesting depth is 2 levels. Cannot add a subcategory to a subcategory.', 400);
        }

        // Auto sequence_order
        const maxSeq = await db('categories')
            .where('tenant_id', req.tenantId)
            .max('sequence_order as max')
            .first();
        const sequence_order = (maxSeq?.max || 0) + 10;

        const [category] = await db('categories').insert({
            name, description, parent_id: parent_id || null,
            sequence_order,
            created_by: req.user.id,
            tenant_id: req.tenantId
        }).returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'categories',
            recordId: category.id,
            newValues: { id: category.id, name: category.name, parent_id: category.parent_id },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

// PUT /api/categories/:id
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description, parent_id, is_active, sequence_order } = req.body;
        const catId = parseInt(req.params.id);

        const oldCategory = await db('categories')
            .where({ id: catId, tenant_id: req.tenantId })
            .first();
        if (!oldCategory) throw new AppError('Category not found', 404);

        // Max depth check if parent_id is being set
        if (parent_id !== undefined && parent_id !== null) {
            const parent = await db('categories').where({ id: parent_id, tenant_id: req.tenantId }).first();
            if (parent && parent.parent_id) throw new AppError('Maximum nesting depth is 2 levels', 400);
        }

        const updateData = { updated_at: db.fn.now() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (parent_id !== undefined) updateData.parent_id = parent_id;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (sequence_order !== undefined) updateData.sequence_order = sequence_order;

        const [category] = await db('categories')
            .where({ id: catId, tenant_id: req.tenantId })
            .update(updateData)
            .returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'categories',
            recordId: catId,
            oldValues: { name: oldCategory.name, is_active: oldCategory.is_active },
            newValues: { name: category.name, is_active: category.is_active },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/categories/:id — safe cascade delete
router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const catId = parseInt(req.params.id);
        const category = await db('categories')
            .where({ id: catId, tenant_id: req.tenantId })
            .first();
        if (!category) throw new AppError('Category not found', 404);

        // Step 1: Does this category itself have products?
        const [{ count: directCount }] = await db('products')
            .where({ category_id: catId, is_deleted: false })
            .count();
        if (parseInt(directCount) > 0) {
            return next(new AppError(`Cannot delete: ${directCount} product(s) are in this category. Reassign them first.`, 409));
        }

        // Step 2: Do subcategories have products?
        const subcats = await db('categories')
            .where({ parent_id: catId, tenant_id: req.tenantId })
            .select('id', 'name');

        if (subcats.length > 0) {
            const subcatIds = subcats.map(s => s.id);
            const [{ count: subCount }] = await db('products')
                .whereIn('category_id', subcatIds)
                .where('is_deleted', false)
                .count();
            if (parseInt(subCount) > 0) {
                const affected = [];
                for (const sc of subcats) {
                    const [{ count: scCount }] = await db('products')
                        .where({ category_id: sc.id, is_deleted: false })
                        .count();
                    if (parseInt(scCount) > 0) {
                        affected.push(`"${sc.name}" (${scCount} products)`);
                    }
                }
                return next(new AppError(
                    `Cannot delete: subcategories have products — ${affected.join(', ')}. Reassign them first.`, 409
                ));
            }
        }

        // Step 3: Safe to delete in transaction
        await db.transaction(async trx => {
            await trx('categories').where({ parent_id: catId, tenant_id: req.tenantId }).del();
            await trx('categories').where({ id: catId, tenant_id: req.tenantId }).del();
        });

        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'categories',
            recordId: catId,
            oldValues: { name: category.name, children: subcats.length },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: `Category "${category.name}" deleted` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
