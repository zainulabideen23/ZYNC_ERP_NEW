import React from 'react'

const badgeStyles = {
  paid: { bg: 'var(--green-dim)', color: 'var(--green)', dot: 'var(--green)' },
  active: { bg: 'var(--green-dim)', color: 'var(--green)', dot: 'var(--green)' },
  confirmed: { bg: 'var(--green-dim)', color: 'var(--green)', dot: 'var(--green)' },
  cashier: { bg: 'var(--green-dim)', color: 'var(--green)', dot: 'var(--green)' },
  equity: { bg: 'var(--green-dim)', color: 'var(--green)', dot: 'var(--green)' },
  approve: { bg: 'var(--green-dim)', color: 'var(--green)', dot: 'var(--green)' },
  
  pending: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  billed: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  update: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  liability: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  
  overdue: { bg: 'var(--red-dim)', color: 'var(--red)', dot: 'var(--red)' },
  delete: { bg: 'var(--red-dim)', color: 'var(--red)', dot: 'var(--red)' },
  admin: { bg: 'var(--red-dim)', color: 'var(--red)', dot: 'var(--red)' },
  expense: { bg: 'var(--red-dim)', color: 'var(--red)', dot: 'var(--red)' },
  reject: { bg: 'var(--red-dim)', color: 'var(--red)', dot: 'var(--red)' },
  
  draft: { bg: 'var(--color-panel-2)', color: 'var(--color-muted)', dot: 'var(--color-muted)' },
  inactive: { bg: 'var(--color-panel-2)', color: 'var(--color-muted)', dot: 'var(--color-muted)' },
  login: { bg: 'var(--color-panel-2)', color: 'var(--color-muted)', dot: 'var(--color-muted)' },
  default: { bg: 'var(--color-panel-2)', color: 'var(--color-muted)', dot: 'var(--color-muted)' },
  
  sale: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  create: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  manager: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  asset: { bg: 'var(--blue-dim)', color: 'var(--blue)', dot: 'var(--blue)' },
  
  purchase: { bg: 'var(--purple-dim)', color: 'var(--purple)', dot: 'var(--purple)' },
  
  income: { bg: 'var(--cyan-dim)', color: 'var(--cyan)', dot: 'var(--cyan)' },
}

export default function Badge({ variant = 'default', children, className = '' }) {
  const style = badgeStyles[variant] || badgeStyles.default
  
  return (
    <span 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.color
      }}
      className={className}
    >
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: style.dot
      }} />
      {children}
    </span>
  )
}
