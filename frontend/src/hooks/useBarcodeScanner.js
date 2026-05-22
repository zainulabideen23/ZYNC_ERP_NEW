import { useEffect, useRef } from 'react'

export function useBarcodeScanner(onBarcode) {
    const bufferRef = useRef('')
    const timerRef = useRef(null)
    const justScannedRef = useRef(false)

    useEffect(() => {
        const handleKey = (e) => {
            const tag = e.target?.tagName

            if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag)) {
                if (e.key === 'Enter' && justScannedRef.current) {
                    e.preventDefault()
                }
                return
            }

            if (e.key === 'Enter') {
                e.preventDefault()
                if (bufferRef.current.length >= 3) {
                    justScannedRef.current = true
                    setTimeout(() => { justScannedRef.current = false }, 300)
                    onBarcode(bufferRef.current)
                }
                bufferRef.current = ''
                clearTimeout(timerRef.current)
                return
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                bufferRef.current += e.key
                clearTimeout(timerRef.current)
                timerRef.current = setTimeout(() => { bufferRef.current = '' }, 120)
            }
        }

        window.addEventListener('keydown', handleKey)
        return () => {
            window.removeEventListener('keydown', handleKey)
            clearTimeout(timerRef.current)
        }
    }, [onBarcode])
}
