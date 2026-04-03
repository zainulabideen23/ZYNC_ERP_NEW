import React from 'react'
import { Search, X, Download } from 'lucide-react'

export default function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  
  statusValue,
  onStatusChange,
  statusOptions = [],
  
  showDateRange = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,

  onClear,
  hasActiveFilters = false,

  onExport
}) {
  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--color-panel)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px'
      }}
    >
      {/* Search */}
      {onSearchChange !== undefined && (
        <div style={{ position: 'relative', flex: '1', maxWidth: '260px' }}>
          <Search 
            size={16} 
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-muted)',
              pointerEvents: 'none'
            }} 
          />
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              background: 'var(--color-panel-2)',
              border: '1px solid var(--border-surface)',
              borderRadius: 'var(--radius-md)',
              paddingLeft: '40px',
              paddingRight: '12px',
              fontSize: '14px',
              color: 'var(--color-text)',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--blue)'
              e.target.style.background = 'var(--color-panel)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border-surface)'
              e.target.style.background = 'var(--color-panel-2)'
            }}
          />
        </div>
      )}

      {/* Status Select */}
      {statusOptions.length > 0 && onStatusChange !== undefined && (
        <div style={{ position: 'relative' }}>
          <select 
            value={statusValue || ''}
            onChange={(e) => onStatusChange(e.target.value)}
            style={{
              height: '40px',
              background: 'var(--color-panel-2)',
              border: '1px solid var(--border-surface)',
              borderRadius: 'var(--radius-md)',
              paddingLeft: '12px',
              paddingRight: '32px',
              fontSize: '14px',
              color: 'var(--color-text)',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--blue)'
              e.target.style.background = 'var(--color-panel)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border-surface)'
              e.target.style.background = 'var(--color-panel-2)'
            }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <svg 
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-muted)',
              pointerEvents: 'none'
            }}
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      )}

      {/* Date Range */}
      {showDateRange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="date"
            value={startDate || ''}
            onChange={(e) => onStartDateChange && onStartDateChange(e.target.value)}
            style={{
              height: '40px',
              background: 'var(--color-panel-2)',
              border: '1px solid var(--border-surface)',
              borderRadius: 'var(--radius-md)',
              paddingLeft: '12px',
              paddingRight: '12px',
              fontSize: '14px',
              color: 'var(--color-text)',
              outline: 'none',
              transition: 'all 0.2s',
              colorScheme: 'dark'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
          />
          <span style={{ color: 'var(--color-hint)', fontSize: '13px' }}>to</span>
          <input 
            type="date"
            value={endDate || ''}
            onChange={(e) => onEndDateChange && onEndDateChange(e.target.value)}
            style={{
              height: '40px',
              background: 'var(--color-panel-2)',
              border: '1px solid var(--border-surface)',
              borderRadius: 'var(--radius-md)',
              paddingLeft: '12px',
              paddingRight: '12px',
              fontSize: '14px',
              color: 'var(--color-text)',
              outline: 'none',
              transition: 'all 0.2s',
              colorScheme: 'dark'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-surface)'}
          />
        </div>
      )}

      {/* Clear */}
      {hasActiveFilters && onClear && (
        <button 
          onClick={onClear}
          style={{
            height: '40px',
            padding: '0 12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-muted)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.target.style.background = 'var(--color-panel-2)'
            e.target.style.color = 'var(--color-text)'
          }}
          onMouseLeave={e => {
            e.target.style.background = 'transparent'
            e.target.style.color = 'var(--color-muted)'
          }}
        >
          <X size={14} />
          Clear
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Export */}
      {onExport && (
        <button 
          onClick={onExport}
          style={{
            height: '40px',
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-surface)',
            background: 'transparent',
            color: 'var(--color-muted)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.target.style.background = 'var(--color-panel-2)'
            e.target.style.borderColor = 'var(--color-panel-3)'
            e.target.style.color = 'var(--color-text)'
          }}
          onMouseLeave={e => {
            e.target.style.background = 'transparent'
            e.target.style.borderColor = 'var(--border-surface)'
            e.target.style.color = 'var(--color-muted)'
          }}
        >
          <Download size={15} />
          Export
        </button>
      )}
    </div>
  )
}
