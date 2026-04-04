require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
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
const unitRoutes = require('./routes/unit.routes');
const tenantRoutes = require('./routes/tenants.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const auditlogRoutes = require('./routes/auditlog.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const settingsRoutes = require('./routes/settings.routes');
const paymentsRoutes = require('./routes/payments.routes');
const transfersRoutes = require('./routes/transfers.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await db.raw('SELECT 1');
        logger.info('✓ Database connected successfully');

        app.listen(PORT, () => {
            logger.info(`✓ ZYNC ERP API running on port ${PORT}`);
            logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
