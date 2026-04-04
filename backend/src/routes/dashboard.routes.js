const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authorize } = require('../middleware/auth');

// GET /api/dashboard/recent-activity
// Returns recent audit log entries formatted for display, filtered by role
router.get('/recent-activity', async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const tenantId = req.tenantId;

        let query = db('audit_logs as al')
            .leftJoin('users as u', 'u.id', 'al.user_id')
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
            .where('al.tenant_id', tenantId)
            .orderBy('al.created_at', 'desc');

        if (role === 'admin') {
            // Admin sees everything
            query = query.limit(20);
        } else if (role === 'manager') {
            // Manager sees operations, not system/security events
            query = query
                .whereNotIn('al.table_name', ['users', 'backup', 'company_info'])
                .whereNotIn('al.action', ['login', 'login_failed', 'password_change', 'impersonate'])
                .limit(20);
        } else {
            // Cashier sees only their own actions
            query = query
                .where('al.user_id', userId)
                .limit(15);
        }

        const logs = await query;

        // Format response
        const data = logs.map(log => ({
            id: log.id,
            action: log.action,
            table_name: log.table_name,
            record_id: log.record_id,
            old_values: typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values || {},
            new_values: typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values || {},
            ip_address: log.ip_address,
            created_at: log.created_at,
            user: {
                id: log.user_id,
                username: log.username,
                full_name: log.full_name,
                role: log.role
            }
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
