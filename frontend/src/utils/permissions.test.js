import { describe, expect, it } from 'vitest'
import { can, canAny } from './permissions'

describe('permissions utility', () => {
    it('allows admin-only permissions only for admin', () => {
        expect(can('admin', 'users.manage')).toBe(true)
        expect(can('manager', 'users.manage')).toBe(false)
        expect(can('cashier', 'users.manage')).toBe(false)
    })

    it('allows manager operational permissions', () => {
        expect(can('manager', 'products.edit')).toBe(true)
        expect(can('manager', 'expenses.create')).toBe(true)
        expect(can('manager', 'sales.create')).toBe(true)
    })

    it('restricts cashier from elevated permissions', () => {
        expect(can('cashier', 'products.view_cost_price')).toBe(false)
        expect(can('cashier', 'expenses.create')).toBe(false)
        expect(can('cashier', 'reports.view_today')).toBe(true)
    })

    it('returns false for unknown permissions', () => {
        expect(can('admin', 'unknown.permission')).toBe(false)
    })

    it('canAny returns true when at least one permission is allowed', () => {
        expect(canAny('manager', ['users.manage', 'products.edit'])).toBe(true)
    })

    it('canAny returns false when no permissions are allowed', () => {
        expect(canAny('cashier', ['users.manage', 'products.delete'])).toBe(false)
    })
})
