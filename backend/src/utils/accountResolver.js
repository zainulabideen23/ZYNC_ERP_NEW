/**
 * Account Resolver Utility — ZYNC ERP
 *
 * Resolves system account codes to IDs for a given tenant.
 * Call this once at the start of any service method that builds journals.
 */

const { SYSTEM_ACCOUNTS } = require('../constants/accounts');

/**
 * Resolve system account IDs from codes for a given tenant.
 *
 * @param {object} db - Knex instance or transaction
 * @param {string} tenantId
 * @param {string[]} codes - Array of account codes to resolve
 * @returns {object} Map of code → account_id
 */
async function resolveSystemAccounts(db, tenantId, codes) {
    const accounts = await db('accounts')
        .where('tenant_id', tenantId)
        .whereIn('code', codes)
        .where('is_active', true)
        .select('id', 'code');

    const map = {};
    accounts.forEach(a => { map[a.code] = a.id; });

    // Validate all requested codes were found
    const missing = codes.filter(c => !map[c]);
    if (missing.length > 0) {
        throw new Error(
            `System accounts not found for tenant ${tenantId}: ${missing.join(', ')}. ` +
            `Run pending migrations to create missing accounts.`
        );
    }

    return map;
}

module.exports = { resolveSystemAccounts, SYSTEM_ACCOUNTS };
