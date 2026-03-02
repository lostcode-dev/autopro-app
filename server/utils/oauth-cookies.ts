import type { H3Event } from 'h3'

const OAUTH_CODE_VERIFIER_COOKIE = 'sb-oauth-code-verifier'

function getBaseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/oauth/callback'
  }
}

export function setOauthCodeVerifier(event: H3Event, codeVerifier: string) {
  setCookie(event, OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, {
    ...getBaseOptions(),
    maxAge: 60 * 10
  })
}

export function getOauthCodeVerifier(event: H3Event) {
  return getCookie(event, OAUTH_CODE_VERIFIER_COOKIE)
}

export function clearOauthCodeVerifier(event: H3Event) {
  setCookie(event, OAUTH_CODE_VERIFIER_COOKIE, '', {
    ...getBaseOptions(),
    maxAge: 0
  })
}
