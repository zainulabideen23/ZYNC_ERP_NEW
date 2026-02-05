/**
 * Simple event-based data synchronization utility
 * Allows components to notify others when data changes
 */

import { useEffect } from 'react'

const listeners = new Map()

export const DataSyncEvents = {
    SALE_CREATED: 'sale:created',
    SALE_UPDATED: 'sale:updated',
    SALE_DELETED: 'sale:deleted',
    PURCHASE_CREATED: 'purchase:created',
    PURCHASE_UPDATED: 'purchase:updated',
    PURCHASE_DELETED: 'purchase:deleted',
    PRODUCT_UPDATED: 'product:updated',
    CUSTOMER_UPDATED: 'customer:updated',
    SUPPLIER_UPDATED: 'supplier:updated',
    DASHBOARD_REFRESH: 'dashboard:refresh'
}

/**
 * Subscribe to a data sync event
 * @param {string} event - Event name from DataSyncEvents
 * @param {function} callback - Function to call when event fires
 * @returns {function} Unsubscribe function
 */
export function subscribe(event, callback) {
    if (!listeners.has(event)) {
        listeners.set(event, new Set())
    }
    listeners.get(event).add(callback)
    
    // Return unsubscribe function
    return () => {
        listeners.get(event)?.delete(callback)
    }
}

/**
 * Emit a data sync event
 * @param {string} event - Event name from DataSyncEvents
 * @param {any} data - Optional data to pass to listeners
 */
export function emit(event, data = null) {
    const eventListeners = listeners.get(event)
    if (eventListeners) {
        eventListeners.forEach(callback => {
            try {
                callback(data)
            } catch (error) {
                console.error(`Error in data sync listener for ${event}:`, error)
            }
        })
    }
}

/**
 * React hook for subscribing to data sync events
 * Automatically unsubscribes on unmount
 */
export function useDataSync(event, callback) {
    useEffect(() => {
        const unsubscribe = subscribe(event, callback)
        return unsubscribe
    }, [event, callback])
}
