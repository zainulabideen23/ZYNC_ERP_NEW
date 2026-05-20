const request = require('supertest');
const express = require('express');

const mockReportServiceInstance = {
    getProfitAndLoss: jest.fn()
};

const mockReportServiceClass = jest.fn(() => mockReportServiceInstance);

jest.doMock('../src/services/report.service', () => mockReportServiceClass);

jest.doMock('../src/middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
    },
    authorize: () => (_req, _res, next) => next()
}));

const makeLedgerSubquery = () => {
    const query = {
        join: jest.fn(() => query),
        where: jest.fn(() => query),
        modify: jest.fn((fn) => {
            if (fn) fn(query);
            return query;
        }),
        groupBy: jest.fn(() => query),
        select: jest.fn(() => query),
        as: jest.fn(() => query),
    };

    return query;
};

const makeAccountsQuery = (trialBalanceRows, balanceSheetRows) => {
    let isBalanceSheet = false;

    const query = {
        leftJoin: jest.fn(() => query),
        where: jest.fn(() => query),
        whereIn: jest.fn(() => {
            isBalanceSheet = true;
            return query;
        }),
        select: jest.fn(() => query),
        orderBy: jest.fn().mockImplementation(async () => {
            return isBalanceSheet ? balanceSheetRows : trialBalanceRows;
        })
    };

    return query;
};

const mockDb = jest.fn((tableName) => {
    if (tableName === 'company_info') {
        const query = {
            where: jest.fn(() => query),
            select: jest.fn(() => query),
            first: jest.fn().mockResolvedValue({ financial_year_start: 1 }),
        };

        return query;
    }

    if (tableName === 'ledger_entries as le') {
        return makeLedgerSubquery();
    }

    if (tableName === 'accounts as a') {
        const trialBalanceRows = [
            {
                id: 1,
                code: '1001',
                name: 'Cash',
                account_type: 'asset',
                opening_balance: '0',
                group_name: 'Assets',
                debit_total: '1000',
                credit_total: '0',
            },
            {
                id: 2,
                code: '4001',
                name: 'Sales',
                account_type: 'income',
                opening_balance: '0',
                group_name: 'Income',
                debit_total: '0',
                credit_total: '1000',
            }
        ];

        const balanceSheetRows = [
            {
                id: 1,
                code: '1001',
                name: 'Cash',
                account_type: 'asset',
                opening_balance: '0',
                group_name: 'Assets',
                debit_total: '1000',
                credit_total: '0',
            },
            {
                id: 2,
                code: '2001',
                name: 'Payable',
                account_type: 'liability',
                opening_balance: '0',
                group_name: 'Liabilities',
                debit_total: '0',
                credit_total: '400',
            },
            {
                id: 3,
                code: '3001',
                name: 'Capital',
                account_type: 'equity',
                opening_balance: '0',
                group_name: 'Equity',
                debit_total: '0',
                credit_total: '600',
            }
        ];

        return makeAccountsQuery(trialBalanceRows, balanceSheetRows);
    }

    return makeLedgerSubquery();
});
mockDb.raw = jest.fn((sql, bindings) => ({ sql, bindings }));

jest.doMock('../src/config/database', () => mockDb);

const reportRoutes = require('../src/routes/report.routes');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Financial Reporting Module', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();

        app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { id: 1, role: 'admin' };
            req.tenantId = 'tenant-1';
            next();
        });
        app.use('/api/reports', reportRoutes);
        app.use(errorHandler);
    });

    it('AC-001 / RP-003: Should generate balanced Trial Balance', async () => {
        const res = await request(app)
            .get('/api/reports/trial-balance');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_balanced).toBe(true);
        expect(res.body.data.totals.debits).toBe(1000);
        expect(res.body.data.totals.credits).toBe(1000);
    });

    it('RP-001: Should calculate Profit & Loss accurately', async () => {
        const mockPL = {
            income: [{ name: 'Sales', amount: 5000 }],
            expenses: [{ name: 'COGS', amount: 3000 }],
            total_income: 5000,
            total_expenses: 3000,
            net_profit: 2000
        };

        mockReportServiceInstance.getProfitAndLoss.mockResolvedValue(mockPL);

        const res = await request(app)
            .get('/api/reports/profit-loss');

        expect(res.statusCode).toBe(200);
        expect(res.body.data.net_profit).toBe(2000);
    });

    it('RP-002: Should ensure Balance Sheet integrity (A = L + E)', async () => {
        mockReportServiceInstance.getProfitAndLoss.mockResolvedValue({
            income: [],
            expenses: [],
            total_income: 0,
            total_expenses: 0,
            net_profit: 0
        });

        const res = await request(app)
            .get('/api/reports/balance-sheet');

        expect(res.statusCode).toBe(200);
        expect(res.body.data.total_assets).toBe(1000);
        expect(res.body.data.total_liabilities).toBe(400);
        expect(res.body.data.total_equity).toBe(600);
        expect(res.body.data.total_assets).toBe(res.body.data.total_liabilities + res.body.data.total_equity);
    });
});