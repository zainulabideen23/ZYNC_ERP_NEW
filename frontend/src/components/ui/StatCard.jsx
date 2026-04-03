import React from 'react'

const accentColors = {
  blue: {
    gradient: 'radial-gradient(circle at top right, rgba(37, 99, 235, 0.08) 0%, transparent 60%)',
    iconBg: 'var(--blue-dim)',
    iconColor: 'var(--blue)',
    valueColor: 'var(--color-text)'
  },
  purple: {
    gradient: 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.08) 0%, transparent 60%)',
    iconBg: 'var(--purple-dim)',
    iconColor: 'var(--purple)',
    valueColor: 'var(--color-text)'
  },
  emerald: {
    gradient: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
    iconBg: 'var(--green-dim)',
    iconColor: 'var(--green)',
    valueColor: 'var(--green)'
  },
  amber: {
    gradient: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.08) 0%, transparent 60%)',
    iconBg: 'var(--amber-dim)',
    iconColor: 'var(--amber)',
    valueColor: 'var(--amber)'
  },
  red: {
    gradient: 'radial-gradient(circle at top right, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
    iconBg: 'var(--red-dim)',
    iconColor: 'var(--red)',
    valueColor: 'var(--red)'
  },
  cyan: {
    gradient: 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.08) 0%, transparent 60%)',
    iconBg: 'var(--cyan-dim)',
    iconColor: 'var(--cyan)',
    valueColor: 'var(--cyan)'
  },
}

export default function StatCard({ 
  label, 
  value, 
  sublabel, 
  accentColor = 'blue', 
  icon: Icon, 
  trend,
  trendDirection = 'up',
  className = '' 
}) {
  const colors = accentColors[accentColor] || accentColors.blue

  return (
    <div 
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-panel)',
        border: '1px solid var(--border-surface)',
        padding: '20px',
        transition: 'all 0.3s ease',
        cursor: 'default'
      }}
      className={className}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--color-panel-3)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--elevation-2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-surface)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Decorative gradient */}
      <div style={{
        position: 'absolute',
        top: '-30px',
        right: '-30px',
        width: '120px',
        height: '120px',
        background: colors.gradient,
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {label}
          </span>
          {Icon && (
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: colors.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={18} color={colors.iconColor} />
            </div>
          )}
        </div>
        
        {/* Value */}
        <p style={{
          fontSize: '26px',
          fontWeight: 700,
          color: colors.valueColor,
          margin: 0,
          lineHeight: 1.2
        }}>
          {value}
        </p>
        
        {/* Sublabel and Trend */}
        {(sublabel || trend) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            {sublabel && (
              <span style={{ fontSize: '12px', color: 'var(--color-hint)' }}>{sublabel}</span>
            )}
            {trend && (
              <span style={{
                fontSize: '11px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                color: trendDirection === 'up' ? 'var(--green)' : 'var(--red)'
              }}>
                {trendDirection === 'up' ? '↑' : '↓'} {trend}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
