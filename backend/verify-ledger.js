const knex = require('knex')({ client: 'pg', connection: { host: 'localhost', user: 'postgres', password: 'postgres', database: 'zync_erp' } });

async function verify() {
    const tenantId = 'c972d614-3fbb-426e-a8b2-ce8fd816197d';
    
    console.log('=== CUSTOMER ACCOUNTS ===');
    const cust = await knex('accounts').whereBetween('code', ['1204', '1299']).where('tenant_id', tenantId).orderBy('code');
    let ledgerSum = 0;
    
    for (const a of cust) {
        const entries = await knex('ledger_entries').where('tenant_id', tenantId).where('account_id', a.id)
            .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END), 0) as debit_total'))
            .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END), 0) as credit_total'))
            .first();
        
        const ledgerBalance = parseFloat(entries.debit_total) - parseFloat(entries.credit_total);
        console.log(a.code, '| Ledger:', ledgerBalance.toLocaleString(), '| current:', a.current_balance);
        ledgerSum += ledgerBalance;
    }
    
    const c1201 = await knex('accounts').where('code', '1201').where('tenant_id', tenantId).first();
    const e1201 = await knex('ledger_entries').where('tenant_id', tenantId).where('account_id', c1201.id)
        .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END), 0) as debit_total'))
        .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END), 0) as credit_total'))
        .first();
    
    const lb1201 = parseFloat(e1201.debit_total) - parseFloat(e1201.credit_total);
    
    console.log('\n--- CUSTOMER SUMMARY ---');
    console.log('Sum of individual ledger balances:', ledgerSum.toLocaleString());
    console.log('1201 ledger balance:', lb1201.toLocaleString());
    console.log('1201 current_balance:', c1201.current_balance);
    console.log('Match (ledger vs current):', lb1201 == c1201.current_balance ? '✓' : '✗');
    
    console.log('\n=== SUPPLIER ACCOUNTS ===');
    const sup = await knex('accounts').whereBetween('code', ['2204', '2299']).where('tenant_id', tenantId).orderBy('code');
    let supSum = 0;
    
    for (const a of sup) {
        const entries = await knex('ledger_entries').where('tenant_id', tenantId).where('account_id', a.id)
            .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END), 0) as debit_total'))
            .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END), 0) as credit_total'))
            .first();
        
        const ledgerBalance = parseFloat(entries.credit_total) - parseFloat(entries.debit_total); // Liability: credit - debit
        console.log(a.code, '| Ledger:', ledgerBalance.toLocaleString(), '| current:', a.current_balance);
        supSum += ledgerBalance;
    }
    
    const c2001 = await knex('accounts').where('code', '2001').where('tenant_id', tenantId).first();
    const e2001 = await knex('ledger_entries').where('tenant_id', tenantId).where('account_id', c2001.id)
        .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'debit\' THEN amount ELSE 0 END), 0) as debit_total'))
        .select(knex.raw('COALESCE(SUM(CASE WHEN entry_type = \'credit\' THEN amount ELSE 0 END), 0) as credit_total'))
        .first();
    
    const lb2001 = parseFloat(e2001.credit_total) - parseFloat(e2001.debit_total);
    
    console.log('\n--- SUPPLIER SUMMARY ---');
    console.log('Sum of individual ledger balances:', supSum.toLocaleString());
    console.log('2001 ledger balance:', lb2001.toLocaleString());
    console.log('2001 current_balance:', c2001.current_balance);
    console.log('Match (ledger vs current):', lb2001 == c2001.current_balance ? '✓' : '✗');
    
    console.log('\n=== FINAL VERIFICATION ===');
    console.log('1201:', lb1201, '== sum of 1204-1299:', ledgerSum, '|', lb1201 == ledgerSum ? '✓ SYNCED' : '✗ MISMATCH');
    console.log('2001:', lb2001, '== sum of 2204-2299:', supSum, '|', lb2001 == supSum ? '✓ SYNCED' : '✗ MISMATCH');
    
    await knex.destroy();
}

verify().catch(console.error);