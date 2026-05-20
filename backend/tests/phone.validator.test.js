const { validationResult } = require('express-validator');
const { validatePakistaniPhone, phoneRule } = require('../src/validators/phone.validator');

describe('phone validator', () => {
    describe('validatePakistaniPhone', () => {
        it('accepts empty values for optional fields', () => {
            expect(validatePakistaniPhone('')).toEqual({ valid: true });
            expect(validatePakistaniPhone(null)).toEqual({ valid: true });
        });

        it('accepts valid Pakistani mobile format', () => {
            expect(validatePakistaniPhone('+923001234567')).toEqual({ valid: true });
            expect(validatePakistaniPhone('+923121234567')).toEqual({ valid: true });
        });

        it('returns error when prefix is not +92', () => {
            expect(validatePakistaniPhone('+913001234567')).toEqual({
                valid: false,
                message: 'Phone number must start with +92.',
            });
        });

        it('returns error for non-digit characters after prefix', () => {
            expect(validatePakistaniPhone('+92300AB34567')).toEqual({
                valid: false,
                message: 'Phone number must contain only digits after +92.',
            });
        });

        it('returns error for invalid operator prefix', () => {
            expect(validatePakistaniPhone('+925001234567')).toEqual({
                valid: false,
                message: 'Invalid operator prefix. Must start with 30x, 31x, 32x, 33x, or 34x.',
            });
        });
    });

    describe('phoneRule', () => {
        it('adds validation error for invalid phone on required rule', async () => {
            const req = { body: { phone: '12345' }, params: {}, query: {} };
            await phoneRule('phone').run(req);

            const errors = validationResult(req).array();
            expect(errors).toHaveLength(1);
            expect(errors[0].msg).toBe('Phone number must start with +92.');
        });

        it('passes for missing value when rule is optional', async () => {
            const req = { body: {}, params: {}, query: {} };
            await phoneRule('phone', true).run(req);

            expect(validationResult(req).isEmpty()).toBe(true);
        });
    });
});