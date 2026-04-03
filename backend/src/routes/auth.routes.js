const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const audit = require('../utils/audit');

// Login — now requires tenant slug to identify which tenant's user DB to check
router.post('/login', async (req, res, next) => {
    try {
        const { username, password, tenant } = req.body;

        if (!username || !password) {
            throw new AppError('Username and password are required', 400);
        }

        // Resolve tenant — use provided slug or fall back to default
        const tenantSlug = tenant || process.env.DEFAULT_TENANT_SLUG || 'default';
        const tenantRecord = await db('tenants')
            .where({ slug: tenantSlug, is_active: true })
            .first();

        if (!tenantRecord) {
            throw new AppError('Company not found or inactive', 404);
        }

        // Check subscription expiry
        if (tenantRecord.expires_at && new Date(tenantRecord.expires_at) < new Date()) {
            throw new AppError('Company subscription has expired. Contact support.', 403);
        }

        // Find user within this tenant
        const user = await db('users')
            .where({ username, is_active: true, tenant_id: tenantRecord.id })
            .first();

        if (!user) {
            // Audit failed login attempt
            await audit(db, {
                userId: null,
                action: 'login_failed',
                tableName: 'users',
                recordId: uuid(),
                newValues: { attempted_username: username },
                ip: req.ip,
                tenantId: tenantRecord.id
            });
            throw new AppError('Invalid credentials', 401);
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            // Audit failed login attempt
            await audit(db, {
                userId: null,
                action: 'login_failed',
                tableName: 'users',
                recordId: uuid(),
                newValues: { attempted_username: username },
                ip: req.ip,
                tenantId: tenantRecord.id
            });
            throw new AppError('Invalid credentials', 401);
        }

        // Update last login
        await db('users')
            .where({ id: user.id })
            .update({ last_login: new Date() });

        // Include tenant_id in JWT payload
        const token = jwt.sign(
            { userId: user.id, role: user.role, tenantId: tenantRecord.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.full_name,
                    role: user.role,
                    email: user.email
                },
                tenant: {
                    id: tenantRecord.id,
                    name: tenantRecord.name,
                    slug: tenantRecord.slug,
                    plan: tenantRecord.plan,
                    is_onboarded: tenantRecord.is_onboarded,
                    onboarding_step: tenantRecord.onboarding_step
                }
            }
        });

        // Audit successful login (after response, non-blocking)
        await audit(db, {
            userId: user.id,
            action: 'login',
            tableName: 'users',
            recordId: user.id,
            newValues: { username: user.username, role: user.role },
            ip: req.ip,
            tenantId: tenantRecord.id
        });
    } catch (error) {
        next(error);
    }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = await db('users')
            .where({ id: req.user.id })
            .select('id', 'username', 'full_name', 'email', 'phone_number', 'role', 'last_login')
            .first();

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
});

// Change password
router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw new AppError('Current and new password are required', 400);
        }

        if (newPassword.length < 6) {
            throw new AppError('Password must be at least 6 characters', 400);
        }

        const user = await db('users').where({ id: req.user.id }).first();
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            throw new AppError('Current password is incorrect', 401);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db('users')
            .where({ id: req.user.id })
            .update({ password_hash: hashedPassword, updated_at: new Date() });

        // Audit password change (never log actual passwords)
        await audit(db, {
            userId: req.user.id,
            action: 'password_change',
            tableName: 'users',
            recordId: req.user.id,
            oldValues: null,
            newValues: null,
            ip: req.ip,
            tenantId: req.user.tenantId || req.tenantId
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
