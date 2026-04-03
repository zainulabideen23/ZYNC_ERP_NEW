/**
 * Tenant-Scoped Query Helper
 * 
 * Wraps Knex queries to automatically scope them by tenant_id.
 * Every service must use tdb() instead of raw db() for tenant-scoped tables.
 * 
 * Usage:
 *   const { tdb } = require('../utils/tenantQuery');
 *   
 *   // In a request handler or service method:
 *   const products = await tdb('products', tenantId).where('is_active', true);
 *   
 *   // With a transaction:
 *   const products = await tdb('products', tenantId, trx).where('is_active', true);
 */

const db = require('../config/database');

/**
 * Returns a Knex query builder pre-filtered by tenant_id.
 * 
 * @param {string} tableName - The table to query
 * @param {string} tenantId - UUID of the current tenant
 * @param {object} [trx] - Optional Knex transaction object
 * @returns {import('knex').Knex.QueryBuilder} Tenant-scoped query builder
 */
const tdb = (tableName, tenantId, trx = null) => {
    if (!tenantId) {
        throw new Error(`tenantId is required for tenant-scoped query on '${tableName}'`);
    }
    const query = trx || db;
    return query(tableName).where(`${tableName}.tenant_id`, tenantId);
};

/**
 * Returns tenant data to include in INSERT operations.
 * 
 * @param {string} tenantId - UUID of the current tenant
 * @returns {{ tenant_id: string }}
 */
const tenantScope = (tenantId) => {
    if (!tenantId) {
        throw new Error('tenantId is required for tenantScope');
    }
    return { tenant_id: tenantId };
};

/**
 * Wraps a Knex insert to automatically include tenant_id.
 * 
 * @param {string} tableName - The table to insert into
 * @param {object|object[]} data - Row(s) to insert
 * @param {string} tenantId - UUID of the current tenant
 * @param {object} [trx] - Optional Knex transaction object
 * @returns {import('knex').Knex.QueryBuilder}
 */
const tInsert = (tableName, data, tenantId, trx = null) => {
    if (!tenantId) {
        throw new Error(`tenantId is required for tenant-scoped insert on '${tableName}'`);
    }
    const query = trx || db;
    const addTenant = (row) => ({ ...row, tenant_id: tenantId });
    const scoped = Array.isArray(data) ? data.map(addTenant) : addTenant(data);
    return query(tableName).insert(scoped);
};

module.exports = { tdb, tenantScope, tInsert };
