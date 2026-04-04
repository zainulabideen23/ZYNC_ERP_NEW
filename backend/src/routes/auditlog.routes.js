const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');

/**
 * Helper: safely parse JSONB values that may arrive as strings
 */
function safeJson(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return val;            // already parsed by pg driver
    try { return JSON.parse(val); } catch { return null; }
}

// ─── GET /api/audit-logs/meta ────────────────────────────────
// Returns dynamic filter options (users, distinct actions, distinct tables)
router.get('/meta', authorize('admin'), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;

        const [users, actions, tables] = await Promise.all([
            db('users')
                .where('tenant_id', tenantId)
                .select('id', 'username', 'full_name')
                .orderBy('username'),

            db('audit_logs')
                .where('tenant_id', tenantId)
                .distinct('action')
                .orderBy('action')
                .pluck('action'),

            db('audit_logs')
                .where('tenant_id', tenantId)
                .distinct('table_name')
                .orderBy('table_name')
                .pluck('table_name')
        ]);

        res.json({ success: true, users, actions, tables });
    } catch (error) {
        next(error);
    }
});

// ─── GET /api/audit-logs ────────────────────────────────────
// Admin-only listing with filtering and pagination
router.get('/', authorize('admin'), async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const {
            userId,
            action,
            tableName,
            search,
            dateFrom,
            dateTo,
            page = 1,
            limit = 20
        } = req.query;

        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const offset   = (pageNum - 1) * limitNum;

        // ── Build shared filter function ──
        const applyFilters = (qb, { joinUsers = false } = {}) => {
            qb.where('al.tenant_id', tenantId);

            if (userId)    qb.where('al.user_id', userId);
            if (action)    qb.where('al.action', action);
            if (tableName) qb.where('al.table_name', tableName);

            if (dateFrom)  qb.where('al.created_at', '>=', dateFrom);
            if (dateTo) {
                const end = new Date(dateTo);
                end.setDate(end.getDate() + 1);
                qb.where('al.created_at', '<', end.toISOString());
            }

            if (search) {
                const pat = `%${search}%`;
                qb.where(function () {
                    this.whereRaw("CAST(al.new_values AS TEXT) ILIKE ?", [pat])
                        .orWhereRaw("CAST(al.old_values AS TEXT) ILIKE ?", [pat])
                        .orWhere('al.table_name', 'ilike', pat);

                    if (joinUsers) {
                        this.orWhere('u.username', 'ilike', pat)
                            .orWhere('u.full_name', 'ilike', pat);
                    }
                });
            }
        };

        // ── Count query ──
        const countQb = db('audit_logs as al');
        if (search) countQb.leftJoin('users as u', 'u.id', 'al.user_id');
        applyFilters(countQb, { joinUsers: !!search });

        const [{ total }] = await countQb.count('al.id as total');
        const totalNum = parseInt(total) || 0;
        const pages    = Math.ceil(totalNum / limitNum);

        // ── Data query ──
        const dataQb = db('audit_logs as al')
            .leftJoin('users as u', 'u.id', 'al.user_id');
        applyFilters(dataQb, { joinUsers: true });

        const logs = await dataQb
            .select(
                'al.id',
                'al.action',
                'al.table_name',
                'al.record_id',
                'al.old_values',
                'al.new_values',
                'al.ip_address',
                'al.created_at',
                'u.id as user_id',
                'u.username',
                'u.full_name',
                'u.role'
            )
            .orderBy('al.created_at', 'desc')
            .limit(limitNum)
            .offset(offset);

        const data = logs.map(log => ({
            id:          log.id,
            action:      log.action,
            table_name:  log.table_name,
            record_id:   log.record_id,
            old_values:  safeJson(log.old_values),
            new_values:  safeJson(log.new_values),
            ip_address:  log.ip_address,
            created_at:  log.created_at,
            user: {
                id:        log.user_id,
                username:  log.username,
                full_name: log.full_name,
                role:      log.role
            }
        }));

        res.json({
            success: true,
            data,
            pagination: {
                total: totalNum,
                page:  pageNum,
                limit: limitNum,
                pages
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
