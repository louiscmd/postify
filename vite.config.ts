import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = repo name so the build works on GitHub Pages (louiscmd.github.io/postify/)
export default defineConfig({
  plugins: [react()],
  base: '/postify/',
})
