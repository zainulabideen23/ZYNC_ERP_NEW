import { describe, expect, it } from 'vitest'
import { formatPakistaniPhone, validatePakistaniPhone, getPhoneError } from './phoneFormat'

describe('phoneFormat utility', () => {
    describe('formatPakistaniPhone', () => {
        it('normalizes local and partial formats to +92 format', () => {
            expect(formatPakistaniPhone('03001234567')).toBe('+923001234567')
            expect(formatPakistaniPhone('923001234567')).toBe('+923001234567')
            expect(formatPakistaniPhone('3001234567')).toBe('+923001234567')
            expect(formatPakistaniPhone('+92 300-123-4567')).toBe('+923001234567')
        })

        it('returns cleaned value when format is incomplete', () => {
            expect(formatPakistaniPhone('+92300')).toBe('+92300')
            expect(formatPakistaniPhone('abc+92')).toBe('+92')
        })
    })

    describe('validatePakistaniPhone', () => {
        it('accepts empty values and valid Pakistani mobile numbers', () => {
            expect(validatePakistaniPhone('')).toBe(true)
            expect(validatePakistaniPhone('+923001234567')).toBe(true)
            expect(validatePakistaniPhone('+923121234567')).toBe(true)
        })

        it('rejects invalid prefixes and malformed lengths', () => {
            expect(validatePakistaniPhone('+925001234567')).toBe(false)
            expect(validatePakistaniPhone('+92300123456')).toBe(false)
            expect(validatePakistaniPhone('03001234567')).toBe(false)
        })
    })

    describe('getPhoneError', () => {
        it('returns specific validation messages', () => {
            expect(getPhoneError('+913001234567')).toBe('Phone number must start with +92.')
            expect(getPhoneError('+92300123456')).toBe('Phone number must have exactly 10 digits after +92.')
            expect(getPhoneError('+92300AB34567')).toBe('Phone number must contain only digits after +92.')
            expect(getPhoneError('+925001234567')).toBe('Invalid operator prefix. Must start with 30x, 31x, 32x, 33x, or 34x.')
        })

        it('returns null when valid or empty', () => {
            expect(getPhoneError('')).toBeNull()
            expect(getPhoneError('+923001234567')).toBeNull()
        })
    })
})