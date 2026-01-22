
require('dotenv').config();
const knex = require('../src/config/database');
const { format } = require('date-fns');

async function verifyLedger() {
    console.log('\n🔍 Verifying Ledger Integrity...\n');

    try {
        // 1. Check Total Debits vs Total Credits (Must be Equal)
        const totals = await knex('ledger_entries')
            .select(
                knex.raw('SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END) as total_debits'),
                knex.raw('SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END) as total_credits')
            )
            .first();

        const debits = parseFloat(totals.total_debits || 0);
        const credits = parseFloat(totals.total_credits || 0);
        const diff = Math.abs(debits - credits);

        console.log(`📊 TOTAL VALIDATION:`);
        console.log(`   Total Debits:  ${debits.toLocaleString()}`);
        console.log(`   Total Credits: ${credits.toLocaleString()}`);
        console.log(`   Difference:    ${diff.toLocaleString()}`);

        if (diff < 0.01) {
            console.log('   ✅ PASS: Debits equal Credits');
        } else {
            console.log('   ❌ FAIL: Ledger unbalanced!');
        }

        // 2. Check Trial Balance by Account Group
        console.log('\n📊 TRIAL BALANCE SUMMARY:');
        const trialBalance = await knex('accounts as a')
            .leftJoin('account_groups as ag', 'a.group_id', 'ag.id')
            .leftJoin('ledger_entries as le', 'a.id', 'le.account_id')
            .select(
                'ag.name as group_name',
                'a.name as account_name',
                'a.code',
                knex.raw('SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) as debits'),
                knex.raw('SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) as credits')
            )
            .groupBy('ag.name', 'a.name', 'a.code')
            .orderBy('a.code');

        console.log('   -----------------------------------------------------------------------');
        console.log('   Code  | Account Name              | Debits         | Credits        | Net Balance');
        console.log('   -----------------------------------------------------------------------');

        trialBalance.forEach(row => {
            const d = parseFloat(row.debits || 0);
            const c = parseFloat(row.credits || 0);
            const net = d - c;
            if (d > 0 || c > 0) {
                console.log(`   ${row.code.padEnd(5)} | ${row.account_name.padEnd(25)} | ${d.toFixed(2).padStart(14)} | ${c.toFixed(2).padStart(14)} | ${net.toFixed(2).padStart(14)}`);
            }
        });
        console.log('   -----------------------------------------------------------------------');

        // 3. Verify specific transaction integrity (Journals)
        console.log('\n🔍 CHECKING UNBALANCED JOURNALS:');
        const unbalancedJournals = await knex('ledger_entries')
            .select('journal_id')
            .groupBy('journal_id')
            .having(knex.raw('ABS(SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE -amount END)) > 0.01'));

        if (unbalancedJournals.length === 0) {
            console.log('   ✅ PASS: All journals are balanced.');
        } else {
            console.log(`   ❌ FAIL: Found ${unbalancedJournals.length} unbalanced journals! IDs:`, unbalancedJournals.map(j => j.journal_id));
        }

    } catch (error) {
        console.error('❌ Error verifying ledger:', error);
    } finally {
        await knex.destroy();
    }
}

verifyLedger();
