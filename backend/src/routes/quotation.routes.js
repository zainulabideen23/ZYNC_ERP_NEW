const express = require('express');
const router = express.Router();
const db = require('../config/database');
const QuotationService = require('../services/quotation.service');
const EmailService = require('../services/email.service');
const PdfService = require('../services/pdf.service');
const { authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../utils/audit');
const { generateSecureToken, resolveTokenExpiryDate, isTokenExpired } = require('../utils/tokenGenerator');

const ALLOWED_QUOTATION_STATUSES = new Set(['draft', 'sent', 'accepted', 'rejected', 'converted']);
const BLOCKED_RECIPIENT_DOMAINS = new Set([
    'example.com',
    'example.org',
    'example.net',
    'localhost',
]);

const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const addDays = (date, days) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
};

const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
};

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const parseBoolean = (value, fallback = true) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).toLowerCase();
    return !['false', '0', 'no', 'off'].includes(normalized);
};

const parseOptionalPositiveInteger = (value, fieldName) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new AppError(`${fieldName} must be a positive integer`, 400);
    }
    return parsed;
};

const getEmailDomain = (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex <= 0) return '';
    return normalized.slice(atIndex + 1);
};

const isBlockedRecipientDomain = (email) => {
    const domain = getEmailDomain(email);
    if (!domain) return false;

    if (BLOCKED_RECIPIENT_DOMAINS.has(domain)) return true;
    if (domain.endsWith('.example')) return true;
    if (domain.endsWith('.invalid')) return true;

    return false;
};

const cleanEnv = (value) => String(value || '').trim();

const getPublicAppUrl = () => {
    const configured = cleanEnv(process.env.PUBLIC_APP_URL).replace(/\/+$/, '');
    if (configured) return configured;
    return 'http://localhost:5173';
};

const buildPublicResponseLinks = (token) => {
    const base = getPublicAppUrl();
    const safeToken = encodeURIComponent(token);
    return {
        acceptUrl: `${base}/#/quote/accept/${safeToken}`,
        rejectUrl: `${base}/#/quote/reject/${safeToken}`,
        confirmUrl: `${base}/#/quote/confirm/${safeToken}`,
    };
};

const ensureQuotationResponseToken = async ({ quotation, userId, tokenExpiryDays, regenerateToken = false }) => {
    const now = new Date();
    const existingToken = String(quotation.response_token || '').trim();

    const reusableToken = !regenerateToken
        && existingToken
        && quotation.token_expires_at
        && !quotation.responded_at
        && !isTokenExpired(quotation.token_expires_at, now);

    const expiresAt = resolveTokenExpiryDate({
        quotationValidUntil: quotation.valid_until,
        customExpiryDays: tokenExpiryDays,
        now,
    });

    if (reusableToken && tokenExpiryDays === undefined) {
        return {
            token: existingToken,
            expiresAt: quotation.token_expires_at,
        };
    }

    let token = reusableToken ? existingToken : generateSecureToken();

    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const [updated] = await db('quotations')
                .where({ id: quotation.id, tenant_id: quotation.tenant_id })
                .update({
                    response_token: token,
                    token_expires_at: expiresAt,
                    updated_at: now,
                    updated_by: userId || quotation.updated_by || null,
                })
                .returning(['response_token', 'token_expires_at']);

            return {
                token: updated?.response_token || token,
                expiresAt: updated?.token_expires_at || expiresAt,
            };
        } catch (error) {
            if (error.code === '42703') {
                throw new AppError('Quotation response token columns are missing. Run database migrations first.', 500);
            }

            if (error.code === '23505') {
                token = generateSecureToken();
                continue;
            }

            throw error;
        }
    }

    throw new AppError('Failed to generate quotation response token. Please retry.', 500);
};

const fetchQuotationWithItems = async (executor, quotationId, tenantId) => {
    const quotation = await executor('quotations as q')
        .leftJoin('customers as c', 'q.customer_id', 'c.id')
        .select(
            'q.*',
            'c.name as customer_name',
            'c.email as customer_email',
            'c.phone_number as customer_phone',
            'c.address_line1 as customer_address'
        )
        .where('q.id', quotationId)
        .where('q.tenant_id', tenantId)
        .first();

    if (!quotation) throw new AppError('Quotation not found', 404);

    const items = await executor('quotation_items as qi')
        .join('products as p', 'qi.product_id', 'p.id')
        .select('qi.*', 'p.name as product_name', 'p.code as product_code')
        .where('qi.quotation_id', quotationId)
        .where('qi.tenant_id', tenantId)
        .where('p.tenant_id', tenantId)
        .where('p.is_deleted', false);

    return { ...quotation, items };
};

const fetchCompanyInfo = async (executor, tenantId) => {
    const company = await executor('company_info')
        .where('tenant_id', tenantId)
        .first();

    return company || {};
};

const buildQuotationEmailHtml = ({ quotation, companyName, customMessage, acceptUrl, rejectUrl, confirmUrl, tokenExpiresAt }) => {
    const safeCompanyName = escapeHtml(companyName || 'ZYNC ERP');
    const safeCustomerName = escapeHtml(quotation.customer_name || 'Customer');
    const safeQuotationNumber = escapeHtml(quotation.quotation_number || '-');
    const safeTotal = escapeHtml(String(safeNumber(quotation.total_amount, 0).toLocaleString()));
    const safeAcceptUrl = escapeHtml(acceptUrl || '#');
    const safeRejectUrl = escapeHtml(rejectUrl || '#');
    const safeConfirmUrl = escapeHtml(confirmUrl || '#');
    const expiresOn = tokenExpiresAt ? formatDate(tokenExpiresAt) : '-';
    const normalizedMessage = String(customMessage || '').trim();
    const hasCustomGreeting = /^dear\b/i.test(normalizedMessage);
    const greetingLine = hasCustomGreeting
        ? ''
        : `<p style="margin:0 0 16px 0;color:#4b5563;">Dear ${safeCustomerName},</p>`;
    const safeMessage = normalizedMessage
        ? `<p style="margin:0 0 16px 0; color:#374151; white-space:pre-line;">${escapeHtml(normalizedMessage)}</p>`
        : '';

    return `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111827;">
            <h2 style="margin:0 0 12px 0;">Quotation ${safeQuotationNumber}</h2>
            ${greetingLine}
            ${safeMessage}
            <p style="margin:0 0 10px 0;color:#374151;">Please find your quotation details below:</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 18px 0;">
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;">Quotation #</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${safeQuotationNumber}</td>
                </tr>
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;">Quotation Date</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(formatDate(quotation.quotation_date))}</td>
                </tr>
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;">Valid Until</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(formatDate(quotation.valid_until))}</td>
                </tr>
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;">Total Amount</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Rs. ${safeTotal}</td>
                </tr>
            </table>
            <p style="margin:0 0 12px 0;color:#374151;">Please confirm your response using the buttons below:</p>
            <div style="margin:0 0 14px 0;display:flex;gap:10px;flex-wrap:wrap;">
                <a href="${safeAcceptUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;">Accept Quotation</a>
                <a href="${safeRejectUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;color:#b91c1c;text-decoration:none;font-weight:600;">Reject</a>
            </div>
            <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">Link expires on ${escapeHtml(expiresOn)}.</p>
            <p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">View online: <a href="${safeConfirmUrl}" style="color:#2563eb;">${safeConfirmUrl}</a></p>
            <p style="margin:0;color:#4b5563;">Regards,<br/>${safeCompanyName}</p>
        </div>
    `;
};

const buildQuotationEmailText = ({ quotation, companyName, customMessage, acceptUrl, rejectUrl, confirmUrl, tokenExpiresAt }) => {
    const normalizedMessage = String(customMessage || '').trim();
    const intro = normalizedMessage ? `${normalizedMessage}\n\n` : '';
    return `${intro}Quotation ${quotation.quotation_number || '-'}\nDate: ${formatDate(quotation.quotation_date)}\nValid Until: ${formatDate(quotation.valid_until)}\nTotal: Rs. ${safeNumber(quotation.total_amount, 0).toLocaleString()}\n\nAccept: ${acceptUrl}\nReject: ${rejectUrl}\nView online: ${confirmUrl}\nResponse link expires on: ${formatDate(tokenExpiresAt)}\n\nRegards,\n${companyName || 'ZYNC ERP'}`;
};

const processQuotationItems = async (trx, items, tenantId, userId) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new AppError('At least one quotation item is required', 400);
    }

    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
        if (!item.product_id) {
            throw new AppError('product_id is required for every quotation item', 400);
        }

        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const lineDiscount = safeNumber(item.line_discount, 0);
        const taxRate = safeNumber(item.tax_rate, 0);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new AppError('Item quantity must be greater than zero', 400);
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new AppError('Item unit_price must be zero or greater', 400);
        }
        if (!Number.isFinite(lineDiscount) || lineDiscount < 0) {
            throw new AppError('Item line_discount must be zero or greater', 400);
        }

        const product = await trx('products')
            .where({ id: item.product_id, tenant_id: tenantId, is_deleted: false })
            .first();

        if (!product) throw new AppError(`Product not found: ${item.product_id}`, 404);

        const computedLineTotal = (quantity * unitPrice) - lineDiscount;
        const lineTotal = item.line_total !== undefined && item.line_total !== null
            ? Number(item.line_total)
            : computedLineTotal;

        if (!Number.isFinite(lineTotal) || lineTotal < 0) {
            throw new AppError('Item line_total must be zero or greater', 400);
        }

        subtotal += quantity * unitPrice;

        processedItems.push({
            product_id: item.product_id,
            quantity,
            unit_price: unitPrice,
            line_discount: lineDiscount,
            tax_rate: taxRate,
            line_total: lineTotal,
            created_by: userId,
            tenant_id: tenantId,
        });
    }

    return { subtotal, processedItems };
};

// Get all quotations
router.get('/', async (req, res, next) => {
    try {
        const quotationService = new QuotationService(db, req.tenantId);
        const result = await quotationService.list(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Get single quotation
router.get('/:id', async (req, res, next) => {
    try {
        const quotation = await fetchQuotationWithItems(db, req.params.id, req.tenantId);
        res.json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

// Create quotation
router.post('/', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const quotationService = new QuotationService(db, req.tenantId);
        const quotation = await quotationService.create(req.body, req.user.id);

        // Audit quotation creation
        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'quotations',
            recordId: quotation.id,
            newValues: { id: quotation.id, quotation_number: quotation.quotation_number, customer_id: quotation.customer_id, total_amount: quotation.total_amount },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.status(201).json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

// Update quotation
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const {
            customer_id,
            quotation_date,
            valid_until,
            status,
            items,
            discount_amount = 0,
            tax_amount = 0,
        } = req.body;

        if (!customer_id) throw new AppError('customer_id is required', 400);

        await db.transaction(async (trx) => {
            const oldQuotation = await trx('quotations')
                .where({ id: req.params.id, tenant_id: req.tenantId })
                .first();

            if (!oldQuotation) throw new AppError('Quotation not found', 404);
            if (oldQuotation.status === 'converted') {
                throw new AppError('Converted quotations cannot be edited', 400);
            }

            const nextStatus = status || oldQuotation.status;
            if (!ALLOWED_QUOTATION_STATUSES.has(nextStatus)) {
                throw new AppError('Invalid quotation status', 400);
            }
            if (nextStatus === 'converted' && oldQuotation.status !== 'converted') {
                throw new AppError('Use conversion flow to mark quotation as converted', 400);
            }

            const customer = await trx('customers')
                .where({ id: customer_id, tenant_id: req.tenantId, is_deleted: false })
                .first();
            if (!customer) throw new AppError('Customer not found', 404);

            const normalizedDiscount = safeNumber(discount_amount, 0);
            const normalizedTax = safeNumber(tax_amount, 0);
            if (normalizedDiscount < 0 || normalizedTax < 0) {
                throw new AppError('Discount and tax must be zero or greater', 400);
            }

            const { subtotal, processedItems } = await processQuotationItems(trx, items, req.tenantId, req.user.id);
            const totalAmount = (subtotal - normalizedDiscount) + normalizedTax;

            if (totalAmount < 0) {
                throw new AppError('Total amount cannot be negative', 400);
            }

            const [updated] = await trx('quotations')
                .where({ id: req.params.id, tenant_id: req.tenantId })
                .update({
                    customer_id,
                    quotation_date: quotation_date || oldQuotation.quotation_date,
                    valid_until: valid_until || oldQuotation.valid_until,
                    subtotal,
                    discount_amount: normalizedDiscount,
                    tax_amount: normalizedTax,
                    total_amount: totalAmount,
                    status: nextStatus,
                    updated_at: new Date(),
                    updated_by: req.user.id,
                })
                .returning('*');

            await trx('quotation_items')
                .where({ quotation_id: req.params.id, tenant_id: req.tenantId })
                .del();

            if (processedItems.length > 0) {
                await trx('quotation_items').insert(
                    processedItems.map((item) => ({
                        ...item,
                        quotation_id: req.params.id,
                    }))
                );
            }

            await audit(db, {
                userId: req.user.id,
                action: 'update',
                tableName: 'quotations',
                recordId: req.params.id,
                oldValues: {
                    customer_id: oldQuotation.customer_id,
                    total_amount: oldQuotation.total_amount,
                    status: oldQuotation.status,
                },
                newValues: {
                    customer_id: updated.customer_id,
                    total_amount: updated.total_amount,
                    status: updated.status,
                },
                ip: req.ip,
                tenantId: req.tenantId,
            });

            const refreshed = await fetchQuotationWithItems(trx, req.params.id, req.tenantId);
            res.json({ success: true, data: refreshed });
        });
    } catch (error) {
        next(error);
    }
});

// Duplicate quotation
router.post('/:id/duplicate', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const sourceQuotation = await fetchQuotationWithItems(db, req.params.id, req.tenantId);
        const quotationService = new QuotationService(db, req.tenantId);

        const duplicatePayload = {
            customer_id: sourceQuotation.customer_id,
            valid_until: addDays(new Date(), 30),
            items: (sourceQuotation.items || []).map((item) => ({
                product_id: item.product_id,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                line_discount: safeNumber(item.line_discount, 0),
                tax_rate: safeNumber(item.tax_rate, 0),
                line_total: safeNumber(item.line_total, 0),
            })),
            discount_amount: safeNumber(sourceQuotation.discount_amount, 0),
            tax_amount: safeNumber(sourceQuotation.tax_amount, 0),
        };

        const duplicatedQuotation = await quotationService.create(duplicatePayload, req.user.id);
        const duplicatedWithItems = await fetchQuotationWithItems(db, duplicatedQuotation.id, req.tenantId);

        await audit(db, {
            userId: req.user.id,
            action: 'create',
            tableName: 'quotations',
            recordId: duplicatedQuotation.id,
            oldValues: { source_quotation_id: sourceQuotation.id, source_quotation_number: sourceQuotation.quotation_number },
            newValues: {
                quotation_number: duplicatedQuotation.quotation_number,
                customer_id: duplicatedQuotation.customer_id,
                total_amount: duplicatedQuotation.total_amount,
                status: duplicatedQuotation.status,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.status(201).json({ success: true, data: duplicatedWithItems });
    } catch (error) {
        next(error);
    }
});

// Update status
router.patch('/:id/status', authorize('admin', 'manager'), async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!ALLOWED_QUOTATION_STATUSES.has(status)) {
            throw new AppError('Invalid quotation status', 400);
        }

        // Fetch old quotation for audit
        const oldQuotation = await db('quotations')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .first();

        if (!oldQuotation) throw new AppError('Quotation not found', 404);
        if (oldQuotation.status === 'converted' && status !== 'converted') {
            throw new AppError('Converted quotation status cannot be changed', 400);
        }

        const [quotation] = await db('quotations')
            .where({ id: req.params.id, tenant_id: req.tenantId })
            .update({ status, updated_at: new Date(), updated_by: req.user.id })
            .returning('*');

        // Audit quotation status change
        await audit(db, {
            userId: req.user.id,
            action: status === 'converted' ? 'approve' : 'update',
            tableName: 'quotations',
            recordId: req.params.id,
            oldValues: { status: oldQuotation?.status, quotation_number: oldQuotation?.quotation_number },
            newValues: { status: quotation.status },
            ip: req.ip,
            tenantId: req.tenantId
        });

        res.json({ success: true, data: quotation });
    } catch (error) {
        next(error);
    }
});

// Download quotation as PDF
router.get('/:id/pdf', authorize('admin', 'manager', 'cashier'), async (req, res, next) => {
    try {
        const quotation = await fetchQuotationWithItems(db, req.params.id, req.tenantId);
        const companyInfo = await fetchCompanyInfo(db, req.tenantId);
        const pdfService = new PdfService();

        const pdfBuffer = await pdfService.generateQuotationPdf({ quotation, companyInfo });
        const safeFileName = String(quotation.quotation_number || 'quotation').replace(/[^a-zA-Z0-9_-]/g, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
});

const sendQuotationEmailHandler = async (req, res, next) => {
    try {
        const {
            toEmail,
            to_email,
            subject,
            message,
            includePdf,
            include_pdf,
            tokenExpiryDays,
            token_expiry_days,
            regenerateToken,
            regenerate_token,
        } = req.body || {};

        const quotation = await fetchQuotationWithItems(db, req.params.id, req.tenantId);
        const companyInfo = await fetchCompanyInfo(db, req.tenantId);

        if (quotation.responded_at) {
            throw new AppError('This quotation already has a customer response recorded', 400);
        }

        const normalizedTokenExpiryDays = parseOptionalPositiveInteger(
            tokenExpiryDays ?? token_expiry_days,
            'token_expiry_days'
        );
        const shouldRegenerateToken = parseBoolean(regenerateToken ?? regenerate_token, false);

        const { token: responseToken, expiresAt: tokenExpiresAt } = await ensureQuotationResponseToken({
            quotation,
            userId: req.user.id,
            tokenExpiryDays: normalizedTokenExpiryDays,
            regenerateToken: shouldRegenerateToken,
        });

        const links = buildPublicResponseLinks(responseToken);

        const recipientEmail = String(toEmail || to_email || quotation.customer_email || '').trim();
        if (!recipientEmail) throw new AppError('Recipient email is required', 400);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
            throw new AppError('Invalid recipient email format', 400);
        }
        if (isBlockedRecipientDomain(recipientEmail)) {
            throw new AppError('Recipient email uses a placeholder or non-routable domain. Use a real customer email address.', 400);
        }

        const attachPdf = parseBoolean(includePdf ?? include_pdf, true);
        const companyName = companyInfo.company_name || req.tenant?.name || 'ZYNC ERP';

        const emailService = new EmailService();
        const pdfService = new PdfService();

        const normalizedSubject = String(subject || `Quotation ${quotation.quotation_number}`).trim();
        const emailText = buildQuotationEmailText({
            quotation,
            companyName,
            customMessage: message,
            acceptUrl: links.acceptUrl,
            rejectUrl: links.rejectUrl,
            confirmUrl: links.confirmUrl,
            tokenExpiresAt,
        });
        const emailHtml = buildQuotationEmailHtml({
            quotation,
            companyName,
            customMessage: message,
            acceptUrl: links.acceptUrl,
            rejectUrl: links.rejectUrl,
            confirmUrl: links.confirmUrl,
            tokenExpiresAt,
        });

        const attachments = [];
        if (attachPdf) {
            const pdfBuffer = await pdfService.generateQuotationPdf({ quotation, companyInfo });
            const safeFileName = String(quotation.quotation_number || 'quotation').replace(/[^a-zA-Z0-9_-]/g, '_');
            attachments.push({
                filename: `${safeFileName}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            });
        }

        const emailResult = await emailService.sendQuotationEmail({
            to: recipientEmail,
            subject: normalizedSubject,
            text: emailText,
            html: emailHtml,
            attachments,
        });

        const statusAfterSend = quotation.status === 'draft' ? 'sent' : quotation.status;
        const now = new Date();
        const baseUpdate = {
            status: statusAfterSend,
            updated_at: now,
            updated_by: req.user.id,
        };

        let updatedQuotation;
        try {
            [updatedQuotation] = await db('quotations')
                .where({ id: req.params.id, tenant_id: req.tenantId })
                .update({
                    ...baseUpdate,
                    email_sent_at: now,
                    email_sent_count: db.raw('COALESCE(email_sent_count, 0) + 1'),
                    last_emailed_to: recipientEmail,
                })
                .returning('*');
        } catch (updateError) {
            // Fallback for environments where tracking columns are not migrated yet.
            if (updateError.code !== '42703') throw updateError;

            [updatedQuotation] = await db('quotations')
                .where({ id: req.params.id, tenant_id: req.tenantId })
                .update(baseUpdate)
                .returning('*');
        }

        await audit(db, {
            userId: req.user.id,
            action: 'update',
            tableName: 'quotations',
            recordId: req.params.id,
            oldValues: {
                status: quotation.status,
                last_emailed_to: quotation.last_emailed_to || null,
                email_sent_count: safeNumber(quotation.email_sent_count, 0),
            },
            newValues: {
                status: updatedQuotation?.status || statusAfterSend,
                last_emailed_to: recipientEmail,
                email_sent_count: safeNumber(quotation.email_sent_count, 0) + 1,
                email_sent_at: now.toISOString(),
                token_expires_at: tokenExpiresAt,
            },
            ip: req.ip,
            tenantId: req.tenantId,
        });

        res.json({
            success: true,
            data: {
                quotation_id: req.params.id,
                status: updatedQuotation?.status || statusAfterSend,
                sent_to: recipientEmail,
                message_id: emailResult.messageId,
                response_token: responseToken,
                response_link_expires_at: tokenExpiresAt,
                accept_url: links.acceptUrl,
                reject_url: links.rejectUrl,
                confirm_url: links.confirmUrl,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Send quotation by email
router.post('/:id/send-email', authorize('admin', 'manager', 'cashier'), sendQuotationEmailHandler);

// Send reminder email with the same token flow
router.post('/:id/send-reminder', authorize('admin', 'manager', 'cashier'), sendQuotationEmailHandler);

module.exports = router;
