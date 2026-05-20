async function migrateCustomerReceivables(db, tenantId) {
    console.log('=== MIGRATING CUSTOMER RECEIVABLES ===\n');
    
    return db.transaction(async (trx) => {
        // Step 1: Get individual customer account IDs
        const individualAccounts = await trx('accounts')
            .where({ tenant_id: tenantId })
            .whereIn('code', ['1204', '1205', '1206', '1207', '1208'])
            .select('id', 'code', 'name', 'current_balance');
        
        console.log(`Found ${individualAccounts.length} individual accounts to migrate\n`);
        
        // Step 2: Get main 1201 account
        const mainAccount = await trx('accounts')
            .where({ tenant_id: tenantId, code: '1201' })
            .first();
        
        if (!mainAccount) {
            throw new Error('Main Customer Receivables (1201) not found');
        }
        
        // Step 3: Calculate total to transfer
        let totalToTransfer = 0;
        for (const acc of individualAccounts) {
            const balance = Number(acc.current_balance || 0);
            if (balance !== 0) {
                console.log(`  ${acc.code} (${acc.name}): Rs. ${balance.toLocaleString()}`);
                totalToTransfer += balance;
            }
        }
        
        console.log(`\nTotal to transfer to 1201: Rs. ${totalToTransfer.toLocaleString()}\n`);
        
        // If nothing to transfer, exit
        if (totalToTransfer === 0) {
            console.log('✓ No balances to migrate - all individual accounts already at 0\n');
            return { success: true, message: 'No migration needed', amount_transferred: 0 };
        }
        
        // Step 4: Create journal entry to consolidate
        const journalNumber = await generateMigrationJournalNumber(trx, tenantId);
        
        const journalEntries = [];
        
        // Credit: Take from individual accounts (reducing the balance)
        for (const acc of individualAccounts) {
            if (Number(acc.current_balance || 0) !== 0) {
                const amount = Math.abs(Number(acc.current_balance || 0));
                journalEntries.push({
                    account_id: acc.id,
                    entry_type: 'credit',
                    amount: amount,
                    description: `Migration - Consolidation to 1201`
                });
            }
        }
        
        // Debit: Put into main 1201
        journalEntries.push({
            account_id: mainAccount.id,
            entry_type: 'debit',
            amount: Math.abs(totalToTransfer),
            description: `Migration - Consolidation from individual accounts`
        });
        
        // Create journal
        const [journal] = await trx('journals').insert({
            journal_number: journalNumber,
            journal_date: new Date(),
            transaction_type: 'adjustment',
            reference_type: 'adjustment',
            narration: 'Customer Receivables Consolidation - Migration',
            total_debit: Math.abs(totalToTransfer),
            total_credit: Math.abs(totalToTransfer),
            is_balanced: true,
            created_by: 'system',
            tenant_id: tenantId
        }).returning('*');
        
        // Create ledger entries
        for (const entry of journalEntries) {
            await trx('ledger_entries').insert({
                journal_id: journal.id,
                account_id: entry.account_id,
                tenant_id: tenantId,
                entry_type: entry.entry_type,
                amount: entry.amount,
                description: entry.description,
                created_by: 'system'
            });
        }
        
        // Step 5: Update account balances
        for (const acc of individualAccounts) {
            await trx('accounts')
                .where({ id: acc.id })
                .update({ 
                    current_balance: 0,
                    is_active: false
                });
        }
        
        // Update main 1201
        const newMainBalance = Number(mainAccount.current_balance || 0) + totalToTransfer;
        await trx('accounts')
            .where({ id: mainAccount.id })
            .update({ current_balance: newMainBalance });
        
        console.log(`✓ Migration complete!`);
        console.log(`  Journal: ${journalNumber}`);
        console.log(`  1201 new balance: Rs. ${newMainBalance.toLocaleString()}\n`);
        
        return { success: true, journal_number: journalNumber, amount_transferred: totalToTransfer };
    });
}

async function generateMigrationJournalNumber(trx, tenantId) {
    const prefix = 'MIG-';
    
    // Try to get or create sequence
    let seq = await trx('sequences')
        .where({ name: 'migration', tenant_id: tenantId })
        .first();
    
    let currentValue = 1;
    
    if (!seq) {
        await trx('sequences').insert({
            name: 'migration',
            prefix: prefix,
            current_value: 1,
            pad_length: 6,
            tenant_id: tenantId
        });
    } else {
        currentValue = Number(seq.current_value) + 1;
        await trx('sequences')
            .where({ name: 'migration', tenant_id: tenantId })
            .update({ current_value: currentValue });
    }
    
    return `${prefix}${String(currentValue).padStart(6, '0')}`;
}

module.exports = { migrateCustomerReceivables };