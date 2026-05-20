require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { resolveTenant } = require('./middleware/tenant');
const { authenticate } = require('./middleware/auth');
const logger = require('./utils/logger');
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const customerRoutes = require('./routes/customer.routes');
const supplierRoutes = require('./routes/supplier.routes');
const categoryRoutes = require('./routes/category.routes');
const brandRoutes = require('./routes/brand.routes');
const saleRoutes = require('./routes/sale.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const accountRoutes = require('./routes/account.routes');
const reportRoutes = require('./routes/report.routes');
const expenseRoutes = require('./routes/expense.routes');
const journalRoutes = require('./routes/journal.routes');
const userRoutes = require('./routes/user.routes');
const backupRoutes = require('./routes/backup.routes');
const stockRoutes = require('./routes/stock.routes');
const quotationRoutes = require('./routes/quotation.routes');
const quotePublicRoutes = require('./routes/quotePublic.routes');
const unitRoutes = require('./routes/unit.routes');
const tenantRoutes = require('./routes/tenants.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const auditlogRoutes = require('./routes/auditlog.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const settingsRoutes = require('./routes/settings.routes');
const paymentsRoutes = require('./routes/payments.routes');
const transfersRoutes = require('./routes/transfers.routes');
const loanRoutes = require('./routes/loan.routes');
const equityRoutes = require('./routes/equity.routes');

const app = express();
const PORT = process.env.PORT || 3001;

const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';
const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || '1mb';
const API_RATE_LIMIT_MAX = Number.parseInt(process.env.API_RATE_LIMIT_MAX || '300', 10);
const API_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);

const parseAllowedOrigins = () => {
    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (configured.length > 0) return configured;
    if (process.env.NODE_ENV === 'production') return [];
    return DEFAULT_DEV_ORIGINS;
};

const allowedOrigins = parseAllowedOrigins();

const validateProductionSecurityConfig = () => {
    if (process.env.NODE_ENV !== 'production') return;

    const requiredSecrets = ['JWT_SECRET', 'PLATFORM_ADMIN_SECRET', 'PLATFORM_JWT_SECRET'];
    const missing = requiredSecrets.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing required production secrets: ${missing.join(', ')}`);
    }

    const insecurePatterns = [/change-this/i, /your-super-secret/i, /zync-platform-secret-2025/i];
    for (const name of requiredSecrets) {
        const value = process.env[name] || '';
        if (insecurePatterns.some((pattern) => pattern.test(value))) {
            throw new Error(`Insecure production secret value detected for ${name}`);
        }
    }

    if (allowedOrigins.length === 0) {
        throw new Error('ALLOWED_ORIGINS must be configured in production');
    }
};

const apiLimiter = rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    }
});

// Middleware
app.use(helmet());
if (process.env.TRUST_PROXY !== undefined) {
    const trustProxy = Number.parseInt(process.env.TRUST_PROXY, 10);
    if (!Number.isNaN(trustProxy)) {
        app.set('trust proxy', trustProxy);
    }
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS origin not allowed'));
    },
    credentials: true
}));
app.use(compression());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: URLENCODED_BODY_LIMIT }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await db.raw('SELECT 1');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});

// API Routes
app.use('/api', apiLimiter);
app.use('/api/public', quotePublicRoutes);
app.use('/api/auth', authRoutes);
app.use('/platform', tenantRoutes);

// All tenant-scoped routes use authenticate → resolveTenant middleware chain
app.use('/api/products', authenticate, resolveTenant, productRoutes);
app.use('/api/customers', authenticate, resolveTenant, customerRoutes);
app.use('/api/suppliers', authenticate, resolveTenant, supplierRoutes);
app.use('/api/categories', authenticate, resolveTenant, categoryRoutes);
app.use('/api/brands', authenticate, resolveTenant, brandRoutes);
app.use('/api/companies', authenticate, resolveTenant, brandRoutes); // backward compat alias
app.use('/api/sales', authenticate, resolveTenant, saleRoutes);
app.use('/api/purchases', authenticate, resolveTenant, purchaseRoutes);
app.use('/api/accounts', authenticate, resolveTenant, accountRoutes);
app.use('/api/reports', authenticate, resolveTenant, reportRoutes);
app.use('/api/expenses', authenticate, resolveTenant, expenseRoutes);
app.use('/api/journals', authenticate, resolveTenant, journalRoutes);
app.use('/api/users', authenticate, resolveTenant, userRoutes);
app.use('/api/backups', authenticate, resolveTenant, backupRoutes);
app.use('/api/stock', authenticate, resolveTenant, stockRoutes);
app.use('/api/quotations', authenticate, resolveTenant, quotationRoutes);
app.use('/api/units', authenticate, resolveTenant, unitRoutes);
app.use('/api/dashboard', authenticate, resolveTenant, dashboardRoutes);
app.use('/api/audit-logs', authenticate, resolveTenant, auditlogRoutes);
app.use('/api/onboarding', authenticate, resolveTenant, onboardingRoutes);
app.use('/api/settings', authenticate, resolveTenant, settingsRoutes);
app.use('/api/payments', authenticate, resolveTenant, paymentsRoutes);
app.use('/api/transfers', authenticate, resolveTenant, transfersRoutes);
app.use('/api/loans', authenticate, resolveTenant, loanRoutes);
app.use('/api/equity', authenticate, resolveTenant, equityRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
let server;
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);

    if (typeof forceExitTimer.unref === 'function') {
        forceExitTimer.unref();
    }

    try {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
            logger.info('HTTP server closed');
        }

        await db.destroy();
        logger.info('Database connections closed');

        clearTimeout(forceExitTimer);
        process.exit(0);
    } catch (error) {
        logger.error('Graceful shutdown failed:', error);
        clearTimeout(forceExitTimer);
        process.exit(1);
    }
};

const startServer = async () => {
    try {
        validateProductionSecurityConfig();

        // Test database connection
        await db.raw('SELECT 1');
        logger.info('✓ Database connected successfully');

        server = app.listen(PORT, () => {
            logger.info(`✓ ZYNC ERP API running on port ${PORT}`);
            logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Only start server when run directly (not when imported by Vercel)
if (require.main === module) {
    startServer();

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
