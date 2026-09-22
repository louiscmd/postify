import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the same build works at a domain root (Vercel) and under a
// sub-path (GitHub Pages: louiscmd.github.io/postify/). The app has no routes.
export default defineConfig({
  plugins: [react()],
  base: './',
})
