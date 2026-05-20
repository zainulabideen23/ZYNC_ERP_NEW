const { AppError } = require('../middleware/errorHandler');

function normalizeAllowedTypes(allowedTypes) {
    if (Array.isArray(allowedTypes)) return allowedTypes.filter(Boolean);
    if (typeof allowedTypes === 'string' && allowedTypes.trim()) return [allowedTypes.trim()];
    return [];
}

/**
 * Validate account type expectations for a set of account IDs.
 *
 * @param {object} trx Knex transaction/query builder
 * @param {string} tenantId
 * @param {Array<{accountId: string, allowedTypes: string[]|string, label?: string}>} rules
 */
async function validateAccountTypes(trx, tenantId, rules = []) {
    const normalizedRules = (rules || [])
        .filter((rule) => rule && rule.accountId)
        .map((rule) => ({
            accountId: rule.accountId,
            allowedTypes: normalizeAllowedTypes(rule.allowedTypes),
            label: rule.label || 'Account',
        }));

    if (normalizedRules.length === 0) return;

    const uniqueIds = [...new Set(normalizedRules.map((rule) => rule.accountId))];

    const accounts = await trx('accounts')
        .where('tenant_id', tenantId)
        .whereIn('id', uniqueIds)
        .select('id', 'code', 'name', 'account_type', 'is_active');

    const byId = new Map(accounts.map((account) => [account.id, account]));

    for (const rule of normalizedRules) {
        const account = byId.get(rule.accountId);
        if (!account) {
            throw new AppError(`${rule.label} not found for the current tenant`, 400);
        }

        if (!account.is_active) {
            throw new AppError(`${rule.label} (${account.code}) is inactive`, 400);
        }

        if (rule.allowedTypes.length > 0 && !rule.allowedTypes.includes(account.account_type)) {
            throw new AppError(
                `${rule.label} (${account.code}) must be one of: ${rule.allowedTypes.join(', ')}. ` +
                `Found: ${account.account_type}`,
                400
            );
        }
    }
}

module.exports = { validateAccountTypes };
