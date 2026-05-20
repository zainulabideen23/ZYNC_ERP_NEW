const nodemailer = require('nodemailer');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const isTrue = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value).toLowerCase() === 'true';
};

const cleanEnv = (value) => String(value || '').trim();

const isPlaceholderHost = (host) => {
    const normalized = cleanEnv(host).toLowerCase();
    return normalized === '' || normalized === 'smtp.example.com' || normalized === 'example.com';
};

class EmailService {
    constructor() {
        this.transporter = null;
    }

    getConfig() {
        return {
            host: cleanEnv(process.env.SMTP_HOST),
            port: cleanEnv(process.env.SMTP_PORT),
            user: cleanEnv(process.env.SMTP_USER),
            pass: cleanEnv(process.env.SMTP_PASS),
            fromEmail: cleanEnv(process.env.SMTP_FROM_EMAIL),
            fromName: cleanEnv(process.env.SMTP_FROM_NAME) || 'ZYNC ERP',
            secure: isTrue(process.env.SMTP_SECURE, false),
            requireTLS: isTrue(process.env.SMTP_REQUIRE_TLS, false),
            rejectUnauthorized: isTrue(process.env.SMTP_REJECT_UNAUTHORIZED, true),
        };
    }

    isConfigured() {
        const config = this.getConfig();
        return Boolean(
            config.host
            && config.port
            && config.user
            && config.pass
            && config.fromEmail
        );
    }

    getTransporter() {
        const config = this.getConfig();

        if (!this.isConfigured()) {
            throw new AppError('Email service is not configured. Please set SMTP_* environment variables.', 503);
        }

        if (isPlaceholderHost(config.host)) {
            throw new AppError('SMTP_HOST is still a placeholder. Set a real SMTP host (for Gmail use smtp.gmail.com).', 503);
        }

        if (this.transporter) return this.transporter;

        const port = Number.parseInt(config.port, 10);
        const secure = Number.isNaN(port) ? config.secure : (config.secure || port === 465);

        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: Number.isNaN(port) ? 587 : port,
            secure,
            requireTLS: config.requireTLS,
            auth: {
                user: config.user,
                pass: config.pass,
            },
            tls: {
                rejectUnauthorized: config.rejectUnauthorized,
            },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
        });

        return this.transporter;
    }

    getDefaultFrom() {
        const { fromName, fromEmail } = this.getConfig();
        return `"${fromName}" <${fromEmail}>`;
    }

    async sendQuotationEmail({ to, subject, html, text, attachments = [] }) {
        if (!to) throw new AppError('Recipient email is required', 400);

        try {
            const transporter = this.getTransporter();
            const info = await transporter.sendMail({
                from: this.getDefaultFrom(),
                to,
                subject,
                text,
                html,
                attachments,
            });

            return {
                messageId: info.messageId,
                accepted: info.accepted || [],
                rejected: info.rejected || [],
            };
        } catch (error) {
            if (error instanceof AppError) {
                logger.error(`Quotation email failed: ${error.message}`);
                throw error;
            }

            const smtpCode = String(error.code || '').toUpperCase();
            const smtpResponse = cleanEnv(error.response || error.command || error.message);

            logger.error(`Quotation email failed [${smtpCode || 'UNKNOWN'}]: ${smtpResponse || error.message}`);

            if (smtpCode === 'EAUTH' || /auth|username|password/i.test(smtpResponse)) {
                throw new AppError('SMTP authentication failed. Check SMTP_USER and SMTP_PASS.', 502);
            }

            if (smtpCode === 'ENOTFOUND' || smtpCode === 'EAI_AGAIN') {
                throw new AppError('SMTP host could not be resolved. Check SMTP_HOST.', 502);
            }

            if (smtpCode === 'ECONNECTION' || smtpCode === 'ESOCKET' || smtpCode === 'ETIMEDOUT') {
                throw new AppError('Could not connect to SMTP server. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and firewall/network.', 502);
            }

            if (/self[- ]signed|unable to verify|certificate/i.test(smtpResponse)) {
                throw new AppError('SMTP TLS certificate verification failed. For self-signed certs, set SMTP_REJECT_UNAUTHORIZED=false.', 502);
            }

            throw new AppError(`Failed to send quotation email (${smtpCode || 'UNKNOWN SMTP ERROR'})`, 502);
        }
    }
}

module.exports = EmailService;