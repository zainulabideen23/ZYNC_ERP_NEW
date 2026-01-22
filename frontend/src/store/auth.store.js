import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: (userData, token) => {
                set({
                    user: userData,
                    token: token,
                    isAuthenticated: true
                })
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false
                })
            },

            getToken: () => get().token,

            hasRole: (roles) => {
                const user = get().user
                if (!user) return false
                if (typeof roles === 'string') return user.role === roles
                return roles.includes(user.role)
            }
        }),
        {
            name: 'zync-auth',
            partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated })
        }
    )
)
