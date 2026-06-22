// pavilion-web/src/lib/supabase.js

import { createClient } from '@supabase/supabase-js'

// ─── Env vars injected by Vite — fallback to hardcoded for safety ─────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://nqhhvataxjaecctvrrzc.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaGh2YXRheGphZWNjdHZycnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjQzMTUsImV4cCI6MjA4ODY0MDMxNX0.x6J_Ky43GdCpbrm9NeYqbJ3tKjWLr0vxHAkCgJqPQ0g'

// ─── Web client — detectSessionInUrl: true required for password reset tokens ─
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,
  },
})
