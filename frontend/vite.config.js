import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/platform': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return

                    const normalized = id.replace(/\\/g, '/')

                    if (normalized.includes('/lucide-react/')) {
                        return 'vendor-icons'
                    }

                    if (normalized.includes('/@tanstack/')) {
                        return 'vendor-table'
                    }

                    if (
                        normalized.includes('/xlsx/') ||
                        normalized.includes('/jspdf/') ||
                        normalized.includes('/html2canvas/') ||
                        normalized.includes('/dompurify/')
                    ) {
                        return 'vendor-export'
                    }
                },
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test-setup.js',
    },
})
