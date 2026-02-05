import { useEffect, useRef, useState } from 'react'

/**
 * Barcode Scanner Input Component
 * Detects barcode scanner input (fast typing ending with Enter)
 * Also provides manual barcode entry field
 */
export default function BarcodeInput({ onScan, products, isActive = true }) {
    const [buffer, setBuffer] = useState('')
    const [showManual, setShowManual] = useState(false)
    const [manualCode, setManualCode] = useState('')
    const timeoutRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        if (!isActive) return

        const handleKeyPress = (e) => {
            // Ignore if typing in an input field
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                return
            }

            // Barcode scanners type fast and end with Enter
            if (e.key === 'Enter' && buffer.length >= 3) {
                e.preventDefault()
                handleScan(buffer)
                setBuffer('')
                return
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                setBuffer(prev => prev + e.key)

                // Reset buffer after 100ms of no input (scanners are faster)
                clearTimeout(timeoutRef.current)
                timeoutRef.current = setTimeout(() => setBuffer(''), 100)
            }
        }

        window.addEventListener('keypress', handleKeyPress)
        return () => {
            window.removeEventListener('keypress', handleKeyPress)
            clearTimeout(timeoutRef.current)
        }
    }, [buffer, isActive, products])

    const handleScan = (code) => {
        // Find product by barcode or product code
        const product = products.find(p => 
            p.barcode === code || 
            p.code?.toUpperCase() === code.toUpperCase()
        )

        if (product) {
            onScan(product, code)
        } else {
            onScan(null, code) // Let parent handle not found
        }
    }

    const handleManualSubmit = (e) => {
        e.preventDefault()
        if (manualCode.trim()) {
            handleScan(manualCode.trim())
            setManualCode('')
            setShowManual(false)
        }
    }

    // Toggle manual entry with keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                setShowManual(prev => !prev)
                setTimeout(() => inputRef.current?.focus(), 50)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    if (!showManual) {
        return (
            <button
                type="button"
                className="barcode-toggle"
                onClick={() => {
                    setShowManual(true)
                    setTimeout(() => inputRef.current?.focus(), 50)
                }}
                title="Enter barcode manually (Ctrl+B)"
            >
                ⌨️ Barcode
            </button>
        )
    }

    return (
        <form className="barcode-input-form" onSubmit={handleManualSubmit}>
            <input
                ref={inputRef}
                type="text"
                className="barcode-input"
                placeholder="Scan or type barcode..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onBlur={() => {
                    if (!manualCode) setShowManual(false)
                }}
                autoFocus
            />
            <button type="submit" className="barcode-submit">
                ⏎
            </button>
        </form>
    )
}
