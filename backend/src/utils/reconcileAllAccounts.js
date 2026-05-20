function calculateAccountBalance(accountType, opening, debitTotal, creditTotal) {
    const debits = Number(debitTotal || 0);
    const credits = Number(creditTotal || 0);

    if (accountType === 'asset' || accountType === 'expense') {
        return Number(opening || 0) + debits - credits;
    }

    return Number(opening || 0) + credits - debits;
}

async function reconcileAllAccounts(db, tenantId) {
    const results = {
        accounts_with_opening_no_journal: [],
        unbalanced_journals: [],
        ledger_gl_mismatch: [],
        customer_receivables_issues: [],
    };

    const accountsWithOpening = await db('accounts')
        .where({ tenant_id: tenantId })
        .whereNot('opening_balance', 0);

    for (const account of accountsWithOpening) {
        const hasOpeningJournal = await db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .where('le.account_id', account.id)
            .where('j.transaction_type', 'opening')
            .first('le.id');

        if (!hasOpeningJournal) {
            results.accounts_with_opening_no_journal.push({
                id: account.id,
                code: account.code,
                name: account.name,
                opening_balance: account.opening_balance,
            });
        }
    }

    results.unbalanced_journals = await db('journals')
        .where({ tenant_id: tenantId })
        .whereRaw('ABS(total_debit - total_credit) > 0.01');

    const allAccounts = await db('accounts').where({ tenant_id: tenantId });
    for (const account of allAccounts) {
        const ledgerBalance = await db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .where('le.account_id', account.id)
            .where('j.tenant_id', tenantId)
            .first(
                db.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) as debit_total"),
                db.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) as credit_total")
            );

        const computedBalance = calculateAccountBalance(
            account.account_type,
            account.opening_balance,
            ledgerBalance?.debit_total,
            ledgerBalance?.credit_total
        );

        if (Math.abs(computedBalance - Number(account.current_balance || 0)) > 0.01) {
            results.ledger_gl_mismatch.push({
                code: account.code,
                name: account.name,
                stored_balance: account.current_balance,
                computed_balance: computedBalance,
                difference: computedBalance - Number(account.current_balance || 0),
            });
        }
    }

    return results;
}

module.exports = { reconcileAllAccounts, calculateAccountBalance };