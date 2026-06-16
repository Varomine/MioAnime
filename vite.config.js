import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'nonexperimental-pseudofeverish-ouida.ngrok-free.dev'
    ],
    proxy: {
      '/onsen-api': {
        target: 'https://anime-onsen-api.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/onsen-api/, '')
      }
    }
  }
})