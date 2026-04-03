/**
 * Phone Number Validation Rules
 * 
 * Pakistani mobile format: +92 3XX XXXXXXX
 * - Must start with +92
 * - First digit after +92 must be 3
 * - Operator prefix (3[0-4]X): 300-309 Jazz, 310-319 Telenor, 320-329 Zong, 330-339 Ufone, 340-349 Warid/Jazz
 * - Followed by exactly 7 more digits (total 10 digits after +92)
 * - Regex: ^\+92(3[0-4][0-9])\d{7}$
 * 
 * Example valid:   +923001234567, +923121234567
 * Example invalid: +925001234567, +9230012345 (9 digits), +92300069047 (9 digits)
 */

const { body } = require('express-validator');

/**
 * Validate a Pakistani phone number with granular error messages
 * 
 * @param {string} value - The phone number to validate
 * @returns {{ valid: boolean, message?: string }}
 */
const validatePakistaniPhone = (value) => {
    if (!value || value.trim() === '') return { valid: true }; // empty is OK when optional

    if (!value.startsWith('+92')) {
        return { valid: false, message: 'Phone number must start with +92.' };
    }

    const afterPrefix = value.slice(3); // digits after +92

    if (afterPrefix.length !== 10) {
        return { valid: false, message: 'Phone number must have exactly 10 digits after +92.' };
    }

    if (!/^\d{10}$/.test(afterPrefix)) {
        return { valid: false, message: 'Phone number must contain only digits after +92.' };
    }

    if (!/^3[0-4]/.test(afterPrefix)) {
        return { valid: false, message: 'Invalid operator prefix. Must start with 30x, 31x, 32x, 33x, or 34x.' };
    }

    return { valid: true };
};

/**
 * Create an express-validator rule for Pakistani phone numbers
 * 
 * @param {string} fieldName - The request body field name
 * @param {boolean} optional - Whether the field is optional
 * @returns {object} express-validator chain
 */
const phoneRule = (fieldName, optional = false) => {
    let rule = body(fieldName);

    if (optional) {
        rule = rule.optional({ nullable: true, checkFalsy: true });
    }

    return rule.custom((value) => {
        const result = validatePakistaniPhone(value);
        if (!result.valid) {
            throw new Error(result.message);
        }
        return true;
    });
};

module.exports = { phoneRule, validatePakistaniPhone };
