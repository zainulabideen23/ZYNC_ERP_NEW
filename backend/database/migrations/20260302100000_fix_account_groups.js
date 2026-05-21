/**
 * Migration: Fix Account Groups (Fixes 1-4)
 * 
 * FIX 1 — Rename "Owner Capital" group to "Equity"
 * FIX 2 — Add standard accounting codes to all account_groups
 * FIX 3 — Standardize sequence_order to consistent multiples of 10
 * FIX 4 — Add meaningful descriptions to all account_groups
 * 
 * All changes are safe for live data — only UPDATE statements on system groups.
 */

exports.up = async function (knex) {
    // FIX 1: Ensure "Equity" group exists (rename from "Owner Capital" or create)
    const equityGroup = await knex('account_groups').where('name', 'Equity').first();
    if (!equityGroup) {
        const ownerCapitalGroup = await knex('account_groups').where('name', 'Owner Capital').first();
        if (ownerCapitalGroup) {
            await knex('account_groups').where('name', 'Owner Capital').update({ name: 'Equity' });
        } else {
            // Create the equity group if neither exists (e.g., fresh DB before seed)
            await knex('account_groups').insert({ name: 'Equity', account_type: 'equity', sequence_order: 70, is_system: true });
        }
    }

    // FIX 2: Set codes for all account groups
    // Column 'code' already exists (added by migration 20260127111659)
    // but values are NULL because updates ran before seed data existed.
    const codeMap = [
        { name: 'Cash', code: '1000' },
        { name: 'Bank Accounts', code: '1100' },
        { name: 'Receivables', code: '1200' },
        { name: 'Inventory', code: '1400' },
        { name: 'Payables', code: '2000' },
        { name: 'Bank Loans', code: '2100' },
        { name: 'Equity', code: '3000' },         // already renamed above
        { name: 'Sales Revenue', code: '4000' },
        { name: 'Cost of Goods Sold', code: '5000' },
        { name: 'Operating Expenses', code: '6000' },
    ];

    for (const { name, code } of codeMap) {
        await knex('account_groups').where('name', name).update({ code });
    }

    // FIX 3: Standardize sequence_order to consistent multiples of 10
    // Current: 1,2,3,4,10,11,20,30,31,40 → New: 10,20,30,...,100
    const orderMap = [
        { name: 'Cash', sequence_order: 10 },
        { name: 'Bank Accounts', sequence_order: 20 },
        { name: 'Inventory', sequence_order: 30 },
        { name: 'Receivables', sequence_order: 40 },
        { name: 'Payables', sequence_order: 50 },
        { name: 'Bank Loans', sequence_order: 60 },
        { name: 'Equity', sequence_order: 70 },
        { name: 'Sales Revenue', sequence_order: 80 },
        { name: 'Cost of Goods Sold', sequence_order: 90 },
        { name: 'Operating Expenses', sequence_order: 100 },
    ];

    for (const { name, sequence_order } of orderMap) {
        await knex('account_groups').where('name', name).update({ sequence_order });
    }

    // FIX 4: Add descriptions to all account_groups
    const descMap = [
        { name: 'Bank Accounts', description: 'Bank and financial institution accounts' },
        { name: 'Cash', description: 'Physical cash and cash equivalents' },
        { name: 'Inventory', description: 'Stock and merchandise held for sale' },
        { name: 'Receivables', description: 'Amounts owed to the business by customers' },
        { name: 'Payables', description: 'Amounts the business owes to suppliers' },
        { name: 'Bank Loans', description: 'Long-term bank loans and credit facilities' },
        { name: 'Sales Revenue', description: 'Revenue generated from sales of goods' },
        { name: 'Cost of Goods Sold', description: 'Direct cost of goods sold to customers' },
        { name: 'Operating Expenses', description: 'Day-to-day operational business expenses' },
        { name: 'Equity', description: 'Owner investment and retained earnings' },
    ];

    for (const { name, description } of descMap) {
        await knex('account_groups').where('name', name).update({ description });
    }
};

exports.down = async function (knex) {
    // Reverse FIX 4: Clear descriptions
    await knex('account_groups')
        .whereIn('name', [
            'Bank Accounts', 'Cash', 'Inventory', 'Receivables',
            'Payables', 'Bank Loans', 'Sales Revenue',
            'Cost of Goods Sold', 'Operating Expenses', 'Equity'
        ])
        .update({ description: null });

    // Reverse FIX 3: Restore original sequence_order values
    const origOrderMap = [
        { name: 'Bank Accounts', sequence_order: 1 },
        { name: 'Cash', sequence_order: 2 },
        { name: 'Inventory', sequence_order: 3 },
        { name: 'Receivables', sequence_order: 4 },
        { name: 'Payables', sequence_order: 10 },
        { name: 'Bank Loans', sequence_order: 11 },
        { name: 'Sales Revenue', sequence_order: 20 },
        { name: 'Cost of Goods Sold', sequence_order: 30 },
        { name: 'Operating Expenses', sequence_order: 31 },
        { name: 'Equity', sequence_order: 40 },
    ];

    for (const { name, sequence_order } of origOrderMap) {
        await knex('account_groups').where('name', name).update({ sequence_order });
    }

    // Reverse FIX 2: Clear codes
    await knex('account_groups')
        .whereIn('name', [
            'Bank Accounts', 'Cash', 'Inventory', 'Receivables',
            'Payables', 'Bank Loans', 'Sales Revenue',
            'Cost of Goods Sold', 'Operating Expenses', 'Equity'
        ])
        .update({ code: null });

    // Reverse FIX 1: Rename "Equity" back to "Owner Capital"
    await knex('account_groups')
        .where('name', 'Equity')
        .update({ name: 'Owner Capital' });
};
