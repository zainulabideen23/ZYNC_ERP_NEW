class AuditService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
    }

    /**
     * Log an activity
     */
    async log(data) {
        const {
            user_id,
            action,              // was activity_type
            table_name,          // was entity_type
            record_id,           // was entity_id
            old_values = null,   // was old_value
            new_values = null,   // was new_value
            ip_address = null,
            user_agent = null,
        } = data;

        try {
            await this.db('audit_logs').insert({
                user_id,
                action,
                table_name,
                record_id,
                old_values: old_values ? JSON.stringify(old_values) : null,
                new_values: new_values ? JSON.stringify(new_values) : null,
                ip_address,
                user_agent,
                created_at: new Date(),
                tenant_id: this.tenantId
            });
        } catch (error) {
            console.error('Failed to log audit:', error);
            // We don't throw error here to avoid breaking the main transaction
        }
    }

    /**
     * Get audit logs for an entity
     */
    async getEntityLogs(table_name, record_id) {
        return await this.db('audit_logs as al')
            .leftJoin('users as u', 'al.user_id', 'u.id')
            .select('al.*', 'u.full_name as user_name')
            .where({ 'al.table_name': table_name, 'al.record_id': record_id })
            .where('al.tenant_id', this.tenantId)
            .orderBy('al.created_at', 'desc');
    }

    /**
     * Get recent logs for dashboard
     */
    async getRecentLogs(limit = 20) {
        return await this.db('audit_logs as al')
            .leftJoin('users as u', 'al.user_id', 'u.id')
            .select('al.*', 'u.full_name as user_name')
            .where('al.tenant_id', this.tenantId)
            .orderBy('al.created_at', 'desc')
            .limit(limit);
    }
}

module.exports = AuditService;
