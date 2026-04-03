/**
 * Platform-Level Tenant Management & Dashboard Routes
 *
 * All routes protected by BOTH:
 *   1. X-Platform-Secret header  (platformSecretAuth)
 *   2. Platform JWT              (platformJwtAuth)
 *
 * Exception: /platform/auth/* — login only needs X-Platform-Secret
 *
 * EXISTING (preserved):
 *   POST   /platform/tenants              → provision new tenant
 *   GET    /platform/tenants              → list all tenants
 *   PATCH  /platform/tenants/:id/activate → activate tenant
 *   PATCH  /platform/tenants/:id/deactivate → deactivate tenant
 *   GET    /platform/tenants/:id/stats    → usage stats for one tenant
 *
 * NEW:
 *   GET    /platform/tenants/:id          → full tenant details + stats
 *   PATCH  /platform/tenants/:id          → edit tenant details
 *   POST   /platform/tenants/:id/impersonate → get impersonation token
 *   GET    /platform/dashboard            → cross-tenant overview
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { platformSecretAuth, platformJwtAuth } = require('../middleware/platformAuth');
const { provisionTenant } = require('../services/tenantProvisioningService');
const logger = require('../utils/logger');

// ─── Mount platform auth sub-router ───
// Login only needs platformSecretAuth (no JWT yet — that's how you GET one)
const platformAuthRoutes = require('./platform.auth.routes');
router.use('/auth', platformSecretAuth, platformAuthRoutes);

// ─── All remaining routes require BOTH secret AND platform JWT ───
router.use(platformSecretAuth);
router.use(platformJwtAuth);

// =====================================================
// GET /platform/dashboard — Cross-tenant overview
// =====================================================
router.get('/dashboard', async (req, res, next) => {
    try {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Tenant counts
        const [totalRow] = await db('tenants').count('* as count');
        const [activeRow] = await db('tenants').where('is_active', true).count('* as count');
        const [inactiveRow] = await db('tenants').where('is_active', false).count('* as count');

        // Expiring soon
        const expiringSoon = await db('tenants')
            .where('is_active', true)
            .whereNotNull('expires_at')
            .where('expires_at', '<=', thirtyDaysFromNow)
            .where('expires_at', '>', now)
            .select('id', 'name', 'slug', 'plan', 'expires_at')
            .orderBy('expires_at', 'asc');

        // Total users across all tenants
        const [usersRow] = await db('users').where('is_active', true).count('* as count');

        // Total revenue across all tenants
        const revenueRow = await db('sales')
            .where('is_deleted', false)
            .sum('total_amount as total')
            .first();

        // New tenants this month
        const [newThisMonth] = await db('tenants')
            .where('created_at', '>=', startOfMonth)
            .count('* as count');

        // Recent activity: last 10 provisioned tenants
        const recentActivity = await db('tenants')
            .select('id', 'name', 'slug', 'plan', 'is_active', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(10);

        res.json({
            success: true,
            data: {
                totalTenants: parseInt(totalRow.count),
                activeTenants: parseInt(activeRow.count),
                inactiveTenants: parseInt(inactiveRow.count),
                tenantsExpiringSoon: expiringSoon,
                totalUsersAcrossAllTenants: parseInt(usersRow.count),
                totalRevenueAcrossAllTenants: parseFloat(revenueRow?.total || 0),
                newTenantsThisMonth: parseInt(newThisMonth.count),
                recentActivity
            }
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// POST /platform/tenants — Provision new tenant
// =====================================================
router.post('/tenants', async (req, res, next) => {
    try {
        const {
            tenantName, tenantSlug,
            adminUsername, adminPassword, adminEmail, adminFullName,
            plan, maxUsers
        } = req.body;

        const result = await provisionTenant({
            tenantName, tenantSlug,
            adminUsername, adminPassword, adminEmail, adminFullName,
            plan, maxUsers
        });

        logger.info(`[Platform] Tenant provisioned by ${req.platformAdmin.email}: ${tenantSlug}`);

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// GET /platform/tenants — List all tenants
// =====================================================
router.get('/tenants', async (req, res, next) => {
    try {
        const tenants = await db('tenants')
            .select('id', 'name', 'slug', 'is_active', 'plan', 'created_at', 'updated_at', 'expires_at', 'max_users')
            .orderBy('created_at', 'desc');

        const userCounts = await db('users')
            .select('tenant_id')
            .count('* as user_count')
            .where('is_active', true)
            .groupBy('tenant_id');

        const countMap = {};
        userCounts.forEach(uc => { countMap[uc.tenant_id] = parseInt(uc.user_count); });

        const enriched = tenants.map(t => ({
            ...t,
            user_count: countMap[t.id] || 0
        }));

        res.json({ success: true, data: enriched });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// GET /platform/tenants/:id — Full tenant details + stats
// =====================================================
router.get('/tenants/:id', async (req, res, next) => {
    try {
        const tenantId = req.params.id;

        const tenant = await db('tenants').where('id', tenantId).first();
        if (!tenant) throw new AppError('Tenant not found', 404);

        const [users] = await db('users').where('tenant_id', tenantId).count('* as count');
        const [activeUsers] = await db('users').where({ tenant_id: tenantId, is_active: true }).count('* as count');
        const [products] = await db('products').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [customers] = await db('customers').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [suppliers] = await db('suppliers').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [sales] = await db('sales').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [purchases] = await db('purchases').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');

        const salesTotal = await db('sales')
            .where({ tenant_id: tenantId, is_deleted: false })
            .sum('total_amount as total')
            .first();

        // Last active: most recent audit log or sale
        const lastAudit = await db('audit_logs')
            .where('tenant_id', tenantId)
            .orderBy('created_at', 'desc')
            .select('created_at')
            .first();

        const lastSale = await db('sales')
            .where({ tenant_id: tenantId, is_deleted: false })
            .orderBy('created_at', 'desc')
            .select('created_at')
            .first();

        const lastActive = [lastAudit?.created_at, lastSale?.created_at]
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0] || null;

        res.json({
            success: true,
            data: {
                tenant,
                stats: {
                    users: parseInt(users.count),
                    activeUsers: parseInt(activeUsers.count),
                    products: parseInt(products.count),
                    customers: parseInt(customers.count),
                    suppliers: parseInt(suppliers.count),
                    sales: parseInt(sales.count),
                    purchases: parseInt(purchases.count),
                    totalRevenue: parseFloat(salesTotal?.total || 0),
                    lastActive
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// PATCH /platform/tenants/:id — Edit tenant details
// =====================================================
router.patch('/tenants/:id', async (req, res, next) => {
    try {
        const tenantId = req.params.id;
        const { name, plan, max_users, expires_at } = req.body;

        const tenant = await db('tenants').where('id', tenantId).first();
        if (!tenant) throw new AppError('Tenant not found', 404);

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (plan !== undefined) updates.plan = plan;
        if (max_users !== undefined) updates.max_users = max_users;
        if (expires_at !== undefined) updates.expires_at = expires_at;

        if (Object.keys(updates).length === 0) {
            throw new AppError('No fields to update. Allowed: name, plan, max_users, expires_at', 400);
        }

        updates.updated_at = new Date();

        const [updated] = await db('tenants')
            .where('id', tenantId)
            .update(updates)
            .returning('*');

        logger.info(`[Platform] Tenant updated by ${req.platformAdmin.email}: ${updated.slug}`);
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// PATCH /platform/tenants/:id/activate
// =====================================================
router.patch('/tenants/:id/activate', async (req, res, next) => {
    try {
        const [tenant] = await db('tenants')
            .where('id', req.params.id)
            .update({ is_active: true, updated_at: new Date() })
            .returning('*');

        if (!tenant) throw new AppError('Tenant not found', 404);

        logger.info(`[Platform] Tenant activated by ${req.platformAdmin.email}: ${tenant.slug}`);
        res.json({ success: true, data: tenant });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// PATCH /platform/tenants/:id/deactivate
// =====================================================
router.patch('/tenants/:id/deactivate', async (req, res, next) => {
    try {
        const [tenant] = await db('tenants')
            .where('id', req.params.id)
            .update({ is_active: false, updated_at: new Date() })
            .returning('*');

        if (!tenant) throw new AppError('Tenant not found', 404);

        logger.info(`[Platform] Tenant deactivated by ${req.platformAdmin.email}: ${tenant.slug}`);
        res.json({ success: true, data: tenant });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// GET /platform/tenants/:id/stats
// =====================================================
router.get('/tenants/:id/stats', async (req, res, next) => {
    try {
        const tenantId = req.params.id;

        const tenant = await db('tenants').where('id', tenantId).first();
        if (!tenant) throw new AppError('Tenant not found', 404);

        const [users] = await db('users').where('tenant_id', tenantId).count('* as count');
        const [products] = await db('products').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [customers] = await db('customers').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [suppliers] = await db('suppliers').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [sales] = await db('sales').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');
        const [purchases] = await db('purchases').where({ tenant_id: tenantId, is_deleted: false }).count('* as count');

        const salesTotal = await db('sales')
            .where({ tenant_id: tenantId, is_deleted: false })
            .sum('total_amount as total')
            .first();

        res.json({
            success: true,
            data: {
                tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
                counts: {
                    users: parseInt(users.count),
                    products: parseInt(products.count),
                    customers: parseInt(customers.count),
                    suppliers: parseInt(suppliers.count),
                    sales: parseInt(sales.count),
                    purchases: parseInt(purchases.count)
                },
                totals: {
                    sales_revenue: parseFloat(salesTotal?.total || 0)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// POST /platform/tenants/:id/impersonate
// =====================================================
router.post('/tenants/:id/impersonate', async (req, res, next) => {
    try {
        const tenantId = req.params.id;

        const tenant = await db('tenants').where('id', tenantId).first();
        if (!tenant) throw new AppError('Tenant not found', 404);

        if (!tenant.is_active) {
            throw new AppError('Cannot impersonate an inactive tenant', 400);
        }

        // Find the tenant's admin user
        const adminUser = await db('users')
            .where({ tenant_id: tenantId, role: 'admin', is_active: true })
            .first();

        if (!adminUser) {
            throw new AppError('No active admin user found for this tenant', 404);
        }

        // Generate impersonation JWT using the TENANT app secret
        const expiresIn = process.env.IMPERSONATION_JWT_EXPIRES_IN || '2h';
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

        const token = jwt.sign(
            {
                userId: adminUser.id,
                role: adminUser.role,
                tenantId: tenantId,
                impersonatedBy: req.platformAdmin.id,
                type: 'impersonation'
            },
            process.env.JWT_SECRET,
            { expiresIn }
        );

        // Log the impersonation
        await db('impersonation_logs').insert({
            platform_admin_id: req.platformAdmin.id,
            tenant_id: tenantId,
            target_user_id: adminUser.id,
            token_expires_at: expiresAt,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.headers['user-agent'] || null
        });

        logger.info(`[Platform] Impersonation by ${req.platformAdmin.email} → ${tenant.slug} (user: ${adminUser.username})`);

        res.json({
            success: true,
            data: {
                token,
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    slug: tenant.slug,
                    plan: tenant.plan
                },
                adminUser: {
                    id: adminUser.id,
                    username: adminUser.username,
                    fullName: adminUser.full_name,
                    role: adminUser.role
                },
                expiresAt: expiresAt.toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
