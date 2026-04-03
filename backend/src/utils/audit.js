/**
 * Audit Logging Utility
 * 
 * Centralized function for writing audit log entries.
 * NEVER throws — audit failures must not break main operations.
 */

const { v4: uuid } = require('uuid');
const logger = require('./logger');

/**
 * Write an audit log entry
 * 
 * @param {object} db - Knex database instance (or transaction)
 * @param {object} params
 * @param {string|null} params.userId - User performing the action (null for login_failed)
 * @param {string} params.action - Action type (create, update, delete, login, login_failed, etc.)
 * @param {string} params.tableName - Table/entity being acted on
 * @param {string} params.recordId - ID of the affected record
 * @param {object|null} params.oldValues - Previous values (for updates)
 * @param {object|null} params.newValues - New values (for creates/updates)
 * @param {string|null} params.ip - Client IP address
 * @param {string} params.tenantId - Tenant ID
 */
const audit = async (db, {
    userId,
    action,
    tableName,
    recordId,
    oldValues = null,
    newValues = null,
    ip = null,
    tenantId
}) => {
    try {
        await db('audit_logs').insert({
            id: uuid(),
            user_id: userId || null,
            action,
            table_name: tableName,
            record_id: recordId,
            old_values: oldValues ? JSON.stringify(oldValues) : null,
            new_values: newValues ? JSON.stringify(newValues) : null,
            ip_address: ip,
            tenant_id: tenantId,
            created_at: new Date()
        });
    } catch (err) {
        // NEVER let audit failure break the main operation
        logger.error('Audit log failed:', err.message);
    }
};

module.exports = audit;
