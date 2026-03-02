import { getSupabaseAnonClient } from './supabase-anon'
import { getAccessTokenFromCookies, getRefreshTokenFromCookies, setAuthCookies } from './auth-cookies'
import { setAuthUserCookie, toAuthUser } from './auth-user'
import type { H3Event } from 'h3'

export async function requireAuthUser(event: H3Event) {
  const supabase = getSupabaseAnonClient()
  const accessToken = getAccessTokenFromCookies(event)

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (!error && data.user) {
      setAuthUserCookie(event, {
        user: toAuthUser(data.user),
        expiresAt: null,
        syncedAt: Date.now()
      })
      return toAuthUser(data.user)
    }
  }

  const refreshToken = getRefreshTokenFromCookies(event)
  if (refreshToken) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    })

    if (!refreshError && refreshed.session) {
      setAuthCookies(event, refreshed.session)

      const { data: userData, error: userError } = await supabase.auth.getUser(refreshed.session.access_token)
      if (!userError && userData.user) {
        setAuthUserCookie(event, {
          user: toAuthUser(userData.user),
          expiresAt: refreshed.session.expires_at ?? null,
          syncedAt: Date.now()
        })
        return toAuthUser(userData.user)
      }
    }
  }

  throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized'
  })
}

