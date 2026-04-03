const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');

// GET /api/units — all active units
router.get('/', authenticate, async (req, res, next) => {
    try {
        const includeInactive = req.query.all === 'true';
        let query = db('units').where('tenant_id', req.tenantId).orderBy('name');
        if (!includeInactive) query = query.where('is_active', true);
        const units = await query;
        res.json({ success: true, data: units });
    } catch (error) {
        next(error);
    }
});

// POST /api/units — create a unit
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, abbreviation, description } = req.body;
        if (!name || !abbreviation) throw new AppError('Name and abbreviation are required', 400);

        // Check uniqueness within tenant
        const existing = await db('units')
            .where('tenant_id', req.tenantId)
            .where(function () {
                this.whereRaw('LOWER(name) = ?', [name.toLowerCase()])
                    .orWhereRaw('LOWER(abbreviation) = ?', [abbreviation.toLowerCase()]);
            })
            .first();
        if (existing) throw new AppError('Unit name or abbreviation already exists', 409);

        const [unit] = await db('units').insert({
            name, abbreviation, description,
            created_by: req.user.id,
            tenant_id: req.tenantId
        }).returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'units',
            recordId: unit.id,
            newValues: { id: unit.id, name: unit.name, abbreviation: unit.abbreviation },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: unit });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Unit name or abbreviation already exists', 409));
        }
        next(error);
    }
});

// POST /api/units/seed — bulk-seed standard units (skips duplicates)
const STANDARD_UNITS = [
    { name: 'Piece', abbreviation: 'pcs' },
    { name: 'Kilogram', abbreviation: 'kg' },
    { name: 'Litre', abbreviation: 'ltr' },
    { name: 'Box', abbreviation: 'box' },
    { name: 'Pack', abbreviation: 'pack' },
    { name: 'Dozen', abbreviation: 'dz' },
    { name: 'Meter', abbreviation: 'm' },
    { name: 'Sq. Meter', abbreviation: 'sqm' },
];

router.post('/seed', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        // Get existing units for this tenant (check both name and abbreviation)
        const existing = await db('units')
            .where('tenant_id', req.tenantId)
            .select('name', 'abbreviation');
        const existingNames = new Set(existing.map(u => u.name.toLowerCase()));
        const existingAbbrevs = new Set(existing.map(u => u.abbreviation.toLowerCase()));

        // Filter out already-existing ones (match by name OR abbreviation)
        const toInsert = STANDARD_UNITS
            .filter(u => !existingNames.has(u.name.toLowerCase()) && !existingAbbrevs.has(u.abbreviation.toLowerCase()))
            .map(u => ({
                ...u,
                created_by: req.user.id,
                tenant_id: req.tenantId,
            }));

        if (toInsert.length === 0) {
            return res.json({ success: true, message: 'All standard units already exist', added: 0 });
        }

        // Insert one-by-one to gracefully skip any that violate global unique constraints
        let added = 0;
        for (const unit of toInsert) {
            try {
                await db('units').insert(unit);
                added++;
            } catch (err) {
                // Skip duplicates (23505 = unique violation)
                if (err.code !== '23505') throw err;
            }
        }

        if (added > 0) {
            await audit(db, {
                userId: req.user.id,
                action: 'create',
                tableName: 'units',
                recordId: null,
                newValues: { seeded: toInsert.map(u => u.name) },
                ip: req.ip,
                tenantId: req.tenantId
            });
        }

        res.status(added > 0 ? 201 : 200).json({
            success: true,
            message: added > 0 ? `${added} standard unit(s) added` : 'All standard units already exist',
            added,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/units/quick-create — lightweight creation from product form modal
router.post('/quick-create', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, abbreviation } = req.body;
        if (!name || name.length < 2) throw new AppError('Name must be at least 2 characters', 400);
        if (!abbreviation || abbreviation.length > 10) throw new AppError('Abbreviation is required (max 10 chars)', 400);

        // Check uniqueness within tenant
        const existing = await db('units')
            .where('tenant_id', req.tenantId)
            .where(function () {
                this.whereRaw('LOWER(name) = ?', [name.toLowerCase()])
                    .orWhereRaw('LOWER(abbreviation) = ?', [abbreviation.toLowerCase()]);
            })
            .first();
        if (existing) throw new AppError('A unit with that name or abbreviation already exists', 409);

        const [unit] = await db('units').insert({
            name: name.trim(),
            abbreviation: abbreviation.trim(),
            created_by: req.user.id,
            tenant_id: req.tenantId
        }).returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'units',
            recordId: unit.id,
            newValues: { name: unit.name, abbreviation: unit.abbreviation },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: unit });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Unit already exists', 409));
        }
        next(error);
    }
});

// PUT /api/units/:id — update a unit
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, abbreviation, description, is_active } = req.body;
        const unitId = parseInt(req.params.id);

        const oldUnit = await db('units').where({ id: unitId, tenant_id: req.tenantId }).first();
        if (!oldUnit) throw new AppError('Unit not found', 404);

        // If name or abbreviation changing, check uniqueness (exclude self)
        if (name || abbreviation) {
            const existing = await db('units')
                .where('tenant_id', req.tenantId)
                .whereNot('id', unitId)
                .where(function () {
                    if (name) this.whereRaw('LOWER(name) = ?', [name.toLowerCase()]);
                    if (abbreviation) this.orWhereRaw('LOWER(abbreviation) = ?', [abbreviation.toLowerCase()]);
                })
                .first();
            if (existing) throw new AppError('Unit name or abbreviation already exists', 409);
        }

        const updateData = { updated_at: db.fn.now() };
        if (name !== undefined) updateData.name = name;
        if (abbreviation !== undefined) updateData.abbreviation = abbreviation;
        if (description !== undefined) updateData.description = description;
        if (is_active !== undefined) updateData.is_active = is_active;

        const [unit] = await db('units')
            .where({ id: unitId, tenant_id: req.tenantId })
            .update(updateData)
            .returning('*');

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'units',
            recordId: unitId,
            oldValues: { name: oldUnit.name, abbreviation: oldUnit.abbreviation },
            newValues: { name: unit.name, abbreviation: unit.abbreviation },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: unit });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Unit name or abbreviation already exists', 409));
        }
        next(error);
    }
});

// DELETE /api/units/:id — soft delete (deactivate)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const unitId = parseInt(req.params.id);
        const unit = await db('units').where({ id: unitId, tenant_id: req.tenantId }).first();
        if (!unit) throw new AppError('Unit not found', 404);

        // Check if products are using this unit
        const [{ count }] = await db('products')
            .where({ unit_id: unitId, is_deleted: false })
            .count();

        const productCount = parseInt(count);
        if (productCount > 0) {
            return res.status(409).json({
                success: false,
                error: 'Cannot deactivate unit',
                message: `${productCount} product(s) are using this unit. Reassign them first.`,
                product_count: productCount
            });
        }

        await db('units')
            .where({ id: unitId, tenant_id: req.tenantId })
            .update({ is_active: false, updated_at: db.fn.now() });

        await audit(db, {
            userId: req.user.id,
            action: 'delete',
            tableName: 'units',
            recordId: unitId,
            oldValues: { name: unit.name, is_active: true },
            newValues: { is_active: false },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, message: `Unit "${unit.name}" deactivated` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
