import { useState, useMemo, useRef, useEffect } from 'react'
import './pos.css'

/**
 * Searchable Customer Selector with dropdown
 * Supports keyboard navigation and phone number search
 */
export default function CustomerSelector({ 
    customers, 
    value, 
    onChange,
    customerName = null 
}) {
    const [search, setSearch] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const inputRef = useRef(null)
    const dropdownRef = useRef(null)

    const selected = customers.find(c => c.id === value)
    const displayName = selected?.name || customerName || ''

    const filtered = useMemo(() => {
        if (!search) return customers.slice(0, 10)
        const lowerSearch = search.toLowerCase()
        return customers.filter(c =>
            c.name.toLowerCase().includes(lowerSearch) ||
            c.phone_number?.includes(search)
        ).slice(0, 10)
    }, [customers, search])

    // Reset highlight when filtered list changes
    useEffect(() => {
        setHighlightedIndex(0)
    }, [filtered])

    const handleSelect = (customer) => {
        onChange(customer?.id || '', customer?.name || null)
        setSearch('')
        setIsOpen(false)
        inputRef.current?.blur()
    }

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true)
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev => Math.min(prev + 1, filtered.length))
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex === 0) {
                    handleSelect(null) // Walk-in
                } else {
                    handleSelect(filtered[highlightedIndex - 1])
                }
                break
            case 'Escape':
                setIsOpen(false)
                setSearch('')
                break
        }
    }

    const handleBlur = (e) => {
        // Delay closing to allow click on dropdown item
        setTimeout(() => {
            if (!dropdownRef.current?.contains(document.activeElement)) {
                setIsOpen(false)
                setSearch('')
            }
        }, 150)
    }

    return (
        <div className="customer-selector">
            <label className="customer-label">CUSTOMER</label>
            <div className="customer-input-wrapper">
                <span className="customer-icon">👤</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="customer-input"
                    placeholder={value ? displayName : 'Walk-in Customer'}
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setIsOpen(true)
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    aria-label="Search customers"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                />
                {value && (
                    <button
                        type="button"
                        className="customer-clear"
                        onClick={() => handleSelect(null)}
                        aria-label="Clear customer"
                    >
                        ✕
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="customer-dropdown" ref={dropdownRef} role="listbox">
                    <button
                        type="button"
                        className={`customer-option ${highlightedIndex === 0 ? 'highlighted' : ''} ${!value ? 'selected' : ''}`}
                        onClick={() => handleSelect(null)}
                        role="option"
                        aria-selected={!value}
                    >
                        <span className="option-icon">👤</span>
                        <span className="option-name">Walk-in Customer</span>
                    </button>
                    
                    {filtered.map((customer, idx) => (
                        <button
                            key={customer.id}
                            type="button"
                            className={`customer-option ${highlightedIndex === idx + 1 ? 'highlighted' : ''} ${value === customer.id ? 'selected' : ''}`}
                            onClick={() => handleSelect(customer)}
                            role="option"
                            aria-selected={value === customer.id}
                        >
                            <span className="option-name">{customer.name}</span>
                            {customer.phone_number && (
                                <span className="option-phone">{customer.phone_number}</span>
                            )}
                        </button>
                    ))}

                    {filtered.length === 0 && search && (
                        <div className="customer-no-results">
                            No customers found
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
