const crypto = require('crypto');

const DEFAULT_TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_DAYS = 30;

const toPositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const toDateOrNull = (value) => {
    if (!value) return null;
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return null;
    return dateValue;
};

const getDefaultTokenExpiryDays = () => toPositiveInteger(process.env.QUOTATION_TOKEN_EXPIRY_DAYS, DEFAULT_EXPIRY_DAYS);

const generateSecureToken = (byteLength = DEFAULT_TOKEN_BYTES) => {
    const size = Math.max(16, toPositiveInteger(byteLength, DEFAULT_TOKEN_BYTES));
    return crypto.randomBytes(size).toString('hex');
};

const resolveTokenExpiryDate = ({ quotationValidUntil, customExpiryDays, now = new Date() } = {}) => {
    const currentTime = toDateOrNull(now) || new Date();
    const customDays = toPositiveInteger(customExpiryDays, 0);

    if (customDays > 0) {
        const customExpiry = new Date(currentTime);
        customExpiry.setDate(customExpiry.getDate() + customDays);
        return customExpiry;
    }

    const validUntil = toDateOrNull(quotationValidUntil);
    if (validUntil) {
        const quotationExpiry = new Date(validUntil);
        quotationExpiry.setHours(23, 59, 59, 999);
        if (quotationExpiry > currentTime) return quotationExpiry;
    }

    const fallbackExpiry = new Date(currentTime);
    fallbackExpiry.setDate(fallbackExpiry.getDate() + getDefaultTokenExpiryDays());
    return fallbackExpiry;
};

const isTokenExpired = (expiresAt, now = new Date()) => {
    const expiryDate = toDateOrNull(expiresAt);
    if (!expiryDate) return false;
    return expiryDate <= (toDateOrNull(now) || new Date());
};

module.exports = {
    generateSecureToken,
    resolveTokenExpiryDate,
    isTokenExpired,
    getDefaultTokenExpiryDays,
};
