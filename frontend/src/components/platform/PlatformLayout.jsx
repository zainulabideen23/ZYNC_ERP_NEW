import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import PageTransition from '../PageTransition'
import { usePlatformAuthStore } from '../../store/platform.auth.store'
import { LayoutDashboard, Building2, Settings, LogOut, Shield } from 'lucide-react'

const sidebarItems = [
    { path: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/platform/clients', label: 'Clients', icon: Building2 },
    { path: '/platform/settings', label: 'Settings', icon: Settings },
]

export default function PlatformLayout() {
    const { platformAdmin, logout } = usePlatformAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/platform/login')
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
            {/* ─── Sidebar ─── */}
            <aside style={{
                width: 240,
                background: 'var(--color-panel)',
                borderRight: '1px solid var(--border-surface)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
            }}>
                {/* Brand */}
                <div style={{
                    padding: '24px 20px 20px',
                    borderBottom: '1px solid var(--border-surface)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Shield size={20} color="#fff" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)', letterSpacing: 0.3 }}>
                                ZYNC Platform
                            </div>
                            <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 500 }}>
                                Admin Panel
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav Items */}
                <nav style={{ flex: 1, padding: '16px 12px' }}>
                    {sidebarItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 14px',
                                borderRadius: 8,
                                marginBottom: 4,
                                fontSize: 14,
                                fontWeight: 500,
                                textDecoration: 'none',
                                color: isActive ? '#6366f1' : 'var(--color-muted)',
                                background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                                transition: 'all 0.15s ease',
                            })}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Admin Info */}
                <div style={{
                    padding: '16px',
                    borderTop: '1px solid var(--border-surface)',
                }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, marginBottom: 4 }}>
                        {platformAdmin?.fullName || 'Admin'}
                    </div>
                    <div style={{ fontSize: 11, color: '#818cf8', marginBottom: 12 }}>
                        {platformAdmin?.email || ''}
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#fca5a5', fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', width: '100%',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.2)'}
                        onMouseLeave={e => e.target.style.background = 'rgba(239,68,68,0.1)'}
                    >
                        <LogOut size={14} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* ─── Main Content ─── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Top Bar */}
                <header style={{
                    height: 56,
                    padding: '0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-surface)',
                    background: 'var(--color-panel)',
                    backdropFilter: 'blur(8px)',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', borderRadius: 6,
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                    }}>
                        <Shield size={14} color="#818cf8" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#a5b4fc', letterSpacing: 0.5 }}>
                            PLATFORM ADMIN
                        </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                        {platformAdmin?.email}
                    </div>
                </header>

                {/* Content */}
                <main style={{
                    flex: 1,
                    padding: 24,
                    overflowY: 'auto',
                }}>
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </main>
            </div>
        </div>
    )
}
