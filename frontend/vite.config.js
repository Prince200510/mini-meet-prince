import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // This allows external access
    port: 5173,
    strictPort: true, // Fail if port is already in use
    open: false // Don't auto-open browser
  }
})
