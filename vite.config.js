// pavilion-web/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  // ── Force Vite to pre-bundle tslib alongside Supabase ──
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      '@supabase/functions-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
      '@supabase/postgrest-js',
      '@supabase/auth-js',
      'tslib',
    ],
  },

  // ── Ensure tslib resolves correctly ──
  resolve: {
    dedupe: ['tslib'],
  },
})