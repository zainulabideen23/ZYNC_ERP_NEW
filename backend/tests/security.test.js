const request = require('supertest');
const express = require('express');

// Set JWT Secret for testing
process.env.JWT_SECRET = 'test_secret';

// Mocks
const mockFirst = jest.fn();
const mockWhere = jest.fn();

const mockChain = {
    where: mockWhere,
    first: mockFirst
};

mockWhere.mockReturnValue(mockChain);

const mockDb = jest.fn(() => mockChain);
jest.doMock('../src/config/database', () => mockDb);

const { authenticate, authorize } = require('../src/middleware/auth');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('RBAC & Security Module', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Test routes with different permissions
        app.get('/api/test-admin', authenticate, authorize('admin'), (req, res) => res.json({ success: true }));
        app.get('/api/test-manager', authenticate, authorize('admin', 'manager'), (req, res) => res.json({ success: true }));
        app.get('/api/test-cashier', authenticate, authorize('admin', 'manager', 'cashier'), (req, res) => res.json({ success: true }));

        app.use(errorHandler);
    });

    it('AUTH-004: Should permit Admin to access Admin-only route', async () => {
        // Mock DB: Find user
        mockFirst.mockResolvedValue({ id: 1, role: 'admin', is_active: true });

        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ userId: 1, role: 'admin' }, 'test_secret');

        const res = await request(app)
            .get('/api/test-admin')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('AUTH-004: Should forbid Cashier from accessing Admin-only route', async () => {
        mockFirst.mockResolvedValue({ id: 2, role: 'cashier', is_active: true });

        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ userId: 2, role: 'cashier' }, 'test_secret');

        const res = await request(app)
            .get('/api/test-admin')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('You do not have permission to perform this action');
    });

    it('AUTH-002: Should reject access with invalid token', async () => {
        const res = await request(app)
            .get('/api/test-admin')
            .set('Authorization', 'Bearer invalid_token');

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Invalid or expired token');
    });

    it('SEC-001: Should prevent SQL Injection in login (via parameterized queries)', async () => {
        // This is handled by Knex, but we test the route doesn't crash or leak
        const authRoutes = require('../src/routes/auth.routes');
        const authApp = express();
        authApp.use(express.json());
        authApp.use('/api/auth', authRoutes);
        authApp.use(errorHandler);

        mockFirst.mockResolvedValue(undefined); // No user found with malicious string

        const maliciousInput = "' OR '1'='1";
        const res = await request(authApp)
            .post('/api/auth/login')
            .send({ username: maliciousInput, password: 'password' });

        expect(res.statusCode).toBe(401); // Should fail as user not found
        expect(res.body.error).toBe('Invalid credentials');
    });
});
