import { getSupabaseAnonClient } from './supabase-anon'
import { getAccessTokenFromCookies, getRefreshTokenFromCookies, setAuthCookies } from './auth-cookies'
import { getAuthUserCookie, setAuthUserCookie, toAuthUser } from './auth-user'
import { isInvalidAuthError, resolveSessionExpiresAt } from './auth-session'
import type { H3Event } from 'h3'

export async function requireAuthUser(event: H3Event) {
  const supabase = getSupabaseAnonClient()
  const accessToken = getAccessTokenFromCookies(event)
  const refreshToken = getRefreshTokenFromCookies(event)
  const existingUserCookie = getAuthUserCookie(event)
  let accessTokenError: { status?: unknown } | null = null

  console.log('[auth/require] start', {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken)
  })

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (!error && data.user) {
      const expiresAt = resolveSessionExpiresAt({
        accessToken,
        existingExpiresAt: existingUserCookie?.expiresAt
      })

      setAuthUserCookie(event, {
        user: toAuthUser(data.user),
        expiresAt,
        syncedAt: Date.now()
      })
      console.log('[auth/require] access-token-valid', {
        userId: data.user.id,
        expiresAt
      })
      return toAuthUser(data.user)
    }

    accessTokenError = error
    console.log('[auth/require] access-token-invalid', {
      status: typeof error?.status === 'number' ? error.status : null
    })
  }

  if (refreshToken) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    })

    if (refreshError && !isInvalidAuthError(refreshError)) {
      console.log('[auth/require] refresh-non-auth-error', {
        status: typeof refreshError.status === 'number' ? refreshError.status : null
      })
      throw createError({
        statusCode: 503,
        statusMessage: 'Auth service unavailable'
      })
    }

    if (!refreshError && refreshed.session) {
      const expiresAt = resolveSessionExpiresAt({
        accessToken: refreshed.session.access_token,
        sessionExpiresAt: refreshed.session.expires_at ?? null
      })

      const { data: userData, error: userError } = await supabase.auth.getUser(refreshed.session.access_token)
      if (userError && !isInvalidAuthError(userError)) {
        console.log('[auth/require] refreshed-user-fetch-non-auth-error', {
          status: typeof userError.status === 'number' ? userError.status : null
        })
        throw createError({
          statusCode: 503,
          statusMessage: 'Auth service unavailable'
        })
      }

      if (!userError && userData.user) {
        setAuthUserCookie(event, {
          user: toAuthUser(userData.user),
          expiresAt,
          syncedAt: Date.now()
        })
        setAuthCookies(event, refreshed.session)
        console.log('[auth/require] refresh-success', {
          userId: userData.user.id,
          expiresAt
        })
        return toAuthUser(userData.user)
      }

      console.log('[auth/require] refresh-returned-no-user', {
        hasUser: Boolean(userData.user),
        userErrorStatus: typeof userError?.status === 'number' ? userError.status : null
      })
    }
  }

  if (accessToken && accessTokenError && !isInvalidAuthError(accessTokenError)) {
    console.log('[auth/require] access-token-non-auth-error', {
      status: typeof accessTokenError.status === 'number' ? accessTokenError.status : null
    })
    throw createError({
      statusCode: 503,
      statusMessage: 'Auth service unavailable'
    })
  }

  console.log('[auth/require] unauthorized')

  throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized'
  })
}
