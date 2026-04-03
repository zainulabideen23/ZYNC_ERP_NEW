/**
 * Platform Auth Routes
 *
 * POST   /platform/auth/login           → login with platform admin credentials
 * GET    /platform/auth/me              → current platform admin profile
 * POST   /platform/auth/change-password → change password
 *
 * Login only requires X-Platform-Secret header.
 * All other routes require X-Platform-Secret + Platform JWT.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { platformJwtAuth } = require('../middleware/platformAuth');
const logger = require('../utils/logger');

// ─── Simple in-memory rate limiter for login ───
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (!record || now - record.windowStart > WINDOW_MS) {
        loginAttempts.set(ip, { windowStart: now, count: 1 });
        return true;
    }

    if (record.count >= MAX_ATTEMPTS) {
        return false;
    }

    record.count++;
    return true;
}

// =====================================================
// POST /platform/auth/login
// Only X-Platform-Secret required (no JWT yet — this is how you GET a JWT)
// =====================================================
router.post('/login', async (req, res, next) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        if (!checkRateLimit(ip)) {
            throw new AppError('Too many login attempts. Try again in 15 minutes.', 429);
        }

        const { email, password } = req.body;
        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        const admin = await db('platform_admins')
            .where({ email: email.toLowerCase().trim(), is_active: true })
            .first();

        if (!admin) {
            throw new AppError('Invalid credentials', 401);
        }

        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            throw new AppError('Invalid credentials', 401);
        }

        // Update last_login
        await db('platform_admins')
            .where('id', admin.id)
            .update({ last_login: new Date(), updated_at: new Date() });

        // Generate platform JWT (different secret from tenant JWT)
        const platformSecret = process.env.PLATFORM_JWT_SECRET;
        if (!platformSecret) {
            throw new AppError('PLATFORM_JWT_SECRET not configured', 500);
        }

        const token = jwt.sign(
            {
                adminId: admin.id,
                email: admin.email,
                type: 'platform_admin'
            },
            platformSecret,
            { expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '8h' }
        );

        logger.info(`[Platform] Admin login: ${admin.email}`);

        res.json({
            success: true,
            data: {
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    fullName: admin.full_name,
                    lastLogin: admin.last_login
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// GET /platform/auth/me
// Requires X-Platform-Secret + Platform JWT
// =====================================================
router.get('/me', platformJwtAuth, async (req, res, next) => {
    try {
        const admin = await db('platform_admins')
            .where('id', req.platformAdmin.id)
            .select('id', 'email', 'full_name', 'is_active', 'last_login', 'created_at')
            .first();

        if (!admin) {
            throw new AppError('Admin not found', 404);
        }

        res.json({
            success: true,
            data: {
                id: admin.id,
                email: admin.email,
                fullName: admin.full_name,
                isActive: admin.is_active,
                lastLogin: admin.last_login,
                createdAt: admin.created_at
            }
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// POST /platform/auth/change-password
// Requires X-Platform-Secret + Platform JWT
// =====================================================
router.post('/change-password', platformJwtAuth, async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            throw new AppError('Old password and new password are required', 400);
        }

        if (newPassword.length < 8) {
            throw new AppError('New password must be at least 8 characters', 400);
        }

        const admin = await db('platform_admins')
            .where('id', req.platformAdmin.id)
            .first();

        const validOld = await bcrypt.compare(oldPassword, admin.password_hash);
        if (!validOld) {
            throw new AppError('Current password is incorrect', 401);
        }

        const newHash = await bcrypt.hash(newPassword, 10);

        await db('platform_admins')
            .where('id', req.platformAdmin.id)
            .update({ password_hash: newHash, updated_at: new Date() });

        logger.info(`[Platform] Password changed for: ${admin.email}`);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
