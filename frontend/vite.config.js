import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api calls to Flask during development, so no CORS setup is needed.
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})
