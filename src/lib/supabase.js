// pavilion-web/src/lib/supabase.js

import { createClient } from '@supabase/supabase-js'

// ─── CONFIGURABLE: Supabase connection ────────────
// These values come from your .env.local file.
// Never hardcode keys here.
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// ─── Validate env vars are present ────────────────
if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    '[Pavilion] Missing Supabase environment variables.\n' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
  )
}

// ─── Create and export the Supabase client ────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Persist session in localStorage so users stay logged in
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})