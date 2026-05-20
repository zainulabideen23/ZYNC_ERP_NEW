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
const { runWithRequestContext } = require('../config/requestContext');

const waitForResponseCompletion = (res, next) => new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
        res.off('finish', onFinish);
        res.off('close', onClose);
        res.off('error', onError);
    };

    const onFinish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
    };

    const onClose = () => {
        if (settled) return;
        settled = true;
        cleanup();

        if (res.writableEnded) {
            resolve();
            return;
        }

        reject(new Error('Request closed before response completed'));
    };

    const onError = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
    };

    res.once('finish', onFinish);
    res.once('close', onClose);
    res.once('error', onError);

    try {
        next();
    } catch (error) {
        onError(error);
    }
});

const resolveTenant = async (req, res, next) => {
    try {
        // tenant_id should be in the JWT payload (set during login)
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            throw new AppError('Tenant context missing from token', 401);
        }

        // Bind each request to one DB transaction so tenant context stays connection-local.
        await db.__rawDb.transaction(async (trx) => {
            await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [String(tenantId)]);

            // Verify tenant exists and is active
            const tenant = await trx('tenants')
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

            await runWithRequestContext({ trx, tenantId }, async () => {
                await waitForResponseCompletion(res, next);
            });
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { resolveTenant };
