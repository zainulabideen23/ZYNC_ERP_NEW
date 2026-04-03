import React from 'react'

export function Table({ children, className = '' }) {
  return (
    <div className={`bg-[var(--color-panel)] rounded-[var(--radius-lg)] border border-[var(--border-surface)] overflow-hidden ${className}`}>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          {children}
        </table>
      </div>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead className="border-b border-[var(--border-surface)] bg-[var(--color-panel-2)]">
      {children}
    </thead>
  )
}

export function Tbody({ children }) {
  return (
    <tbody className="divide-y divide-[var(--border-light)]">
      {children}
    </tbody>
  )
}

export function Tr({ children, onClick, className = '' }) {
  const isClickable = !!onClick
  return (
    <tr 
      onClick={onClick}
      className={`${isClickable ? 'cursor-pointer' : ''} hover:bg-[var(--color-panel-2)] transition-colors duration-150 ${className}`}
    >
      {children}
    </tr>
  )
}

export function Th({ children, className = '', style = {} }) {
  return (
    <th 
      style={style}
      className={`text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-[0.04em] py-[12px] px-[16px] whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', style = {} }) {
  return (
    <td 
      style={style}
      className={`text-[13px] text-[var(--color-text)] py-[12px] px-[16px] whitespace-nowrap ${className}`}
    >
      {children}
    </td>
  )
}

export function TFoot({ children }) {
  return (
    <tfoot className="border-t border-[var(--border-surface)] font-bold bg-[var(--color-panel-2)]">
      {children}
    </tfoot>
  )
}

export function TablePagination({ totalDocs, limit, page, setPage }) {
  if (!totalDocs || totalDocs === 0) return null
  
  const totalPages = Math.ceil(totalDocs / limit)
  if (totalPages <= 1) return null
  
  const start = ((page - 1) * limit) + 1
  const end = Math.min(page * limit, totalDocs)

  return (
    <div className="flex items-center justify-between py-[12px] px-[16px] border-t border-[var(--border-surface)] bg-[var(--color-panel-2)]">
      <div className="text-[12px] text-[var(--color-hint)]">
        Showing {start}–{end} of {totalDocs}
      </div>
      <div className="flex items-center gap-1">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="w-[32px] h-[32px] rounded-[var(--radius-md)] bg-transparent border border-[var(--border-surface)] text-[var(--color-muted)] flex items-center justify-center hover:bg-[var(--color-panel-3)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
        >
          &lt;
        </button>
        <span className="px-3 text-[13px] text-[var(--color-text-dim)]">
          {page}
        </span>
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="w-[32px] h-[32px] rounded-[var(--radius-md)] bg-transparent border border-[var(--border-surface)] text-[var(--color-muted)] flex items-center justify-center hover:bg-[var(--color-panel-3)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
        >
          &gt;
        </button>
      </div>
    </div>
  )
}
