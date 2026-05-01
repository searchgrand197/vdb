import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@admin': fileURLToPath(new URL('./src/adminPortal', import.meta.url)),
      'react-hot-toast': fileURLToPath(new URL('./src/shims/reactHotToast.jsx', import.meta.url)),
      'lucide-react': fileURLToPath(new URL('./src/shims/lucideReact.jsx', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/template': 'http://127.0.0.1:8000',
    },
  },
})
