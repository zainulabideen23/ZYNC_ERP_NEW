import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Shield, User, KeyRound, Save, Loader2 } from 'lucide-react'
import { platformAuthAPI } from '../../services/platform.api'
import { usePlatformAuthStore } from '../../store/platform.auth.store'

export default function PlatformSettings() {
    const { platformAdmin } = usePlatformAuthStore()

    const [profile, setProfile] = useState(platformAdmin || null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [saving, setSaving] = useState(false)

    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await platformAuthAPI.me()
                if (res?.data) {
                    setProfile(res.data)
                }
            } catch (error) {
                toast.error('Failed to load platform profile')
            } finally {
                setLoadingProfile(false)
            }
        }

        loadProfile()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!oldPassword || !newPassword || !confirmPassword) {
            toast.error('All password fields are required')
            return
        }

        if (newPassword.length < 8) {
            toast.error('New password must be at least 8 characters')
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error('New password and confirmation do not match')
            return
        }

        try {
            setSaving(true)
            await platformAuthAPI.changePassword(oldPassword, newPassword)
            setOldPassword('')
            setNewPassword('')
            setConfirmPassword('')
            toast.success('Password changed successfully')
        } catch (error) {
            toast.error(error.message || 'Failed to change password')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ display: 'grid', gap: 20, maxWidth: 760 }}>
            <div style={{
                padding: 20,
                borderRadius: 12,
                background: 'var(--color-panel)',
                border: '1px solid var(--border-surface)',
            }}>
                <h1 style={{ margin: 0, fontSize: 22, color: 'var(--color-text)' }}>Platform Settings</h1>
                <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--color-muted)', fontSize: 13 }}>
                    Manage your platform admin profile and security settings.
                </p>
            </div>

            <div style={{
                padding: 20,
                borderRadius: 12,
                background: 'var(--color-panel)',
                border: '1px solid var(--border-surface)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Shield size={16} color="#c084fc" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Platform Info</span>
                </div>

                {loadingProfile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-muted)' }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        Loading profile...
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <ReadOnlyField label="Platform Name" value="ZYNC Platform Admin" icon={<Shield size={14} />} />
                        <ReadOnlyField label="Admin Name" value={profile?.fullName || platformAdmin?.fullName || 'N/A'} icon={<User size={14} />} />
                        <ReadOnlyField label="Admin Email" value={profile?.email || platformAdmin?.email || 'N/A'} icon={<User size={14} />} />
                    </div>
                )}
            </div>

            <form
                onSubmit={handleSubmit}
                style={{
                    padding: 20,
                    borderRadius: 12,
                    background: 'var(--color-panel)',
                    border: '1px solid var(--border-surface)',
                    display: 'grid',
                    gap: 12,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <KeyRound size={16} color="#c084fc" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Change Password</span>
                </div>

                <PasswordField
                    label="Current Password"
                    value={oldPassword}
                    onChange={setOldPassword}
                    placeholder="Enter current password"
                />

                <PasswordField
                    label="New Password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Minimum 8 characters"
                />

                <PasswordField
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Re-enter new password"
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            borderRadius: 8,
                            border: 'none',
                            background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #0891B2, #0891B2)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                        {saving ? 'Saving...' : 'Update Password'}
                    </button>
                </div>
            </form>
        </div>
    )
}

function ReadOnlyField({ label, value, icon }) {
    return (
        <div style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border-surface)',
            background: 'var(--color-bg)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--color-muted)', fontSize: 12 }}>
                {icon}
                {label}
            </div>
            <div style={{ color: 'var(--color-text)', fontSize: 14, fontWeight: 500 }}>
                {value}
            </div>
        </div>
    )
}

function PasswordField({ label, value, onChange, placeholder }) {
    return (
        <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--color-muted)', fontSize: 12, fontWeight: 600 }}>{label}</span>
            <input
                type="password"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-surface)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    outline: 'none',
                }}
            />
        </label>
    )
}
