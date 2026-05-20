const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { isTokenExpired } = require('../utils/tokenGenerator');
const audit = require('../utils/audit');

const router = express.Router();

const PUBLIC_QUOTE_RATE_LIMIT_MAX = Number.parseInt(process.env.QUOTE_PUBLIC_RATE_LIMIT_MAX || '60', 10);
const PUBLIC_QUOTE_RESPOND_LIMIT_MAX = Number.parseInt(process.env.QUOTE_PUBLIC_RESPOND_RATE_LIMIT_MAX || '20', 10);

const quotePublicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.isNaN(PUBLIC_QUOTE_RATE_LIMIT_MAX) ? 60 : PUBLIC_QUOTE_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many quotation link requests. Please try again shortly.',
    },
});

const quoteResponseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.isNaN(PUBLIC_QUOTE_RESPOND_LIMIT_MAX) ? 20 : PUBLIC_QUOTE_RESPOND_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many response attempts. Please try again shortly.',
    },
});

const cleanEnv = (value) => String(value || '').trim();

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toISOString().slice(0, 10);
};

const formatMoney = (value) => Number(value || 0).toLocaleString();

const sanitizeToken = (token) => {
    const normalized = String(token || '').trim();
    if (!/^[a-zA-Z0-9_-]{32,255}$/.test(normalized)) {
        throw new AppError('Invalid quotation token format', 400);
    }
    return normalized;
};

const getPublicAppUrl = () => {
    const configured = cleanEnv(process.env.PUBLIC_APP_URL).replace(/\/+$/, '');
    if (configured) return configured;
    return 'http://localhost:5173';
};

const buildPublicLinks = (token) => {
    const base = getPublicAppUrl();
    const encodedToken = encodeURIComponent(token);
    return {
        acceptUrl: `${base}/#/quote/accept/${encodedToken}`,
        rejectUrl: `${base}/#/quote/reject/${encodedToken}`,
        confirmUrl: `${base}/#/quote/confirm/${encodedToken}`,
    };
};

const getTokenFlags = (quotation) => {
    const tokenExpired = isTokenExpired(quotation.token_expires_at);
    const tokenUsed = Boolean(quotation.responded_at);
    return {
        tokenExpired,
        tokenUsed,
        tokenValid: !tokenExpired && !tokenUsed,
    };
};

const fetchPublicQuotationByToken = async (token) => {
    const quotation = await db('quotations as q')
        .leftJoin('customers as c', 'q.customer_id', 'c.id')
        .select(
            'q.id',
            'q.tenant_id',
            'q.quotation_number',
            'q.quotation_date',
            'q.valid_until',
            'q.subtotal',
            'q.discount_amount',
            'q.tax_amount',
            'q.total_amount',
            'q.status',
            'q.response_token',
            'q.token_expires_at',
            'q.responded_at',
            'q.response_ip',
            'q.customer_response_notes',
            'q.email_sent_at',
            'q.email_sent_count',
            'c.name as customer_name',
            'c.email as customer_email'
        )
        .where('q.response_token', token)
        .first();

    if (!quotation) {
        throw new AppError('Invalid or expired quotation link', 404);
    }

    const items = await db('quotation_items as qi')
        .leftJoin('products as p', 'qi.product_id', 'p.id')
        .select(
            'qi.product_id',
            'qi.quantity',
            'qi.unit_price',
            'qi.line_discount',
            'qi.tax_rate',
            'qi.line_total',
            'p.name as product_name',
            'p.code as product_code'
        )
        .where('qi.quotation_id', quotation.id)
        .where('qi.tenant_id', quotation.tenant_id)
        .orderBy('qi.created_at', 'asc');

    const companyInfo = await db('company_info')
        .where('tenant_id', quotation.tenant_id)
        .first();

    return {
        ...quotation,
        items,
        company_name: companyInfo?.company_name || 'ZYNC ERP',
    };
};

const buildPublicPayload = (quotation) => {
    const tokenFlags = getTokenFlags(quotation);
    return {
        token_valid: tokenFlags.tokenValid,
        token_expired: tokenFlags.tokenExpired,
        token_used: tokenFlags.tokenUsed,
        quotation: {
            id: quotation.id,
            quotation_number: quotation.quotation_number,
            quotation_date: quotation.quotation_date,
            valid_until: quotation.valid_until,
            subtotal: quotation.subtotal,
            discount_amount: quotation.discount_amount,
            tax_amount: quotation.tax_amount,
            total_amount: quotation.total_amount,
            status: quotation.status,
            customer_name: quotation.customer_name,
            customer_email: quotation.customer_email,
            items: quotation.items,
            token_expires_at: quotation.token_expires_at,
            responded_at: quotation.responded_at,
            customer_response_notes: quotation.customer_response_notes,
            company_name: quotation.company_name,
        },
    };
};

router.use('/quote', quotePublicLimiter);

router.get('/quote/:token', async (req, res, next) => {
    try {
        const token = sanitizeToken(req.params.token);
        const quotation = await fetchPublicQuotationByToken(token);
        res.json({ success: true, data: buildPublicPayload(quotation) });
    } catch (error) {
        next(error);
    }
});

router.post('/quote/:token/respond', quoteResponseLimiter, async (req, res, next) => {
    try {
        const token = sanitizeToken(req.params.token);
        const responseType = String(req.body?.response || '').trim().toLowerCase();
        const normalizedNotes = req.body?.notes === undefined || req.body?.notes === null
            ? null
            : String(req.body.notes).trim();

        if (!['accept', 'reject'].includes(responseType)) {
            throw new AppError('response must be either accept or reject', 400);
        }

        if (normalizedNotes && normalizedNotes.length > 2000) {
            throw new AppError('notes must be 2000 characters or fewer', 400);
        }

        const quotation = await fetchPublicQuotationByToken(token);
        const tokenFlags = getTokenFlags(quotation);

        if (tokenFlags.tokenExpired) {
            throw new AppError('This quotation response link has expired', 410);
        }

        if (tokenFlags.tokenUsed) {
            throw new AppError('This quotation has already been responded to', 409);
        }

        const now = new Date();
        const nextStatus = responseType === 'accept' ? 'accepted' : 'rejected';

        const [updated] = await db('quotations')
            .where({ id: quotation.id, response_token: token })
            .whereNull('responded_at')
            .update({
                status: nextStatus,
                responded_at: now,
                response_ip: req.ip || null,
                customer_response_notes: normalizedNotes || null,
                updated_at: now,
                updated_by: null,
            })
            .returning(['id', 'status', 'responded_at']);

        if (!updated) {
            throw new AppError('This quotation has already been responded to', 409);
        }

        await audit(db, {
            userId: null,
            action: responseType === 'accept' ? 'approve' : 'reject',
            tableName: 'quotations',
            recordId: quotation.id,
            oldValues: {
                status: quotation.status,
                responded_at: quotation.responded_at || null,
            },
            newValues: {
                status: nextStatus,
                responded_at: updated.responded_at,
                response_ip: req.ip || null,
                customer_response_notes: normalizedNotes || null,
            },
            ip: req.ip,
            tenantId: quotation.tenant_id,
        });

        res.json({
            success: true,
            data: {
                quotation_id: updated.id,
                status: updated.status,
                response: responseType,
                responded_at: updated.responded_at,
            },
        });
    } catch (error) {
        next(error);
    }
});

router.get('/quote/:token/confirm-page', async (req, res, next) => {
    try {
        const token = sanitizeToken(req.params.token);
        const quotation = await fetchPublicQuotationByToken(token);
        const links = buildPublicLinks(token);

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quotation ${escapeHtml(quotation.quotation_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px; color: #111827; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
    .label { color: #6b7280; font-size: 13px; }
    .value { font-weight: 600; font-size: 14px; }
    .actions { margin-top: 24px; display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { text-decoration: none; display: inline-block; border-radius: 8px; padding: 10px 14px; font-size: 14px; font-weight: 600; }
    .btn-accept { background: #16a34a; color: #fff; }
    .btn-reject { background: #f3f4f6; color: #b91c1c; border: 1px solid #fecaca; }
    .muted { margin-top: 16px; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 4px 0;">Quotation ${escapeHtml(quotation.quotation_number)}</h2>
    <p style="margin:0;color:#6b7280;">${escapeHtml(quotation.company_name)}</p>

    <div class="grid">
      <div>
        <div class="label">Customer</div>
        <div class="value">${escapeHtml(quotation.customer_name || '-')}</div>
      </div>
      <div>
        <div class="label">Email</div>
        <div class="value">${escapeHtml(quotation.customer_email || '-')}</div>
      </div>
      <div>
        <div class="label">Date</div>
        <div class="value">${escapeHtml(formatDate(quotation.quotation_date))}</div>
      </div>
      <div>
        <div class="label">Valid Until</div>
        <div class="value">${escapeHtml(formatDate(quotation.valid_until))}</div>
      </div>
      <div>
        <div class="label">Total Amount</div>
        <div class="value">Rs. ${escapeHtml(formatMoney(quotation.total_amount))}</div>
      </div>
      <div>
        <div class="label">Status</div>
        <div class="value">${escapeHtml(String(quotation.status || '-').toUpperCase())}</div>
      </div>
    </div>

    <div class="actions">
      <a class="btn btn-accept" href="${escapeHtml(links.acceptUrl)}">Accept Quotation</a>
      <a class="btn btn-reject" href="${escapeHtml(links.rejectUrl)}">Reject</a>
    </div>

    <div class="muted">You can also review details here: <a href="${escapeHtml(links.confirmUrl)}">${escapeHtml(links.confirmUrl)}</a></div>
  </div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
