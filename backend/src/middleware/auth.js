const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Authentication required', 401);
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is active
        const user = await db('users')
            .where({ id: decoded.userId, is_active: true })
            .first();

        if (!user) {
            throw new AppError('User no longer exists or is inactive', 401);
        }

        req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.full_name
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            next(new AppError('Invalid or expired token', 401));
        } else {
            next(error);
        }
    }
};

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        next();
    };
};

module.exports = { authenticate, authorize };
