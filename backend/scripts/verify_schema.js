const knex = require('knex');
const config = require('../knexfile');

const db = knex(config.development);

const requiredSchema = {
    suppliers: ['credit_limit', 'current_credit_used'],
    purchases: ['duplicate_fingerprint', 'cancelled_at', 'cancelled_by', 'return_reason'],
    purchase_templates: [
        'tenant_id',
        'name',
        'supplier_id',
        'items',
        'is_active',
        'is_deleted',
    ],
    stock_movements: ['tenant_id', 'movement_type', 'reference_type', 'created_at'],
};

const requiredIndexes = [
    'idx_suppliers_tenant_credit_limit',
    'idx_suppliers_tenant_credit_used',
    'idx_purchases_tenant_purchase_date',
    'idx_purchases_tenant_supplier_date',
    'idx_purchases_tenant_supplier_due_aging',
    'idx_purchase_items_tenant_product_date',
    'idx_stock_movements_tenant_product_date',
    'idx_purchases_tenant_duplicate_fingerprint',
    'idx_purchases_tenant_cancelled_at',
    'idx_purchase_templates_tenant_active',
    'idx_purchase_templates_tenant_supplier',
    'uq_purchase_templates_tenant_name_active',
];

const requiredPolicies = [
    'tenant_isolation_stock_movements',
    'app_bypass_stock_movements',
];

const requiredTriggers = [
    'no_ledger_updates',
    'trigger_ledger_immutability',
];

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function printCheck(ok, message) {
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} ${message}`);
}

async function tableExists(tableName) {
    return db.schema.hasTable(tableName);
}

async function columnExists(tableName, columnName) {
    return db.schema.hasColumn(tableName, columnName);
}

async function verifySchemaPresence() {
    console.log('\n📦 Schema presence checks');
    let failed = 0;

    for (const [tableName, columns] of Object.entries(requiredSchema)) {
        const hasTable = await tableExists(tableName);
        printCheck(hasTable, `Table exists: ${tableName}`);
        if (!hasTable) {
            failed += 1;
            continue;
        }

        for (const columnName of columns) {
            const hasColumn = await columnExists(tableName, columnName);
            printCheck(hasColumn, `Column exists: ${tableName}.${columnName}`);
            if (!hasColumn) failed += 1;
        }
    }

    return failed;
}

async function verifyIndexes() {
    console.log('\n🧭 Index checks');
    const indexRows = await db('pg_indexes')
        .where('schemaname', 'public')
        .whereIn('indexname', requiredIndexes)
        .select('indexname');

    const present = new Set(indexRows.map((row) => row.indexname));
    let failed = 0;

    for (const name of requiredIndexes) {
        const ok = present.has(name);
        printCheck(ok, `Index exists: ${name}`);
        if (!ok) failed += 1;
    }

    return failed;
}

async function verifyStockMovementPolicies() {
    console.log('\n🔐 RLS policy checks (stock_movements)');
    let failed = 0;

    const policyRows = await db('pg_policies')
        .where('schemaname', 'public')
        .andWhere('tablename', 'stock_movements')
        .select('policyname');

    const presentPolicies = new Set(policyRows.map((row) => row.policyname));
    for (const policy of requiredPolicies) {
        const ok = presentPolicies.has(policy);
        printCheck(ok, `Policy exists: ${policy}`);
        if (!ok) failed += 1;
    }

    const rlsState = await db('pg_class as c')
        .join('pg_namespace as n', 'n.oid', 'c.relnamespace')
        .where('n.nspname', 'public')
        .andWhere('c.relname', 'stock_movements')
        .select('c.relrowsecurity', 'c.relforcerowsecurity')
        .first();

    const rlsEnabled = Boolean(rlsState?.relrowsecurity);
    const rlsForced = Boolean(rlsState?.relforcerowsecurity);

    printCheck(rlsEnabled, 'RLS enabled on stock_movements');
    if (!rlsEnabled) failed += 1;

    printCheck(rlsForced, 'RLS forced on stock_movements');
    if (!rlsForced) failed += 1;

    return failed;
}

async function verifyLedgerGuards() {
    console.log('\n🧾 Ledger guard checks');
    let failed = 0;

    const triggerRows = await db('pg_trigger as t')
        .join('pg_class as c', 'c.oid', 't.tgrelid')
        .where('c.relname', 'ledger_entries')
        .whereIn('t.tgname', requiredTriggers)
        .select('t.tgname');

    const presentTriggers = new Set(triggerRows.map((row) => row.tgname));
    for (const triggerName of requiredTriggers) {
        const ok = presentTriggers.has(triggerName);
        printCheck(ok, `Trigger exists: ${triggerName}`);
        if (!ok) failed += 1;
    }

    const journalTotals = await db('ledger_entries')
        .select('entry_type')
        .sum({ total: 'amount' })
        .groupBy('entry_type');

    const debitTotal = Number(journalTotals.find((row) => row.entry_type === 'debit')?.total || 0);
    const creditTotal = Number(journalTotals.find((row) => row.entry_type === 'credit')?.total || 0);
    const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01;

    printCheck(
        isBalanced,
        `Ledger totals balanced (debit=${round2(debitTotal)}, credit=${round2(creditTotal)})`
    );
    if (!isBalanced) failed += 1;

    const unbalancedJournal = await db('journals as j')
        .leftJoin('ledger_entries as le', 'le.journal_id', 'j.id')
        .where('j.tenant_id', db.raw('le.tenant_id'))
        .groupBy('j.id')
        .havingRaw(
            "ABS(COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0)) > 0.01"
        )
        .first('j.id');

    const hasNoUnbalancedJournal = !unbalancedJournal;
    printCheck(hasNoUnbalancedJournal, 'No unbalanced journals detected');
    if (!hasNoUnbalancedJournal) failed += 1;

    return failed;
}

async function verifyMigrationApplied() {
    console.log('\n🛠️ Migration checks');
    let failed = 0;

    const requiredMigrations = [
        '20260415130000_purchase_engine_foundations_v1.js',
        '20260415170000_purchase_enhancements_v1.js',
    ];

    const rows = await db('knex_migrations')
        .whereIn('name', requiredMigrations)
        .select('name');

    const applied = new Set(rows.map((row) => row.name));

    for (const migrationName of requiredMigrations) {
        const ok = applied.has(migrationName);
        printCheck(ok, `Migration applied: ${migrationName}`);
        if (!ok) failed += 1;
    }

    return failed;
}

async function verifyTenantCoverage() {
    console.log('\n🏢 Tenant coverage checks');
    const tablesWithoutTenantId = ['platform_admins', 'tenants'];

    const result = await db.raw(`
        SELECT table_name
        FROM information_schema.tables t
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE 'knex_%'
          AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = t.table_name
              AND c.column_name = 'tenant_id'
          )
        ORDER BY table_name;
    `);

    const rows = result.rows || [];
    const found = rows.map((row) => row.table_name);
    const unexpected = found.filter((name) => !tablesWithoutTenantId.includes(name));

    printCheck(
        unexpected.length === 0,
        `Only expected tenant-less tables found: ${found.join(', ') || 'none'}`
    );

    return unexpected.length;
}

async function verify() {
    console.log('🚀 Starting read-only schema verification...');

    let failures = 0;

    try {
        failures += await verifySchemaPresence();
        failures += await verifyIndexes();
        failures += await verifyStockMovementPolicies();
        failures += await verifyLedgerGuards();
        failures += await verifyMigrationApplied();
        failures += await verifyTenantCoverage();

        console.log('\n📌 Verification summary');
        if (failures === 0) {
            console.log('✅ PASS: all schema integrity checks passed.');
            process.exitCode = 0;
        } else {
            console.log(`❌ FAIL: ${failures} check(s) failed.`);
            process.exitCode = 1;
        }
    } catch (error) {
        console.error('❌ Verification failed with runtime error:', error.message);
        console.error(error.stack);
        process.exitCode = 1;
    } finally {
        await db.destroy();
    }
}

verify();
