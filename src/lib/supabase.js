// pavilion-web/src/lib/supabase.js

import { createClient } from '@supabase/supabase-js'

// ─── Env vars injected by Vite at build time ──────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ─── Web client — detectSessionInUrl: true required for password reset tokens ─
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,
  },
})
