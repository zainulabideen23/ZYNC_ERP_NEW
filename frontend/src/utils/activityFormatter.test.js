import { afterEach, describe, expect, it, vi } from 'vitest'
import { Activity, LogIn, Receipt } from 'lucide-react'
import {
    formatActivity,
    getActionColor,
    getActionIcon,
    getActivityIcon,
    timeAgo,
    formatIP,
} from './activityFormatter'

describe('activityFormatter utility', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('formats mapped activity templates with amount metadata', () => {
        const result = formatActivity({
            action: 'create',
            table_name: 'sales',
            new_values: { invoice_number: 'INV-1', total_amount: 1500 },
        })

        expect(result).toEqual({
            text: 'created Invoice INV-1',
            amount: 1500,
            amountType: 'positive',
        })
    })

    it('returns fallback message for unmapped action/table', () => {
        expect(formatActivity({ action: 'archive', table_name: 'widgets' })).toEqual({
            text: 'archive on widgets',
        })
    })

    it('returns action color tokens and default fallback', () => {
        expect(getActionColor('create')).toBe('bg-green-500')
        expect(getActionColor('login_failed')).toBe('bg-red-600')
        expect(getActionColor('unknown')).toBe('bg-slate-500')
    })

    it('returns icon components and legacy icon names correctly', () => {
        expect(getActivityIcon('create', 'sales')).toBe(Receipt)
        expect(getActivityIcon('login', 'users')).toBe(LogIn)
        expect(getActivityIcon('other', 'unknown')).toBe(Activity)

        expect(getActionIcon('create', 'sales')).toBe('Receipt')
        expect(getActionIcon('login_failed', 'users')).toBe('LogIn')
        expect(getActionIcon('other', 'unknown')).toBe('Activity')
    })

    it('builds relative time strings', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-04T12:00:00.000Z'))

        expect(timeAgo('2026-04-04T11:59:45.000Z')).toBe('just now')
        expect(timeAgo('2026-04-04T11:50:00.000Z')).toBe('10 minutes ago')
        expect(timeAgo('2026-04-04T10:00:00.000Z')).toBe('about 2 hours ago')
        expect(timeAgo('2026-04-02T12:00:00.000Z')).toBe('2 days ago')
    })

    it('formats localhost and empty IP values for display', () => {
        expect(formatIP('::1')).toBe('localhost')
        expect(formatIP('127.0.0.1')).toBe('localhost')
        expect(formatIP('::ffff:127.0.0.1')).toBe('localhost')
        expect(formatIP('10.0.0.42')).toBe('10.0.0.42')
        expect(formatIP('')).toBe('—')
    })
})