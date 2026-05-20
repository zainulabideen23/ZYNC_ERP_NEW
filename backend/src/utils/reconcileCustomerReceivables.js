const { resolveSystemAccounts, SYSTEM_ACCOUNTS } = require('./accountResolver');

async function reconcileCustomerReceivables(db, tenantId) {
    console.log('=== CUSTOMER RECEIVABLES RECONCILIATION ===\n');
    
    // Step 1: Get all receivables accounts
    const accounts = await db('accounts')
        .where({ tenant_id: tenantId, is_active: true })
        .whereIn('code', ['1201', '1204', '1205', '1206', '1207', '1208'])
        .orderBy('code');
    
    console.log('GL Accounts Found:');
    let glTotal = 0;
    for (const acc of accounts) {
        const balance = Number(acc.current_balance || 0);
        console.log(`  ${acc.code} - ${acc.name}: Rs. ${balance.toLocaleString()}`);
        glTotal += balance;
    }
    console.log(`  Total GL Receivables: Rs. ${glTotal.toLocaleString()}\n`);
    
    // Step 2: Get customer table balances
    const customers = await db('customers')
        .where({ tenant_id: tenantId, is_deleted: false })
        .select('id', 'name', 'current_balance');
    
    console.log('Customer Table Balances:');
    let customerTotal = 0;
    for (const c of customers) {
        const balance = Number(c.current_balance || 0);
        console.log(`  ${c.name}: Rs. ${balance.toLocaleString()}`);
        customerTotal += balance;
    }
    console.log(`  Total Customer Balances: Rs. ${customerTotal.toLocaleString()}\n`);
    
    // Step 3: Comparison
    console.log('=== RECONCILIATION STATUS ===');
    console.log(`GL Total:        Rs. ${glTotal.toLocaleString()}`);
    console.log(`Customer Total: Rs. ${customerTotal.toLocaleString()}`);
    console.log(`Difference:     Rs. ${Math.abs(glTotal - customerTotal).toLocaleString()}`);
    console.log(`Status: ${glTotal === customerTotal ? 'BALANCED' : 'MISMATCHED'}\n`);
    
    // Step 4: Identify what needs fixing
    const main1201 = accounts.find(a => a.code === '1201');
    const individualAccounts = accounts.filter(a => a.code >= '1204' && a.code <= '1208');
    
    console.log('=== ACTION REQUIRED ===');
    console.log(`1. Main 1201 Current Balance: Rs. ${Number(main1201?.current_balance || 0).toLocaleString()}`);
    console.log(`2. Individual Accounts Total: Rs. ${individualAccounts.reduce((s,a) => s + Number(a.current_balance||0), 0).toLocaleString()}`);
    
    if (individualAccounts.reduce((s,a) => s + Number(a.current_balance||0), 0) > 0) {
        console.log(`\n⚠️  INDIVIDUAL ACCOUNTS HAVE BALANCES - NEEDS MIGRATION`);
    }
    
    return {
        glTotal,
        customerTotal,
        difference: glTotal - customerTotal,
        isBalanced: glTotal === customerTotal,
        accounts,
        customers
    };
}

module.exports = { reconcileCustomerReceivables };