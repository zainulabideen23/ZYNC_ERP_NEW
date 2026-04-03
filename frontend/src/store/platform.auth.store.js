import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePlatformAuthStore = create(
    persist(
        (set, get) => ({
            platformAdmin: null,
            platformToken: null,
            isAuthenticated: false,

            login: (adminData, token) => {
                set({
                    platformAdmin: adminData,
                    platformToken: token,
                    isAuthenticated: true
                })
            },

            logout: () => {
                set({
                    platformAdmin: null,
                    platformToken: null,
                    isAuthenticated: false
                })
                window.location.hash = '#/platform/login'
            },

            getToken: () => get().platformToken
        }),
        {
            name: 'zync-platform-auth',
            partialize: (state) => ({
                platformAdmin: state.platformAdmin,
                platformToken: state.platformToken,
                isAuthenticated: state.isAuthenticated
            })
        }
    )
)
