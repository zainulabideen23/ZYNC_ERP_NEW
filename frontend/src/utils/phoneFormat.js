/**
 * Pakistani Phone Number Formatting & Validation Utility
 * 
 * Validates and auto-formats phone numbers to +92XXXXXXXXXX format.
 * 
 * Valid Pakistani mobile prefixes (operator codes):
 *   300-309 → Jazz / Mobilink
 *   310-319 → Telenor
 *   320-329 → Zong
 *   330-339 → Ufone
 *   340-349 → Warid / Jazz
 * 
 * Regex: ^\+92(3[0-4][0-9])\d{7}$
 */

/**
 * Auto-format a phone number input to Pakistani +92 format
 * 
 * Handles these common input patterns:
 * - 03001234567 → +923001234567
 * - 923001234567 → +923001234567
 * - 3001234567 → +923001234567
 * - +923001234567 → +923001234567 (already correct)
 * 
 * @param {string} value - Raw phone input
 * @returns {string} Formatted phone number
 */
export const formatPakistaniPhone = (value) => {
    if (!value) return '';

    // Remove everything except digits and +
    const cleaned = value.replace(/[^\d+]/g, '');
    const digits = cleaned.replace(/\D/g, '');

    // Already in correct format
    if (cleaned.startsWith('+92') && digits.length === 12) {
        return cleaned;
    }
    // Starts with 0 (local format): 03001234567
    if (digits.startsWith('0') && digits.length === 11) {
        return '+92' + digits.slice(1);
    }
    // Starts with 92 (no +): 923001234567
    if (digits.startsWith('92') && digits.length === 12) {
        return '+' + digits;
    }
    // Just 10 digits: 3001234567
    if (digits.length === 10 && !digits.startsWith('0')) {
        return '+92' + digits;
    }

    // Return cleaned value if can't determine format (let user keep typing)
    return cleaned;
};

/**
 * Validate a phone number matches the strict Pakistani mobile format
 * 
 * Rules:
 * - Must start with +92
 * - Exactly 10 digits after +92 (13 chars total)
 * - First digit after +92 must be 3
 * - Operator prefix must be 3[0-4]X (i.e. 300-349)
 * 
 * @param {string} value - Phone number to validate
 * @returns {boolean} Whether the phone number is valid
 */
export const validatePakistaniPhone = (value) => {
    if (!value) return true; // Empty is OK (field might be optional)
    return /^\+92(3[0-4][0-9])\d{7}$/.test(value);
};

/**
 * Get a specific validation error message for a Pakistani phone number
 * 
 * @param {string} value - Phone number to validate
 * @returns {string|null} Error message, or null if valid
 */
export const getPhoneError = (value) => {
    if (!value) return null;
    if (!value.startsWith('+92')) return 'Phone number must start with +92.';
    const after = value.slice(3);
    if (after.length !== 10) return 'Phone number must have exactly 10 digits after +92.';
    if (!/^\d{10}$/.test(after)) return 'Phone number must contain only digits after +92.';
    if (!/^3[0-4]/.test(after)) return 'Invalid operator prefix. Must start with 30x, 31x, 32x, 33x, or 34x.';
    return null;
};
