/**
 * Accounting engine schema/integrity hardening.
 *
 * - Adds missing transaction_type enum values.
 * - Enforces tenant-scoped uniqueness for accounts/account_groups.
 * - Enforces accounts -> account_groups tenant/type consistency.
 * - Relaxes ledger amount check to allow zero-value rounding rows.
 * - Enforces journals.is_balanced consistency at DB level.
 * - Adds reporting/performance indexes.
 * - Ensures sequences tenant FK cascades on tenant deletion.
 * - Backfills missing customer/supplier opening-balance journals.
 */

const CURRENCY_TOLERANCE = 0.01;

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function getTenantIds(knex) {
    const hasTenants = await knex.schema.hasTable('tenants');
    if (hasTenants) {
        const rows = await knex('tenants').select('id');
        return rows.map((row) => row.id);
    }

    const rows = await knex('accounts')
        .whereNotNull('tenant_id')
        .distinct('tenant_id');

    return rows.map((row) => row.tenant_id);
}

async function ensureJournalSequence(knex, tenantId) {
    const existing = await knex('sequences')
        .where({ tenant_id: tenantId, name: 'journal' })
        .first();

    if (existing) return;

    await knex('sequences').insert({
        tenant_id: tenantId,
        name: 'journal',
        prefix: 'JRN-',
        current_value: 0,
        pad_length: 6,
        is_active: true,
        description: 'Journal numbering',
    });
}

async function nextJournalNumber(knex, tenantId) {
    await ensureJournalSequence(knex, tenantId);

    const sequence = await knex('sequences')
        .where({ tenant_id: tenantId, name: 'journal' })
        .forUpdate()
        .first();

    if (!sequence) {
        throw new Error(`Journal sequence not found for tenant ${tenantId}`);
    }

    const nextValue = Number(sequence.current_value || 0) + 1;
    const prefix = sequence.prefix || 'JRN-';
    const padLength = Number(sequence.pad_length || 6);

    await knex('sequences')
        .where({ tenant_id: tenantId, name: 'journal' })
        .update({ current_value: nextValue });

    return `${prefix}${String(nextValue).padStart(padLength, '0')}`;
}

async function resolveOpeningOffsetAccountId(knex, tenantId) {
    const ownerCapital = await knex('accounts')
        .where({ tenant_id: tenantId, code: '3001', is_active: true })
        .first('id');

    if (ownerCapital?.id) return ownerCapital.id;

    const retainedEarnings = await knex('accounts')
        .where({ tenant_id: tenantId, code: '3002', is_active: true })
        .first('id');

    return retainedEarnings?.id || null;
}

async function accountHasOpeningJournal(knex, tenantId, accountId) {
    const row = await knex('ledger_entries as le')
        .join('journals as j', 'le.journal_id', 'j.id')
        .where('le.tenant_id', tenantId)
        .where('j.tenant_id', tenantId)
        .where('le.account_id', accountId)
        .where('j.reference_type', 'opening')
        .first('le.id');

    return Boolean(row);
}

async function insertOpeningJournal({
    knex,
    tenantId,
    partyLabel,
    partyId,
    partyAccountId,
    offsetAccountId,
    amount,
    partyEntryType,
    offsetEntryType,
}) {
    const journalNumber = await nextJournalNumber(knex, tenantId);
    const normalizedAmount = roundCurrency(amount);

    const [journal] = await knex('journals').insert({
        tenant_id: tenantId,
        journal_number: journalNumber,
        journal_date: new Date(),
        reference_type: 'opening',
        reference_id: partyId,
        description: `Opening Balance - ${partyLabel}`,
        total_debit: normalizedAmount,
        total_credit: normalizedAmount,
        is_balanced: true,
        created_at: knex.fn.now(),
    }).returning(['id']);

    await knex('ledger_entries').insert([
        {
            tenant_id: tenantId,
            journal_id: journal.id,
            account_id: partyAccountId,
            entry_type: partyEntryType,
            amount: normalizedAmount,
            description: `Opening balance ${partyLabel}`,
            created_at: knex.fn.now(),
        },
        {
            tenant_id: tenantId,
            journal_id: journal.id,
            account_id: offsetAccountId,
            entry_type: offsetEntryType,
            amount: normalizedAmount,
            description: `Opening offset ${partyLabel}`,
            created_at: knex.fn.now(),
        },
    ]);
}

async function recomputeAccountBalance(knex, tenantId, accountId) {
    const account = await knex('accounts')
        .where({ tenant_id: tenantId, id: accountId })
        .first('opening_balance', 'account_type');

    if (!account) return;

    const totals = await knex('ledger_entries as le')
        .join('journals as j', 'le.journal_id', 'j.id')
        .where('le.tenant_id', tenantId)
        .where('j.tenant_id', tenantId)
        .where('le.account_id', accountId)
        .first(
            knex.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) as debit_total"),
            knex.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) as credit_total")
        );

    const openingBalance = Number(account.opening_balance || 0);
    const debitTotal = Number(totals?.debit_total || 0);
    const creditTotal = Number(totals?.credit_total || 0);

    const computed = ['asset', 'expense'].includes(account.account_type)
        ? openingBalance + debitTotal - creditTotal
        : openingBalance + creditTotal - debitTotal;

    await knex('accounts')
        .where({ tenant_id: tenantId, id: accountId })
        .update({
            current_balance: roundCurrency(computed),
            updated_at: knex.fn.now(),
        });
}

async function backfillOpeningJournalsForPartyTable({
    knex,
    tenantId,
    tableName,
    partyType,
    touchedAccounts,
}) {
    const offsetAccountId = await resolveOpeningOffsetAccountId(knex, tenantId);
    if (!offsetAccountId) return;

    const partyRows = await knex(tableName)
        .where({ tenant_id: tenantId, is_deleted: false })
        .whereNotNull('account_id')
        .whereRaw('COALESCE(opening_balance, 0) > ?', [CURRENCY_TOLERANCE])
        .select('id', 'code', 'name', 'opening_balance', 'account_id');

    for (const party of partyRows) {
        const openingAmount = roundCurrency(Number(party.opening_balance || 0));
        if (!Number.isFinite(openingAmount) || openingAmount <= CURRENCY_TOLERANCE) {
            continue;
        }

        const hasOpeningJournal = await accountHasOpeningJournal(knex, tenantId, party.account_id);
        if (hasOpeningJournal) {
            continue;
        }

        const existingByReference = await knex('journals')
            .where({
                tenant_id: tenantId,
                reference_type: 'opening',
                reference_id: party.id,
            })
            .first('id');

        if (existingByReference) {
            continue;
        }

        const partyLabel = `${partyType} ${party.code || party.name || party.id}`;

        if (partyType === 'customer') {
            await insertOpeningJournal({
                knex,
                tenantId,
                partyLabel,
                partyId: party.id,
                partyAccountId: party.account_id,
                offsetAccountId,
                amount: openingAmount,
                partyEntryType: 'debit',
                offsetEntryType: 'credit',
            });
        } else {
            await insertOpeningJournal({
                knex,
                tenantId,
                partyLabel,
                partyId: party.id,
                partyAccountId: party.account_id,
                offsetAccountId,
                amount: openingAmount,
                partyEntryType: 'credit',
                offsetEntryType: 'debit',
            });
        }

        touchedAccounts.add(party.account_id);
        touchedAccounts.add(offsetAccountId);
    }
}

exports.up = async function up(knex) {
    // 1) transaction_type enum support for returns/expenses.
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'sale_return';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'purchase_return';
                ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'expense';
            END IF;
        END $$;
    `);

    const hasAccounts = await knex.schema.hasTable('accounts');
    const hasAccountGroups = await knex.schema.hasTable('account_groups');
    const hasJournals = await knex.schema.hasTable('journals');
    const hasLedgerEntries = await knex.schema.hasTable('ledger_entries');
    const hasSequences = await knex.schema.hasTable('sequences');
    const hasTenants = await knex.schema.hasTable('tenants');

    const hasAccountsTenant = hasAccounts && await knex.schema.hasColumn('accounts', 'tenant_id');
    const hasGroupsTenant = hasAccountGroups && await knex.schema.hasColumn('account_groups', 'tenant_id');

    // 2) account_groups tenant hygiene + tenant-scoped uniqueness.
    if (hasAccountGroups && hasGroupsTenant) {
        if (hasTenants) {
            const defaultTenant = await knex('tenants').select('id').orderBy('created_at', 'asc').first();
            if (defaultTenant?.id) {
                await knex('account_groups')
                    .whereNull('tenant_id')
                    .update({ tenant_id: defaultTenant.id });
            }
        }

        await knex.raw(`
            DO $$
            DECLARE rec RECORD;
            BEGIN
                FOR rec IN
                    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
                    FROM pg_constraint c
                    WHERE c.conrelid = 'account_groups'::regclass
                      AND c.contype = 'u'
                LOOP
                    IF rec.def ILIKE '%(account_type, name)%'
                       OR rec.def ILIKE '%(name, account_type)%' THEN
                        EXECUTE format('ALTER TABLE account_groups DROP CONSTRAINT IF EXISTS %I', rec.conname);
                    END IF;
                END LOOP;
            END $$;
        `);

        const duplicateGroups = await knex('account_groups')
            .select('tenant_id', 'account_type', 'name')
            .count('* as count')
            .groupBy('tenant_id', 'account_type', 'name')
            .havingRaw('COUNT(*) > 1')
            .first();

        if (duplicateGroups) {
            throw new Error('Cannot enforce tenant-scoped account_group uniqueness: duplicate rows exist.');
        }

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'account_groups'::regclass
                      AND conname = 'uq_account_groups_tenant_type_name'
                ) THEN
                    ALTER TABLE account_groups
                        ADD CONSTRAINT uq_account_groups_tenant_type_name
                        UNIQUE (tenant_id, account_type, name);
                END IF;
            END $$;
        `);

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'account_groups'::regclass
                      AND conname = 'uq_account_groups_id_tenant'
                ) THEN
                    ALTER TABLE account_groups
                        ADD CONSTRAINT uq_account_groups_id_tenant
                        UNIQUE (id, tenant_id);
                END IF;
            END $$;
        `);
    }

    // 3) accounts.code must be tenant scoped.
    if (hasAccounts && hasAccountsTenant) {
        await knex.raw(`
            DO $$
            DECLARE rec RECORD;
            BEGIN
                FOR rec IN
                    SELECT c.conname
                    FROM pg_constraint c
                    JOIN pg_attribute a
                      ON a.attrelid = c.conrelid
                     AND a.attnum = ANY (c.conkey)
                    WHERE c.conrelid = 'accounts'::regclass
                      AND c.contype = 'u'
                    GROUP BY c.conname, c.conkey
                    HAVING array_length(c.conkey, 1) = 1
                       AND bool_or(a.attname = 'code')
                LOOP
                    EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS %I', rec.conname);
                END LOOP;
            END $$;
        `);

        const duplicateCodes = await knex('accounts')
            .select('tenant_id', 'code')
            .count('* as count')
            .groupBy('tenant_id', 'code')
            .havingRaw('COUNT(*) > 1')
            .first();

        if (duplicateCodes) {
            throw new Error('Cannot enforce tenant-scoped account code uniqueness: duplicate account codes exist in a tenant.');
        }

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts'::regclass
                      AND conname = 'uq_accounts_tenant_code'
                ) THEN
                    ALTER TABLE accounts
                        ADD CONSTRAINT uq_accounts_tenant_code
                        UNIQUE (tenant_id, code);
                END IF;
            END $$;
        `);
    }

    // 4) Enforce account group tenant/type consistency from DB.
    if (hasAccounts && hasAccountGroups && hasAccountsTenant && hasGroupsTenant) {
        await knex.raw(`
            DO $$
            DECLARE rec RECORD;
            BEGIN
                FOR rec IN
                    SELECT c.conname
                    FROM pg_constraint c
                    JOIN pg_attribute a
                      ON a.attrelid = c.conrelid
                     AND a.attnum = ANY (c.conkey)
                    WHERE c.conrelid = 'accounts'::regclass
                      AND c.confrelid = 'account_groups'::regclass
                      AND c.contype = 'f'
                    GROUP BY c.conname, c.conkey
                    HAVING bool_or(a.attname = 'group_id')
                LOOP
                    EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS %I', rec.conname);
                END LOOP;
            END $$;
        `);

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts'::regclass
                      AND conname = 'accounts_group_id_tenant_foreign'
                ) THEN
                    ALTER TABLE accounts
                        ADD CONSTRAINT accounts_group_id_tenant_foreign
                        FOREIGN KEY (group_id, tenant_id)
                        REFERENCES account_groups(id, tenant_id)
                        ON DELETE RESTRICT;
                END IF;
            END $$;
        `);

        await knex.raw(`
            CREATE OR REPLACE FUNCTION enforce_account_group_type_tenant_match()
            RETURNS TRIGGER AS $$
            DECLARE group_row RECORD;
            BEGIN
                SELECT tenant_id, account_type
                INTO group_row
                FROM account_groups
                WHERE id = NEW.group_id;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Account group % not found', NEW.group_id;
                END IF;

                IF group_row.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
                    RAISE EXCEPTION 'Account tenant % does not match group tenant %', NEW.tenant_id, group_row.tenant_id;
                END IF;

                IF group_row.account_type::text <> NEW.account_type::text THEN
                    RAISE EXCEPTION 'Account type % does not match group type %', NEW.account_type, group_row.account_type;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await knex.raw(`
            DROP TRIGGER IF EXISTS trg_enforce_account_group_type_tenant_match ON accounts;
            CREATE TRIGGER trg_enforce_account_group_type_tenant_match
            BEFORE INSERT OR UPDATE OF group_id, account_type, tenant_id ON accounts
            FOR EACH ROW
            EXECUTE FUNCTION enforce_account_group_type_tenant_match();
        `);
    }

    // 5) journals.is_balanced must match totals.
    if (hasJournals) {
        await knex('journals').update({
            is_balanced: knex.raw('ABS(total_debit - total_credit) < 0.01'),
        });

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'journals'::regclass
                      AND conname = 'journals_is_balanced_consistency_chk'
                ) THEN
                    ALTER TABLE journals
                        ADD CONSTRAINT journals_is_balanced_consistency_chk
                        CHECK (is_balanced = (ABS(total_debit - total_credit) < 0.01));
                END IF;
            END $$;
        `);

        await knex.raw('CREATE INDEX IF NOT EXISTS idx_journals_tenant_accounting_date ON journals(tenant_id, journal_date, id);');
    }

    // 6) ledger amount constraint and performance index.
    if (hasLedgerEntries) {
        await knex.raw(`
            DO $$
            DECLARE rec RECORD;
            BEGIN
                FOR rec IN
                    SELECT c.conname
                    FROM pg_constraint c
                    WHERE c.conrelid = 'ledger_entries'::regclass
                      AND c.contype = 'c'
                      AND regexp_replace(pg_get_constraintdef(c.oid), '\\s+', ' ', 'g') ~* 'amount\\s*>\\s*0'
                LOOP
                    EXECUTE format('ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS %I', rec.conname);
                END LOOP;
            END $$;
        `);

        await knex.raw(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'ledger_entries'::regclass
                      AND conname = 'ledger_entries_amount_non_negative_chk'
                ) THEN
                    ALTER TABLE ledger_entries
                        ADD CONSTRAINT ledger_entries_amount_non_negative_chk
                        CHECK (amount >= 0);
                END IF;
            END $$;
        `);

        await knex.raw('CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_account_journal ON ledger_entries(tenant_id, account_id, journal_id);');
    }

    // 7) sequences should cascade with tenant deletion.
    if (hasSequences && hasTenants) {
        const hasSequencesTenant = await knex.schema.hasColumn('sequences', 'tenant_id');
        if (hasSequencesTenant) {
            await knex.raw(`
                DO $$
                DECLARE rec RECORD;
                BEGIN
                    FOR rec IN
                        SELECT c.conname
                        FROM pg_constraint c
                        JOIN pg_attribute a
                          ON a.attrelid = c.conrelid
                         AND a.attnum = ANY (c.conkey)
                        WHERE c.conrelid = 'sequences'::regclass
                          AND c.confrelid = 'tenants'::regclass
                          AND c.contype = 'f'
                        GROUP BY c.conname, c.conkey
                        HAVING bool_or(a.attname = 'tenant_id')
                    LOOP
                        EXECUTE format('ALTER TABLE sequences DROP CONSTRAINT IF EXISTS %I', rec.conname);
                    END LOOP;
                END $$;
            `);

            await knex.raw(`
                ALTER TABLE sequences
                ADD CONSTRAINT sequences_tenant_id_foreign
                FOREIGN KEY (tenant_id)
                REFERENCES tenants(id)
                ON DELETE CASCADE;
            `);
        }
    }

    // 8) Backfill customer/supplier opening balance journals when missing.
    const hasCustomers = await knex.schema.hasTable('customers');
    const hasSuppliers = await knex.schema.hasTable('suppliers');

    if (hasJournals && hasLedgerEntries && hasAccounts && hasCustomers && hasSuppliers) {
        const tenantIds = await getTenantIds(knex);

        for (const tenantId of tenantIds) {
            const touchedAccounts = new Set();

            await backfillOpeningJournalsForPartyTable({
                knex,
                tenantId,
                tableName: 'customers',
                partyType: 'customer',
                touchedAccounts,
            });

            await backfillOpeningJournalsForPartyTable({
                knex,
                tenantId,
                tableName: 'suppliers',
                partyType: 'supplier',
                touchedAccounts,
            });

            for (const accountId of touchedAccounts) {
                await recomputeAccountBalance(knex, tenantId, accountId);
            }
        }
    }
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_ledger_entries_tenant_account_journal;');
    await knex.raw('DROP INDEX IF EXISTS idx_journals_tenant_accounting_date;');

    await knex.raw('ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_is_balanced_consistency_chk;');
    await knex.raw('ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_amount_non_negative_chk;');

    await knex.raw('DROP TRIGGER IF EXISTS trg_enforce_account_group_type_tenant_match ON accounts;');
    await knex.raw('DROP FUNCTION IF EXISTS enforce_account_group_type_tenant_match();');

    await knex.raw('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_group_id_tenant_foreign;');

    await knex.raw('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS uq_accounts_tenant_code;');
    await knex.raw('ALTER TABLE account_groups DROP CONSTRAINT IF EXISTS uq_account_groups_tenant_type_name;');
    await knex.raw('ALTER TABLE account_groups DROP CONSTRAINT IF EXISTS uq_account_groups_id_tenant;');

    const hasTenants = await knex.schema.hasTable('tenants');
    const hasSequences = await knex.schema.hasTable('sequences');
    if (hasTenants && hasSequences) {
        const hasSequencesTenant = await knex.schema.hasColumn('sequences', 'tenant_id');
        if (hasSequencesTenant) {
            await knex.raw('ALTER TABLE sequences DROP CONSTRAINT IF EXISTS sequences_tenant_id_foreign;');
            await knex.raw('ALTER TABLE sequences ADD CONSTRAINT sequences_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES tenants(id);');
        }
    }
};
