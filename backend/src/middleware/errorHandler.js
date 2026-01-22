const logger = require('../utils/logger');

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Log the error
    logger.error(`${statusCode} - ${message}`, {
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        stack: err.stack
    });

    // PostgreSQL specific errors
    if (err.code === '23505') {
        statusCode = 409;
        message = 'A record with this value already exists';
    } else if (err.code === '23503') {
        statusCode = 400;
        message = 'Referenced record does not exist';
    } else if (err.code === '23502') {
        statusCode = 400;
        message = 'Required field is missing';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
        message = 'Something went wrong';
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = { AppError, errorHandler };
