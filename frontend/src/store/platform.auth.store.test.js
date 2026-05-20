import { beforeEach, describe, expect, it } from 'vitest'
import { usePlatformAuthStore } from './platform.auth.store'

describe('platform auth store', () => {
    beforeEach(() => {
        localStorage.clear()
        window.location.hash = ''
        usePlatformAuthStore.setState({
            platformAdmin: null,
            platformToken: null,
            isAuthenticated: false,
        })
    })

    it('login stores platform admin and token', () => {
        const admin = { id: 'admin-1', email: 'owner@platform.test' }

        usePlatformAuthStore.getState().login(admin, 'platform-token')

        const state = usePlatformAuthStore.getState()
        expect(state.isAuthenticated).toBe(true)
        expect(state.platformAdmin).toEqual(admin)
        expect(state.platformToken).toBe('platform-token')
    })

    it('getToken returns the current platform token', () => {
        usePlatformAuthStore.getState().login({ id: 'admin-2' }, 'token-2')
        expect(usePlatformAuthStore.getState().getToken()).toBe('token-2')
    })

    it('logout clears auth state and redirects to platform login', () => {
        usePlatformAuthStore.getState().login({ id: 'admin-3' }, 'token-3')
        usePlatformAuthStore.getState().logout()

        const state = usePlatformAuthStore.getState()
        expect(state.isAuthenticated).toBe(false)
        expect(state.platformAdmin).toBeNull()
        expect(state.platformToken).toBeNull()
        expect(window.location.hash).toBe('#/platform/login')
    })
})