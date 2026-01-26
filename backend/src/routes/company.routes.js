const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Companies/Brands
router.get('/', authenticate, async (req, res, next) => {
    try {
        const companies = await db('companies').where('is_active', true).orderBy('name');
        res.json({ success: true, data: companies });
    } catch (error) {
        next(error);
    }
});

router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) throw new AppError('Name is required', 400);

        const [company] = await db('companies').insert({ name, description }).returning('*');
        res.status(201).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, description, is_active } = req.body;

        const [company] = await db('companies')
            .where({ id: req.params.id })
            .update({ name, description, is_active })
            .returning('*');

        if (!company) throw new AppError('Company not found', 404);
        res.json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
