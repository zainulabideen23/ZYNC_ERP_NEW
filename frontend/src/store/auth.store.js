import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            tenant: null,

            login: (userData, token, tenant = null) => {
                set({
                    user: userData,
                    token: token,
                    isAuthenticated: true,
                    tenant: tenant
                })
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    tenant: null
                })
            },

            markOnboarded: () => set((state) => ({
                tenant: { ...state.tenant, is_onboarded: true, onboarding_step: 6 }
            })),

            updateOnboardingStep: (step) => set((state) => ({
                tenant: { ...state.tenant, onboarding_step: step }
            })),

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
            partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated, tenant: state.tenant })
        }
    )
)
