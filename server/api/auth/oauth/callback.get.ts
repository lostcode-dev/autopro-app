import { getQuery, getRequestURL, sendRedirect } from 'h3'
import { z } from 'zod'
import type { Session } from '@supabase/supabase-js'
import { clearOauthCodeVerifier, getOauthCodeVerifier } from '../../../utils/oauth-cookies'
import { setAuthCookies } from '../../../utils/auth-cookies'

const querySchema = z.object({
  code: z.string().min(1).optional(),
  error_description: z.string().optional(),
  error: z.string().optional()
})

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid callback'
    })
  }

  if (parsed.data.error || parsed.data.error_description) {
    clearOauthCodeVerifier(event)
    return sendRedirect(event, '/login', 302)
  }

  const code = parsed.data.code
  if (!code) {
    clearOauthCodeVerifier(event)
    return sendRedirect(event, '/login', 302)
  }

  const codeVerifier = getOauthCodeVerifier(event)
  clearOauthCodeVerifier(event)
  if (!codeVerifier)
    return sendRedirect(event, '/login', 302)

  const config = useRuntimeConfig()
  const supabaseUrl = config.supabaseUrl
  const supabaseAnonKey = config.supabaseAnonKey
  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured'
    })
  }

  const origin = getRequestURL(event).origin
  const redirectTo = `${origin}/api/auth/oauth/callback`

  const tokenUrl = new URL('/auth/v1/token', supabaseUrl)
  tokenUrl.searchParams.set('grant_type', 'pkce')

  const tokenResponse = await $fetch<TokenResponse>(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    },
    body: {
      auth_code: code,
      code_verifier: codeVerifier,
      redirect_to: redirectTo
    }
  }).catch((error: any) => {
    throw createError({
      statusCode: 400,
      statusMessage: error?.data?.msg || error?.data?.error_description || error?.message || 'OAuth exchange failed'
    })
  })

  const expiresAt = Math.floor(Date.now() / 1000) + tokenResponse.expires_in
  const session = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_in: tokenResponse.expires_in,
    expires_at: expiresAt,
    token_type: tokenResponse.token_type,
    user: null
  } as unknown as Session

  setAuthCookies(event, session)

  return sendRedirect(event, '/app', 302)
})
