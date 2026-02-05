const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Get all units
router.get('/', authenticate, async (req, res, next) => {
    try {
        const units = await db('units').where('is_active', true).orderBy('name');
        res.json({ success: true, data: units });
    } catch (error) {
        next(error);
    }
});

// Create a unit
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, abbreviation, description } = req.body;
        if (!name || !abbreviation) throw new AppError('Name and abbreviation are required', 400);

        const [unit] = await db('units').insert({ name, abbreviation, description }).returning('*');
        res.status(201).json({ success: true, data: unit });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Unit name or abbreviation already exists', 409));
        }
        next(error);
    }
});

module.exports = router;
