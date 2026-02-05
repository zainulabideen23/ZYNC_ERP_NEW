const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

// Login
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            throw new AppError('Username and password are required', 400);
        }

        const user = await db('users')
            .where({ username, is_active: true })
            .first();

        if (!user) {
            throw new AppError('Invalid credentials', 401);
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new AppError('Invalid credentials', 401);
        }

        // Update last login
        await db('users')
            .where({ id: user.id })
            .update({ last_login: new Date() });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.full_name,
                    role: user.role,
                    email: user.email
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = await db('users')
            .where({ id: req.user.id })
            .select('id', 'username', 'full_name', 'email', 'phone_number', 'role', 'last_login')
            .first();

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
});

// Change password
router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw new AppError('Current and new password are required', 400);
        }

        if (newPassword.length < 6) {
            throw new AppError('Password must be at least 6 characters', 400);
        }

        const user = await db('users').where({ id: req.user.id }).first();
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            throw new AppError('Current password is incorrect', 401);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db('users')
            .where({ id: req.user.id })
            .update({ password_hash: hashedPassword, updated_at: new Date() });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
