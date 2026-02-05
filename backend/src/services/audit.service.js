class AuditService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Log an activity
     */
    async log(data) {
        const {
            user_id,
            activity_type,
            entity_type,
            entity_id,
            old_value = null,
            new_value = null,
            ip_address = null,
            user_agent = null,
            notes = null
        } = data;

        try {
            await this.db('audit_logs').insert({
                user_id,
                activity_type,
                entity_type,
                entity_id,
                old_value: old_value ? JSON.stringify(old_value) : null,
                new_value: new_value ? JSON.stringify(new_value) : null,
                ip_address,
                user_agent,
                notes,
                created_at: new Date()
            });
        } catch (error) {
            console.error('Failed to log audit:', error);
            // We don't throw error here to avoid breaking the main transaction
        }
    }

    /**
     * Get audit logs for an entity
     */
    async getEntityLogs(entity_type, entity_id) {
        return await this.db('audit_logs as al')
            .leftJoin('users as u', 'al.user_id', 'u.id')
            .select('al.*', 'u.full_name as user_name')
            .where({ entity_type, entity_id })
            .orderBy('al.created_at', 'desc');
    }

    /**
     * Get recent logs for dashboard
     */
    async getRecentLogs(limit = 20) {
        return await this.db('audit_logs as al')
            .leftJoin('users as u', 'al.user_id', 'u.id')
            .select('al.*', 'u.full_name as user_name')
            .orderBy('al.created_at', 'desc')
            .limit(limit);
    }
}

module.exports = AuditService;
