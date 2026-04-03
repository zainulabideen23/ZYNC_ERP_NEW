/**
 * Platform Admin Authentication Middleware
 *
 * Verifies the platform JWT token (separate from tenant JWT).
 * Used on all /platform/* routes except /platform/auth/login.
 *
 * Platform JWT uses PLATFORM_JWT_SECRET (must differ from JWT_SECRET).
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const db = require('../config/database');

/**
 * Verify X-Platform-Secret header.
 * Applied to ALL /platform/* routes.
 */
const platformSecretAuth = (req, res, next) => {
    const secret = req.headers['x-platform-secret'];
    if (!process.env.PLATFORM_ADMIN_SECRET) {
        return next(new AppError('PLATFORM_ADMIN_SECRET not configured on server', 500));
    }
    if (secret !== process.env.PLATFORM_ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'Forbidden — invalid platform secret' });
    }
    next();
};

/**
 * Verify platform JWT from Authorization header.
 * Applied to all /platform/* routes EXCEPT /platform/auth/login.
 */
const platformJwtAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Platform authentication required', 401);
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.PLATFORM_JWT_SECRET;

        if (!secret) {
            throw new AppError('PLATFORM_JWT_SECRET not configured on server', 500);
        }

        const decoded = jwt.verify(token, secret);

        if (decoded.type !== 'platform_admin') {
            throw new AppError('Invalid token type — expected platform admin token', 401);
        }

        // Verify the admin still exists and is active
        const admin = await db('platform_admins')
            .where({ id: decoded.adminId, is_active: true })
            .first();

        if (!admin) {
            throw new AppError('Platform admin account not found or disabled', 401);
        }

        req.platformAdmin = {
            id: admin.id,
            email: admin.email,
            fullName: admin.full_name
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            next(new AppError('Invalid or expired platform token', 401));
        } else {
            next(error);
        }
    }
};

module.exports = { platformSecretAuth, platformJwtAuth };
