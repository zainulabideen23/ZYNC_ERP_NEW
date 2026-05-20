const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense']);
const DEFAULT_LEDGER_LIMIT = 200;
const MAX_LEDGER_LIMIT = 500;

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const normalizePagination = ({ page, limit }) => {
    const requestedPage = parsePositiveInt(page, 1);
    const requestedLimit = parsePositiveInt(limit, DEFAULT_LEDGER_LIMIT);

    return {
        requestedPage,
        limit: Math.min(requestedLimit, MAX_LEDGER_LIMIT),
    };
};

const humanizeReferenceType = (type) => String(type || '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const shortReferenceId = (id) => {
    const raw = String(id || '').trim();
    if (!raw) return '';
    if (/^[0-9a-fA-F-]{36}$/.test(raw)) {
        return raw.split('-')[0];
    }
    return raw;
};

const fallbackReferenceLabel = (referenceType, referenceId, journalNumber) => {
    const typeLabel = humanizeReferenceType(referenceType) || 'Reference';
    const shortId = shortReferenceId(referenceId);

    if (shortId) {
        return `${typeLabel} #${shortId}`;
    }

    if (journalNumber) {
        return `Journal ${journalNumber}`;
    }

    return typeLabel;
};

function applyLedgerDelta(balance, accountType, entryType, amount) {
    const normalizedBalance = Number(balance || 0);
    const normalizedAmount = Number(amount || 0);

    if (DEBIT_NORMAL_TYPES.has(accountType)) {
        return entryType === 'debit'
            ? normalizedBalance + normalizedAmount
            : normalizedBalance - normalizedAmount;
    }

    return entryType === 'credit'
        ? normalizedBalance + normalizedAmount
        : normalizedBalance - normalizedAmount;
}

function applyTotalsDelta(balance, accountType, debitTotal, creditTotal) {
    const debit = Number(debitTotal || 0);
    const credit = Number(creditTotal || 0);

    if (DEBIT_NORMAL_TYPES.has(accountType)) {
        return round2(Number(balance || 0) + debit - credit);
    }

    return round2(Number(balance || 0) + credit - debit);
}

function withLedgerOrdering(query) {
    return query
        .orderBy('j.journal_date', 'asc')
        .orderBy('j.created_at', 'asc')
        .orderBy('j.id', 'asc')
        .orderBy('le.created_at', 'asc')
        .orderBy('le.id', 'asc');
}

function applyLedgerPositionBefore(query, pivotRow) {
    return query.where((outer) => {
        outer.where('j.journal_date', '<', pivotRow.entry_date)
            .orWhere((q1) => {
                q1.where('j.journal_date', '=', pivotRow.entry_date)
                    .andWhere('j.created_at', '<', pivotRow.journal_created_at);
            })
            .orWhere((q2) => {
                q2.where('j.journal_date', '=', pivotRow.entry_date)
                    .andWhere('j.created_at', '=', pivotRow.journal_created_at)
                    .andWhere('j.id', '<', pivotRow.journal_id);
            })
            .orWhere((q3) => {
                q3.where('j.journal_date', '=', pivotRow.entry_date)
                    .andWhere('j.created_at', '=', pivotRow.journal_created_at)
                    .andWhere('j.id', '=', pivotRow.journal_id)
                    .andWhere('le.created_at', '<', pivotRow.entry_created_at);
            })
            .orWhere((q4) => {
                q4.where('j.journal_date', '=', pivotRow.entry_date)
                    .andWhere('j.created_at', '=', pivotRow.journal_created_at)
                    .andWhere('j.id', '=', pivotRow.journal_id)
                    .andWhere('le.created_at', '=', pivotRow.entry_created_at)
                    .andWhere('le.id', '<', pivotRow.id);
            });
    });
}

function applyLedgerFilters(query, { tenantId, accountId, fromDate, toDate }) {
    query
        .where('le.account_id', accountId)
        .where('le.tenant_id', tenantId)
        .where('j.tenant_id', tenantId);

    // Period opening is computed strictly before fromDate, so ledger rows begin at fromDate.
    if (fromDate) query.where('j.journal_date', '>=', fromDate);
    if (toDate) query.where('j.journal_date', '<=', toDate);

    return query;
}

async function computeAccountOpeningBalanceForDate({ trx, tenantId, accountId, accountType, openingBalance, fromDate }) {
    const baseOpening = Number(openingBalance || 0);
    if (!fromDate) {
        return baseOpening;
    }

    const totals = await trx('ledger_entries as le')
        .join('journals as j', 'le.journal_id', 'j.id')
        .where('le.account_id', accountId)
        .where('le.tenant_id', tenantId)
        .where('j.tenant_id', tenantId)
        .where('j.journal_date', '<=', fromDate)
        .first(
            trx.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS debit_total"),
            trx.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS credit_total")
        );

    return applyTotalsDelta(baseOpening, accountType, totals?.debit_total, totals?.credit_total);
}

async function resolveReferenceLabels({ db, tenantId, entries }) {
    const idsByType = {
        sale: new Set(),
        sale_return: new Set(),
        purchase: new Set(),
        purchase_return: new Set(),
        payment: new Set(),
        expense: new Set(),
        opening: new Set(),
        return: new Set(),
        adjustment: new Set(),
        journal: new Set(),
    };

    for (const entry of entries) {
        const type = String(entry.reference_type || '').toLowerCase();
        const id = entry.reference_id;
        if (!id || !idsByType[type]) continue;
        idsByType[type].add(id);
    }

    const referenceLabels = new Map();
    const mapKey = (type, id) => `${type}:${id}`;

    const salesIds = [...idsByType.sale];
    const saleReturnIds = [...idsByType.sale_return];
    const purchaseIds = [...idsByType.purchase];
    const purchaseReturnIds = [...idsByType.purchase_return];
    const paymentIds = [...idsByType.payment];
    const expenseIds = [...idsByType.expense];
    const openingIds = [...idsByType.opening];
    const adjustmentIds = [...idsByType.adjustment];
    const journalIds = [...idsByType.journal];

    const lookups = [];

    if (salesIds.length > 0) {
        lookups.push(
            db('sales')
                .where('tenant_id', tenantId)
                .whereIn('id', salesIds)
                .select('id', 'invoice_number')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.invoice_number
                            ? `Sale ${row.invoice_number}`
                            : `Sale #${shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('sale', row.id), label);
                    }
                })
        );
    }

    if (saleReturnIds.length > 0) {
        lookups.push(
            db('sales')
                .where('tenant_id', tenantId)
                .whereIn('id', saleReturnIds)
                .where('is_return', true)
                .select('id', 'invoice_number')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.invoice_number
                            ? `Sale Return ${row.invoice_number}`
                            : `Sale Return #${shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('sale_return', row.id), label);
                    }
                })
        );
    }

    if (purchaseIds.length > 0) {
        lookups.push(
            db('purchases')
                .where('tenant_id', tenantId)
                .whereIn('id', purchaseIds)
                .select('id', 'bill_number')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.bill_number
                            ? `Purchase ${row.bill_number}`
                            : `Purchase #${shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('purchase', row.id), label);
                    }
                })
        );
    }

    if (purchaseReturnIds.length > 0) {
        lookups.push(
            db('purchases')
                .where('tenant_id', tenantId)
                .whereIn('id', purchaseReturnIds)
                .where('is_return', true)
                .select('id', 'bill_number')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.bill_number
                            ? `Purchase Return ${row.bill_number}`
                            : `Purchase Return #${shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('purchase_return', row.id), label);
                    }
                })
        );
    }

    if (paymentIds.length > 0) {
        lookups.push(
            db('payments')
                .where('tenant_id', tenantId)
                .whereIn('id', paymentIds)
                .select('id')
                .then((rows) => {
                    for (const row of rows) {
                        referenceLabels.set(mapKey('payment', row.id), `Payment #${shortReferenceId(row.id)}`);
                    }
                })
        );
    }

    if (expenseIds.length > 0) {
        lookups.push(
            db('expenses')
                .where('tenant_id', tenantId)
                .whereIn('id', expenseIds)
                .select('id', 'expense_number')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.expense_number
                            ? `Expense ${row.expense_number}`
                            : `Expense #${shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('expense', row.id), label);
                    }
                })
        );
    }

    if (openingIds.length > 0) {
        lookups.push(
            db('customers')
                .where('tenant_id', tenantId)
                .whereIn('id', openingIds)
                .select('id', 'code', 'name')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.code
                            ? `Opening ${row.code}`
                            : `Opening ${row.name || shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('opening', row.id), label);
                    }
                })
        );

        lookups.push(
            db('suppliers')
                .where('tenant_id', tenantId)
                .whereIn('id', openingIds)
                .select('id', 'code', 'name')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.code
                            ? `Opening ${row.code}`
                            : `Opening ${row.name || shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('opening', row.id), label);
                    }
                })
        );

        lookups.push(
            db('accounts')
                .where('tenant_id', tenantId)
                .whereIn('id', openingIds)
                .select('id', 'code', 'name')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.code
                            ? `Opening ${row.code}`
                            : `Opening ${row.name || shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('opening', row.id), label);
                    }
                })
        );
    }

    if (adjustmentIds.length > 0) {
        lookups.push(
            db('stock_adjustments')
                .where('tenant_id', tenantId)
                .whereIn('id', adjustmentIds)
                .select('id', 'adjustment_type')
                .then((rows) => {
                    for (const row of rows) {
                        const type = String(row.adjustment_type || 'adjustment').replace(/_/g, ' ');
                        const label = `Stock ${type}`;
                        referenceLabels.set(mapKey('adjustment', row.id), label);
                    }
                })
        );
    }

    if (journalIds.length > 0) {
        lookups.push(
            db('journals')
                .where('tenant_id', tenantId)
                .whereIn('id', journalIds)
                .select('id', 'journal_number')
                .then((rows) => {
                    for (const row of rows) {
                        const label = row.journal_number
                            ? `Journal ${row.journal_number}`
                            : `Journal #${shortReferenceId(row.id)}`;
                        referenceLabels.set(mapKey('journal', row.id), label);
                    }
                })
        );
    }

    await Promise.all(lookups);

    return entries.map((entry) => {
        const type = String(entry.reference_type || '').toLowerCase();
        const key = entry.reference_id ? mapKey(type, entry.reference_id) : null;
        const referenceLabel = key && referenceLabels.has(key)
            ? referenceLabels.get(key)
            : fallbackReferenceLabel(entry.reference_type, entry.reference_id, entry.journal_number);

        return {
            ...entry,
            reference_label: referenceLabel,
        };
    });
}

async function getLedgerEntriesWithRunningBalance({
    db,
    tenantId,
    accountId,
    accountType,
    fromDate,
    toDate,
    openingBalance,
    page,
    limit,
}) {
    const { requestedPage, limit: safeLimit } = normalizePagination({ page, limit });

    const baseQuery = applyLedgerFilters(
        db('ledger_entries as le').join('journals as j', 'le.journal_id', 'j.id'),
        { tenantId, accountId, fromDate, toDate }
    );

    const [{ total: totalRaw = 0 }] = await baseQuery.clone().count('le.id as total');
    const total = Number.parseInt(totalRaw, 10) || 0;
    const pages = total === 0 ? 1 : Math.ceil(total / safeLimit);
    const currentPage = Math.min(requestedPage, pages);
    const offset = (currentPage - 1) * safeLimit;

    const filteredTotals = await baseQuery.clone().first(
        db.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS debit_total"),
        db.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS credit_total")
    );

    const rows = await withLedgerOrdering(
        baseQuery.clone()
        .select(
            'le.*',
            'j.journal_date as entry_date',
            'j.id as journal_id',
            'j.created_at as journal_created_at',
            'le.created_at as entry_created_at',
            'j.journal_number',
            'j.reference_type',
            'j.reference_id',
            'j.description as narration'
        )
    )
        .limit(safeLimit)
        .offset(offset);

    const rowsWithReferences = await resolveReferenceLabels({ db, tenantId, entries: rows });

    let pageOpeningBalance = openingBalance;
    if (rowsWithReferences.length > 0) {
        const firstRow = rowsWithReferences[0];
        const priorTotalsQuery = applyLedgerFilters(
            db('ledger_entries as le').join('journals as j', 'le.journal_id', 'j.id'),
            { tenantId, accountId, fromDate, toDate }
        );
        applyLedgerPositionBefore(priorTotalsQuery, firstRow);

        const priorTotals = await priorTotalsQuery.first(
            db.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS debit_total"),
            db.raw("COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS credit_total")
        );

        pageOpeningBalance = applyTotalsDelta(
            openingBalance,
            accountType,
            priorTotals?.debit_total,
            priorTotals?.credit_total
        );
    }

    let runningBalance = pageOpeningBalance;
    const entries = rowsWithReferences.map((entry) => {
        runningBalance = round2(applyLedgerDelta(runningBalance, accountType, entry.entry_type, entry.amount));

        return {
            ...entry,
            running_balance: runningBalance,
        };
    });

    const closingBalance = applyTotalsDelta(openingBalance, accountType, filteredTotals?.debit_total, filteredTotals?.credit_total);

    return {
        entries,
        pageOpeningBalance,
        closingBalance,
        pagination: {
            total,
            page: currentPage,
            limit: safeLimit,
            pages,
            has_previous: currentPage > 1,
            has_next: currentPage < pages,
        },
    };
}

module.exports = {
    applyLedgerDelta,
    computeAccountOpeningBalanceForDate,
    getLedgerEntriesWithRunningBalance,
};
