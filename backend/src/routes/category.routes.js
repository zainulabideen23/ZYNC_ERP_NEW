const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Categories
router.get('/', authenticate, async (req, res, next) => {
    try {
        const categories = await db('categories').where('is_active', true).orderBy('name');
        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
});

router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description, parent_id } = req.body;
        if (!name) throw new AppError('Name is required', 400);

        const [category] = await db('categories').insert({ name, description, parent_id }).returning('*');
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description, parent_id, is_active } = req.body;

        const [category] = await db('categories')
            .where({ id: req.params.id })
            .update({ name, description, parent_id, is_active })
            .returning('*');

        if (!category) throw new AppError('Category not found', 404);
        res.json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
