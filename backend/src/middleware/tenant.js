/**
 * Tenant Resolution Middleware
 * 
 * Reads tenant_id from the JWT token (placed there at login)
 * and attaches it to req.tenantId for downstream use.
 * 
 * Must run AFTER authenticate middleware, BEFORE route handlers.
 * 
 * Also sets PostgreSQL session variable app.tenant_id for RLS.
 */

const { AppError } = require('./errorHandler');
const db = require('../config/database');

const resolveTenant = async (req, res, next) => {
    try {
        // tenant_id should be in the JWT payload (set during login)
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            throw new AppError('Tenant context missing from token', 401);
        }

        // Verify tenant exists and is active
        const tenant = await db('tenants')
            .where({ id: tenantId, is_active: true })
            .first();

        if (!tenant) {
            throw new AppError('Tenant not found or inactive', 403);
        }

        // Check subscription expiry
        if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
            throw new AppError('Tenant subscription has expired', 403);
        }

        // Attach tenant info to request
        req.tenantId = tenantId;
        req.tenant = {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan
        };

        // Set PostgreSQL session variable for RLS
        await db.raw(`SET app.tenant_id = '${tenantId}'`);

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { resolveTenant };
