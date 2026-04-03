const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');
const { phoneRule } = require('../validators/phone.validator');
const { validationResult } = require('express-validator');

// Middleware: All routes require 'admin' role
router.use(authenticate, authorize('admin'));

// GET / - List all users
router.get('/', async (req, res, next) => {
    try {
        const users = await db('users')
            .select('id', 'username', 'full_name', 'email', 'phone_number', 'role', 'is_active', 'last_login', 'created_at')
            .where('tenant_id', req.tenantId)
            .orderBy('created_at', 'desc');

        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
});

// POST / - Create new user
router.post('/', [phoneRule('phone', true)], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, error: errors.array()[0].msg });
        }

        const { username, password, full_name, email, phone, role } = req.body;

        if (!username || !password || !full_name || !role) {
            throw new AppError('Missing required fields', 400);
        }

        // Validate role is valid (no viewer)
        if (!['admin', 'manager', 'cashier'].includes(role)) {
            throw new AppError('Invalid role. Must be admin, manager, or cashier', 400);
        }

        // Check if username already exists
        const existingUser = await db('users').where({ username, tenant_id: req.tenantId }).first();
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
            is_active: true,
            tenant_id: req.tenantId
        }).returning(['id', 'username', 'full_name', 'role']);

        // Audit user creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'users',
            recordId: newUser.id,
            newValues: {
                username: newUser.username,
                role: newUser.role,
                full_name: newUser.full_name
            },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        next(error);
    }
});

// PUT /:id - Update user details
router.put('/:id', async (req, res, next) => {
    try {
        const { full_name, email, phone, role, is_active } = req.body;

        // Validate role if provided
        if (role && !['admin', 'manager', 'cashier'].includes(role)) {
            throw new AppError('Invalid role. Must be admin, manager, or cashier', 400);
        }

        // Fetch user before update for audit
        const userBefore = await db('users')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .select('id', 'username', 'full_name', 'role', 'is_active')
            .first();

        if (!userBefore) throw new AppError('User not found', 404);

        const [updatedUser] = await db('users')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({
                full_name,
                email,
                phone_number: phone,
                role,
                is_active,
                updated_at: new Date()
            })
            .returning(['id', 'username', 'full_name', 'role', 'is_active']);

        // Audit user update
        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'users',
            recordId: req.params.id,
            oldValues: { role: userBefore.role, is_active: userBefore.is_active, full_name: userBefore.full_name },
            newValues: { role: updatedUser.role, is_active: updatedUser.is_active, full_name: updatedUser.full_name },
            ip: req.ip,
            tenantId: req.tenantId
        });

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
            .where({ id: req.params.id, tenant_id: req.tenantId })
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
