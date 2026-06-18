// pavilion-web/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Serve public/ as static root — htcc-logo.png lives at public/assets/images/
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
