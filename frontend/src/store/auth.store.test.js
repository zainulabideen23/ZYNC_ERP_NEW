import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth.store'

describe('auth store', () => {
    beforeEach(() => {
        localStorage.clear()
        useAuthStore.getState().logout()
    })

    it('login stores user and token', () => {
        const user = { id: 'u1', username: 'admin', role: 'admin' }
        const tenant = { id: 't1', is_onboarded: false, onboarding_step: 1 }

        useAuthStore.getState().login(user, 'token-123', tenant)

        const state = useAuthStore.getState()
        expect(state.isAuthenticated).toBe(true)
        expect(state.token).toBe('token-123')
        expect(state.user).toEqual(user)
        expect(state.tenant).toEqual(tenant)
    })

    it('logout clears auth state', () => {
        useAuthStore.getState().login({ id: 'u1', username: 'admin', role: 'admin' }, 'token-123', { id: 't1' })
        useAuthStore.getState().logout()

        const state = useAuthStore.getState()
        expect(state.isAuthenticated).toBe(false)
        expect(state.user).toBeNull()
        expect(state.token).toBeNull()
        expect(state.tenant).toBeNull()
    })

    it('hasRole supports single role and list', () => {
        useAuthStore.getState().login({ id: 'u1', username: 'manager', role: 'manager' }, 'token-123', { id: 't1' })

        const state = useAuthStore.getState()
        expect(state.hasRole('manager')).toBe(true)
        expect(state.hasRole('admin')).toBe(false)
        expect(state.hasRole(['cashier', 'manager'])).toBe(true)
        expect(state.hasRole(['cashier'])).toBe(false)
    })

    it('markOnboarded updates tenant onboarding fields', () => {
        useAuthStore.getState().login(
            { id: 'u1', username: 'admin', role: 'admin' },
            'token-123',
            { id: 't1', is_onboarded: false, onboarding_step: 2 }
        )

        useAuthStore.getState().markOnboarded()

        const tenant = useAuthStore.getState().tenant
        expect(tenant.is_onboarded).toBe(true)
        expect(tenant.onboarding_step).toBe(6)
    })
})
