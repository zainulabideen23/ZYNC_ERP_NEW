import React from 'react'
import { ChevronDown } from 'lucide-react'

export default function Input({ 
  label, 
  variant = 'text', 
  className = '', 
  ...props 
}) {
  const baseInputClass = `w-full bg-[var(--surface-2)] border-[0.5px] border-[var(--border-2)] rounded-[var(--r6)] text-[var(--text)] text-[13px] placeholder-[rgba(122,135,153,0.5)] focus:border-[var(--blue)] focus:outline-none focus:ring-[3px] focus:ring-[var(--blue-dim)] transition-shadow ${className}`

  const renderInput = () => {
    switch (variant) {
      case 'textarea':
        return (
          <textarea 
            className={`${baseInputClass} p-[12px] resize-none min-h-[80px]`}
            {...props} 
          />
        )
      
      case 'select':
        return (
          <div className="relative">
            <select 
              className={`${baseInputClass} h-[36px] px-[12px] appearance-none pr-[36px]`}
              {...props}
            >
              {props.children}
            </select>
            <ChevronDown 
              size={15} 
              className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" 
            />
          </div>
        )

      case 'amount':
        return (
          <div className="relative flex items-center">
            <span className="absolute left-[10px] text-[12px] text-[var(--muted)] pointer-events-none">Rs.</span>
            <input 
              type="number"
              className={`${baseInputClass} h-[36px] pl-[36px] pr-[12px]`}
              {...props} 
            />
          </div>
        )
      
      case 'date':
        return (
          <input 
            type="date"
            className={`${baseInputClass} h-[36px] px-[12px] relative`}
            style={{ colorScheme: 'dark' }}
            {...props} 
          />
        )

      default:
        // text, number, email, etc.
        return (
          <input 
            type={variant === 'text' ? 'text' : props.type || 'text'}
            className={`${baseInputClass} h-[36px] px-[12px]`}
            {...props} 
          />
        )
    }
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[12px] text-[var(--muted)] mb-[5px]">
          {label}
        </label>
      )}
      {renderInput()}
    </div>
  )
}
