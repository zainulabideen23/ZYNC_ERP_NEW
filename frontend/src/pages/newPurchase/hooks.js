import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'

export function useDesktopCartDrawer() {
	const [isDesktopCart, setIsDesktopCart] = useState(() => (
		typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : true
	))
	const [cartOpen, setCartOpen] = useState(false)

	useEffect(() => {
		const media = window.matchMedia('(min-width: 1280px)')
		const updateDesktopState = (event) => {
			setIsDesktopCart(event.matches)
			if (event.matches) {
				setCartOpen(false)
			}
		}

		setIsDesktopCart(media.matches)
		media.addEventListener('change', updateDesktopState)
		return () => media.removeEventListener('change', updateDesktopState)
	}, [])

	const openCartDrawerIfNeeded = useCallback(() => {
		if (!isDesktopCart) setCartOpen(true)
	}, [isDesktopCart])

	return {
		isDesktopCart,
		cartOpen,
		setCartOpen,
		openCartDrawerIfNeeded,
		drawerOpen: !isDesktopCart && cartOpen,
	}
}

export function useFullscreenToggle() {
	const [isFullscreen, setIsFullscreen] = useState(() => (
		typeof document !== 'undefined' && Boolean(document.fullscreenElement)
	))

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(Boolean(document.fullscreenElement))
		}

		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
	}, [])

	const toggleFullscreen = useCallback(async () => {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen()
			} else {
				await document.exitFullscreen()
			}
		} catch {
			toast.error('Fullscreen is not available in this browser context')
		}
	}, [])

	return { isFullscreen, toggleFullscreen }
}

export function usePurchaseShortcuts({
	searchRef,
	handleCheckout,
	isDesktopCart,
	cartOpen,
	onCloseCart,
	onCloseBarcode,
}) {
	useEffect(() => {
		const handleShortcuts = (event) => {
			const targetTag = event.target?.tagName
			const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)

			if (event.key === '/' && !isTyping) {
				event.preventDefault()
				searchRef.current?.focus()
			}

			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault()
				handleCheckout()
			}

			if (event.key === 'Escape') {
				if (!isDesktopCart && cartOpen) {
					onCloseCart()
				}
				onCloseBarcode()
			}
		}

		window.addEventListener('keydown', handleShortcuts)
		return () => window.removeEventListener('keydown', handleShortcuts)
	}, [searchRef, handleCheckout, isDesktopCart, cartOpen, onCloseCart, onCloseBarcode])
}

export function useBarcodeScanner(processBarcode) {
	const scannerBufferRef = useRef('')
	const scannerTimerRef = useRef(null)

	useEffect(() => {
		const handleScannerInput = (event) => {
			const targetTag = event.target?.tagName
			const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)
			if (isTyping) return

			if (event.key === 'Enter') {
				if (scannerBufferRef.current.length >= 3) {
					processBarcode(scannerBufferRef.current)
				}
				scannerBufferRef.current = ''
				clearTimeout(scannerTimerRef.current)
				return
			}

			if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
				scannerBufferRef.current += event.key
				clearTimeout(scannerTimerRef.current)
				scannerTimerRef.current = setTimeout(() => {
					scannerBufferRef.current = ''
				}, 120)
			}
		}

		window.addEventListener('keydown', handleScannerInput)
		return () => {
			window.removeEventListener('keydown', handleScannerInput)
			clearTimeout(scannerTimerRef.current)
		}
	}, [processBarcode])
}