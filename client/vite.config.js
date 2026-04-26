import { defineConfig } from 'vite'

// Vite dev server proxies /upload to the backend running on port 3000
export default defineConfig({
  server: {
    proxy: {
      '/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
