import React from 'react'

export default function EmptyState({ icon: Icon, title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-[8px] p-[40px] w-full ${className}`}>
      {Icon && (
        <div className="w-[40px] h-[40px] bg-[var(--surface-2)] rounded-full flex items-center justify-center mb-1">
          <Icon size={20} className="text-[var(--muted)]" />
        </div>
      )}
      {title && (
        <div className="text-[14px] font-medium text-[var(--text)]">
          {title}
        </div>
      )}
      {subtitle && (
        <div className="text-[13px] text-[var(--muted)] text-center max-w-[280px]">
          {subtitle}
        </div>
      )}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}
