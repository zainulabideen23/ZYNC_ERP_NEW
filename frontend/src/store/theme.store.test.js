import { beforeEach, describe, expect, it } from 'vitest'
import { useThemeStore } from './theme.store'

describe('theme store', () => {
    beforeEach(() => {
        localStorage.clear()
        useThemeStore.getState().setTheme('dark')
    })

    it('starts from dark theme by default', () => {
        expect(useThemeStore.getState().theme).toBe('dark')
    })

    it('toggles between dark and light', () => {
        useThemeStore.getState().toggleTheme()
        expect(useThemeStore.getState().theme).toBe('light')

        useThemeStore.getState().toggleTheme()
        expect(useThemeStore.getState().theme).toBe('dark')
    })

    it('sets an explicit theme', () => {
        useThemeStore.getState().setTheme('light')
        expect(useThemeStore.getState().theme).toBe('light')
    })
})