const request = require('supertest');
const express = require('express');

describe('Authentication Module', () => {
    let app;
    let mockDb, mockWhere, mockFirst, mockUpdate, mockSelect;
    let bcrypt, jwt;

    beforeEach(() => {
        jest.resetModules(); // Reset cache to allow fresh mocks

        // Define mocks
        mockFirst = jest.fn();
        mockUpdate = jest.fn();
        mockSelect = jest.fn();
        mockWhere = jest.fn();

        const mockChain = {
            where: mockWhere,
            first: mockFirst,
            update: mockUpdate,
            select: mockSelect
        };

        // Chain setup
        mockWhere.mockReturnValue(mockChain);
        mockSelect.mockReturnValue(mockChain);

        mockDb = jest.fn(() => mockChain);

        // Setup manual mocks via doMock (not hoisted)
        jest.doMock('../src/config/database', () => mockDb);
        jest.doMock('bcrypt', () => ({
            compare: jest.fn(),
            hash: jest.fn()
        }));
        jest.doMock('jsonwebtoken', () => ({
            sign: jest.fn(),
            verify: jest.fn()
        }));

        // Re-require modules under test
        bcrypt = require('bcrypt');
        jwt = require('jsonwebtoken');
        const authRoutes = require('../src/routes/auth.routes');
        const { errorHandler } = require('../src/middleware/errorHandler');

        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use(errorHandler);
    });

    describe('POST /api/auth/login', () => {
        it('AUTH-001: Should login successfully with valid admin credentials', async () => {
            const mockUser = {
                id: 1,
                username: 'admin',
                password_hash: 'hashed_password',
                role: 'admin',
                full_name: 'Admin User',
                email: 'admin@example.com'
            };

            mockFirst.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('valid_token');
            mockUpdate.mockResolvedValue(1);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBe('valid_token');
        });

        it('AUTH-003: Should reject login with invalid password', async () => {
            const mockUser = {
                id: 1,
                username: 'admin',
                password_hash: 'hashed_password'
            };

            mockFirst.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'wrongpassword' });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Invalid credentials');
        });

        it('AUTH-003: Should reject login if user does not exist', async () => {
            mockFirst.mockResolvedValue(undefined);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'ghost', password: 'password' });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Invalid credentials');
        });

        it('Should reject login with missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin' });

            expect(res.statusCode).toBe(400);
        });
    });
});
