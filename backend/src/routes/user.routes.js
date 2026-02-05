const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Middleware: All routes require 'admin' role
router.use(authenticate, authorize('admin'));

// GET / - List all users
router.get('/', async (req, res, next) => {
    try {
        const users = await db('users')
            .select('id', 'username', 'full_name', 'email', 'phone_number', 'role', 'is_active', 'last_login', 'created_at')
            .orderBy('created_at', 'desc');

        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
});

// POST / - Create new user
router.post('/', async (req, res, next) => {
    try {
        const { username, password, full_name, email, phone, role } = req.body;

        if (!username || !password || !full_name || !role) {
            throw new AppError('Missing required fields', 400);
        }

        // Check if username already exists
        const existingUser = await db('users').where({ username }).first();
        if (existingUser) {
            throw new AppError('Username already taken', 409);
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [newUser] = await db('users').insert({
            username,
            password_hash,
            full_name,
            email,
            phone_number: phone,
            role,
            is_active: true
        }).returning(['id', 'username', 'full_name', 'role']);

        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        next(error);
    }
});

// PUT /:id - Update user details
router.put('/:id', async (req, res, next) => {
    try {
        const { full_name, email, phone, role, is_active } = req.body;

        // Prevent deleting/deactivating self if you are the only admin (optional safety check, skipping for now complexity)

        const [updatedUser] = await db('users')
            .where({ id: req.params.id })
            .update({
                full_name,
                email,
                phone_number: phone,
                role,
                is_active,
                updated_at: new Date()
            })
            .returning(['id', 'username', 'full_name', 'role', 'is_active']);

        if (!updatedUser) throw new AppError('User not found', 404);

        res.json({ success: true, data: updatedUser });
    } catch (error) {
        next(error);
    }
});

// POST /:id/reset-password - Admin reset password
router.post('/:id/reset-password', async (req, res, next) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            throw new AppError('Password must be at least 6 characters', 400);
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        const rowsAffected = await db('users')
            .where({ id: req.params.id })
            .update({
                password_hash,
                updated_at: new Date()
            });

        if (!rowsAffected) throw new AppError('User not found', 404);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
