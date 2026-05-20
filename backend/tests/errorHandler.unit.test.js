jest.mock('../src/utils/logger', () => ({
    error: jest.fn(),
}));

const logger = require('../src/utils/logger');
const { AppError, errorHandler } = require('../src/middleware/errorHandler');

const createRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('error handler middleware', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        jest.clearAllMocks();
    });

    it('AppError marks operational status and keeps status code', () => {
        const err = new AppError('bad request', 400);
        expect(err.message).toBe('bad request');
        expect(err.statusCode).toBe(400);
        expect(err.isOperational).toBe(true);
    });

    it('maps postgres unique violation to 409', () => {
        process.env.NODE_ENV = 'test';
        const req = { originalUrl: '/x', method: 'POST', body: { name: 'A' } };
        const res = createRes();

        errorHandler({ code: '23505', message: 'duplicate key' }, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'A record with this value already exists',
        });
    });

    it('maps jwt expiration error to 401', () => {
        process.env.NODE_ENV = 'test';
        const req = { originalUrl: '/x', method: 'GET', body: {} };
        const res = createRes();

        errorHandler({ name: 'TokenExpiredError', message: 'expired token' }, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Token expired',
        });
    });

    it('hides non-operational internal messages in production', () => {
        process.env.NODE_ENV = 'production';
        const req = { originalUrl: '/x', method: 'GET', body: {} };
        const res = createRes();

        errorHandler(new Error('Sensitive failure details'), req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Something went wrong',
        });
        expect(logger.error).toHaveBeenCalled();
    });
});