// pavilion-app/src/lib/supabase.js

// ─── URL polyfill required for Supabase in React Native ───────────────────────
import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// ─── Configurable: copy these from pavilion-web/src/lib/supabase.js ───────────
const SUPABASE_URL = 'https://nqhhvataxjaecctvrrzc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaGh2YXRheGphZWNjdHZycnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjQzMTUsImV4cCI6MjA4ODY0MDMxNX0.x6J_Ky43GdCpbrm9NeYqbJ3tKjWLr0vxHAkCgJqPQ0g'

// ─── Supabase client — uses AsyncStorage for session persistence on device ────
// detectSessionInUrl: false is required for React Native (no URL scheme parsing)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})