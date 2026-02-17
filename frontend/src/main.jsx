import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './tokens.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <HashRouter>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#15202a',
                        color: '#E6EEF6',
                        border: '1px solid rgba(255,255,255,0.04)',
                    },
                }}
            />
        </HashRouter>
    </React.StrictMode>,
)
