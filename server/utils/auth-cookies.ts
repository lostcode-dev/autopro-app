import type { H3Event } from 'h3'
import type { Session } from '@supabase/supabase-js'

const ACCESS_TOKEN_COOKIE = 'sb-access-token'
const REFRESH_TOKEN_COOKIE = 'sb-refresh-token'

type CookieOptions = {
  secure?: boolean
}

function getBaseOptions(options?: CookieOptions) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: options?.secure ?? process.env.NODE_ENV === 'production',
    path: '/'
  }
}

export function setAuthCookies(event: H3Event, session: Session, options?: CookieOptions) {
  const base = getBaseOptions(options)

  setCookie(event, ACCESS_TOKEN_COOKIE, session.access_token, {
    ...base,
    maxAge: session.expires_in
  })

  setCookie(event, REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...base,
    maxAge: 60 * 60 * 24 * 365
  })
}

export function clearAuthCookies(event: H3Event, options?: CookieOptions) {
  const base = getBaseOptions(options)

  setCookie(event, ACCESS_TOKEN_COOKIE, '', { ...base, maxAge: 0 })
  setCookie(event, REFRESH_TOKEN_COOKIE, '', { ...base, maxAge: 0 })
}

export function getAccessTokenFromCookies(event: H3Event) {
  return getCookie(event, ACCESS_TOKEN_COOKIE)
}

export function getRefreshTokenFromCookies(event: H3Event) {
  return getCookie(event, REFRESH_TOKEN_COOKIE)
}
