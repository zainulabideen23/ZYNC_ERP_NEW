import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './tokens.css'
import './index.css'

// Read theme from localStorage (defaults to dark)
const savedTheme = localStorage.getItem('zync-theme')
let theme = 'dark'
try {
    if (savedTheme) {
        const parsed = JSON.parse(savedTheme)
        theme = parsed?.state?.theme || 'dark'
    }
} catch (e) {
    theme = 'dark'
}
document.documentElement.setAttribute('data-theme', theme)

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <HashRouter>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: 'var(--color-panel)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--border-surface)',
                        boxShadow: 'var(--elevation-2)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                    },
                }}
            />
        </HashRouter>
    </React.StrictMode>,
)
