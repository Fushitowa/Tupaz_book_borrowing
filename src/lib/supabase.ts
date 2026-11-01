import { createClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  projectUrl && publicKey && !projectUrl.includes('your-project')
    ? createClient(projectUrl, publicKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

export const isSupabaseConfigured = supabase !== null
