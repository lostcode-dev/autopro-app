import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { getAccessTokenFromCookies, getRefreshTokenFromCookies, setAuthCookies } from '../../utils/auth-cookies'
import { getAuthUserCookie, setAuthUserCookie, toAuthUser } from '../../utils/auth-user'
import { clearAuthSession, isInvalidAuthError, resolveSessionExpiresAt } from '../../utils/auth-session'

export default eventHandler(async (event) => {
  const supabase = getSupabaseAnonClient()
  const accessToken = getAccessTokenFromCookies(event)
  const refreshToken = getRefreshTokenFromCookies(event)
  let accessTokenError: { status?: unknown } | null = null

  console.log('[auth/me] start', {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken)
  })

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (!error && data.user) {
      const existing = getAuthUserCookie(event)
      const expiresAt = resolveSessionExpiresAt({
        accessToken,
        existingExpiresAt: existing?.expiresAt
      })

      setAuthUserCookie(event, {
        user: toAuthUser(data.user),
        expiresAt,
        syncedAt: Date.now()
      })

      console.log('[auth/me] access-token-valid', {
        userId: data.user.id,
        expiresAt
      })

      return {
        user: toAuthUser(data.user),
        session: { expiresAt }
      }
    }

    accessTokenError = error
    console.log('[auth/me] access-token-invalid', {
      status: typeof error?.status === 'number' ? error.status : null
    })
  }

  if (!refreshToken) {
    if (accessToken && accessTokenError && !isInvalidAuthError(accessTokenError)) {
      console.log('[auth/me] auth-service-unavailable-without-refresh', {
        status: typeof accessTokenError.status === 'number' ? accessTokenError.status : null
      })
      throw createError({
        statusCode: 503,
        statusMessage: 'Auth service unavailable'
      })
    }

    console.log('[auth/me] no-refresh-token-clearing-session')
    clearAuthSession(event)
    return { user: null, session: null }
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken
  })

  if (refreshError && !isInvalidAuthError(refreshError)) {
    console.log('[auth/me] refresh-error-non-auth', {
      status: typeof refreshError.status === 'number' ? refreshError.status : null
    })
    throw createError({
      statusCode: 503,
      statusMessage: 'Auth service unavailable'
    })
  }

  if (refreshError || !refreshed.session) {
    console.log('[auth/me] refresh-failed-clearing-session', {
      status: typeof refreshError?.status === 'number' ? refreshError.status : null
    })
    clearAuthSession(event)
    return { user: null, session: null }
  }

  setAuthCookies(event, refreshed.session)
  const expiresAt = resolveSessionExpiresAt({
    accessToken: refreshed.session.access_token,
    sessionExpiresAt: refreshed.session.expires_at ?? null
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(refreshed.session.access_token)

  if (userError && !isInvalidAuthError(userError)) {
    console.log('[auth/me] refreshed-user-fetch-non-auth-error', {
      status: typeof userError.status === 'number' ? userError.status : null
    })
    throw createError({
      statusCode: 503,
      statusMessage: 'Auth service unavailable'
    })
  }

  if (userError) {
    console.log('[auth/me] refreshed-user-fetch-auth-error-clearing-session', {
      status: typeof userError.status === 'number' ? userError.status : null
    })
    clearAuthSession(event)
    return { user: null, session: null }
  }

  if (userData.user) {
    setAuthUserCookie(event, {
      user: toAuthUser(userData.user),
      expiresAt,
      syncedAt: Date.now()
    })

    console.log('[auth/me] refresh-success', {
      userId: userData.user.id,
      expiresAt
    })

    return {
      user: toAuthUser(userData.user),
      session: { expiresAt }
    }
  }

  console.log('[auth/me] refresh-returned-no-user-clearing-session')
  clearAuthSession(event)
  return { user: null, session: null }
})
