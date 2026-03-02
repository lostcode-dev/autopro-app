import { createClient } from '@supabase/supabase-js'

let supabaseAnonClient: ReturnType<typeof createClient> | undefined

export function getSupabaseAnonClient() {
  if (supabaseAnonClient)
    return supabaseAnonClient

  const config = useRuntimeConfig()
  const supabaseUrl = config.supabaseUrl
  const supabaseAnonKey = config.supabaseAnonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured',
      data: {
        missing: {
          SUPABASE_URL: !supabaseUrl,
          SUPABASE_ANON_KEY: !supabaseAnonKey
        }
      }
    })
  }

  supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  return supabaseAnonClient
}
