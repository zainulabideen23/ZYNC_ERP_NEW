/**
 * Migration: Layer 3 - Missing GL Accounts (Tasks 1, 2)
 *
 * - Adds account group 2200 (Tax Liabilities)
 * - Activates account 4002 (Sales Discount)
 * - Adds accounts: 2002 (Tax Payable), 4003 (Sales Returns), 5002 (Purchase Returns), 6004 (Inventory Loss)
 */

exports.up = async function(knex) {
    const tenants = await knex('tenants').where('is_active', true).select('id');

    for (const tenant of tenants) {
        const tid = tenant.id;

        // Step 1: Insert Tax Liabilities group (code 2200) if not exists
        const existingGroup = await knex('account_groups')
            .where({ tenant_id: tid, code: '2200' })
            .first();

        if (!existingGroup) {
            await knex('account_groups').insert({
                tenant_id: tid,
                account_type: 'liability',
                code: '2200',
                name: 'Tax Liabilities',
                description: 'GST and other tax obligations',
                sequence_order: 55,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
            });
        }

        // Get group IDs needed
        const groups = await knex('account_groups')
            .where('tenant_id', tid)
            .whereIn('code', ['2200', '4000', '5000', '6000'])
            .select('id', 'code');

        const groupMap = {};
        groups.forEach(g => { groupMap[g.code] = g.id; });

        // Step 2: Activate account 4002 if it exists
        const discount4002 = await knex('accounts')
            .where({ tenant_id: tid, code: '4002' })
            .first();

        if (discount4002) {
            await knex('accounts')
                .where({ tenant_id: tid, code: '4002' })
                .update({ is_active: true, is_system: true });
        } else {
            // Create it if somehow it doesn't exist
            await knex('accounts').insert({
                tenant_id: tid,
                code: '4002',
                name: 'Sales Discount',
                account_type: 'income',
                group_id: groupMap['4000'],
                opening_balance: 0,
                current_balance: 0,
                is_system: true,
                is_active: true,
                created_at: knex.fn.now(),
            });
        }

        // Step 3: Insert missing accounts (skip if already exists)
        const newAccounts = [
            {
                code: '2002',
                name: 'Tax Payable',
                account_type: 'liability',
                group_code: '2200',
            },
            {
                code: '4003',
                name: 'Sales Returns',
                account_type: 'income',
                group_code: '4000',
            },
            {
                code: '5002',
                name: 'Purchase Returns',
                account_type: 'expense',
                group_code: '5000',
            },
            {
                code: '6004',
                name: 'Inventory Loss',
                account_type: 'expense',
                group_code: '6000',
            },
        ];

        for (const acct of newAccounts) {
            const exists = await knex('accounts')
                .where({ tenant_id: tid, code: acct.code })
                .first();

            if (!exists) {
                await knex('accounts').insert({
                    tenant_id: tid,
                    code: acct.code,
                    name: acct.name,
                    account_type: acct.account_type,
                    group_id: groupMap[acct.group_code],
                    opening_balance: 0,
                    current_balance: 0,
                    is_system: true,
                    is_active: true,
                    created_at: knex.fn.now(),
                });
            }
        }
    }
};

exports.down = async function(knex) {
    // Only remove accounts that were added by this migration
    // FK RESTRICT on ledger_entries.account_id will block deletion if entries exist
    await knex('accounts').whereIn('code', ['2002', '4003', '5002', '6004']).delete();
    await knex('account_groups').where('code', '2200').delete();
    // Revert 4002 to inactive (don't delete — it may have entries)
    await knex('accounts').where('code', '4002').update({ is_active: false, is_system: false });
};
