import React from 'react'
import { Loader2 } from 'lucide-react'

export default function Button({ 
  variant = 'primary', 
  size = 'default', 
  loading = false, 
  icon: Icon, 
  children, 
  disabled, 
  iconOnly = false,
  className = '',
  ...props 
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          hoverBg: 'var(--color-accent-hover)',
          shadow: '0 2px 8px rgba(5, 153, 105, 0.25)'
        }
      case 'secondary':
        return {
          background: 'transparent',
          color: 'var(--color-text)',
          border: '1px solid var(--border-surface)',
          hoverBg: 'var(--color-panel-2)',
          shadow: 'none'
        }
      case 'danger':
        return {
          background: 'var(--red-dim)',
          color: 'var(--red)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          hoverBg: 'rgba(239, 68, 68, 0.2)',
          shadow: 'none'
        }
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--color-muted)',
          border: 'none',
          hoverBg: 'var(--color-panel-2)',
          shadow: 'none'
        }
      default:
        return {
          background: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          hoverBg: 'var(--color-accent-hover)',
          shadow: 'none'
        }
    }
  }

  const getSizeStyles = () => {
    if (iconOnly) {
      return { width: '36px', height: '36px', padding: '0', fontSize: '14px' }
    }
    switch (size) {
      case 'xs':
        return { height: '28px', padding: '0 10px', fontSize: '12px', gap: '4px' }
      case 'sm':
        return { height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px' }
      case 'lg':
        return { height: '44px', padding: '0 20px', fontSize: '15px', gap: '8px' }
      default:
        return { height: '38px', padding: '0 16px', fontSize: '14px', gap: '8px' }
    }
  }

  const variantStyles = getVariantStyles()
  const sizeStyles = getSizeStyles()

  return (
    <button 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        borderRadius: 'var(--radius-md)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.5 : 1,
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
        ...sizeStyles,
        ...variantStyles,
        boxShadow: variantStyles.shadow
      }}
      className={className}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
      ) : Icon ? (
        <Icon size={16} style={{ marginRight: children ? '6px' : '0' }} />
      ) : null}
      {children}
    </button>
  )
}
