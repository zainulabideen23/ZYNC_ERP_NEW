const request = require('supertest');
const express = require('express');

// Mocks
const mockReportServiceInstance = {
    getTrialBalance: jest.fn(),
    getProfitAndLoss: jest.fn(),
    getBalanceSheet: jest.fn()
};

const mockReportServiceClass = jest.fn(() => mockReportServiceInstance);

jest.doMock('../src/services/report.service', () => mockReportServiceClass);

// Auth Mock
jest.doMock('../src/middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
    },
    authorize: (...roles) => (req, res, next) => next()
}));

// DB Mock for Routes
const mockDb = jest.fn();
jest.doMock('../src/config/database', () => mockDb);

const reportRoutes = require('../src/routes/report.routes');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Financial Reporting Module', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/reports', reportRoutes);
        app.use(errorHandler);
    });

    it('AC-001 / RP-003: Should generate balanced Trial Balance', async () => {
        const mockTB = {
            accounts: [
                { code: '1001', name: 'Cash', debits: 1000, credits: 0, net_balance: 1000 },
                { code: '4001', name: 'Sales', debits: 0, credits: 1000, net_balance: -1000 }
            ],
            totals: { debits: 1000, credits: 1000 },
            is_balanced: true
        };

        mockReportServiceInstance.getTrialBalance.mockResolvedValue(mockTB);

        const res = await request(app)
            .get('/api/reports/trial-balance');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_balanced).toBe(true);
        expect(res.body.data.totals.debits).toBe(1000);
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
        const mockBS = {
            total_assets: 10000,
            total_liabilities: 4000,
            total_equity: 6000,
            check: {
                diff: 0
            }
        };

        mockReportServiceInstance.getBalanceSheet.mockResolvedValue(mockBS);

        const res = await request(app)
            .get('/api/reports/balance-sheet');

        expect(res.statusCode).toBe(200);
        expect(res.body.data.check.diff).toBe(0);
        expect(res.body.data.total_assets).toBe(res.body.data.total_liabilities + res.body.data.total_equity);
    });
});
