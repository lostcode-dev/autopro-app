import { getQuery, getRequestURL, sendRedirect } from 'h3'
import { z } from 'zod'
import { createPkcePair } from '../../../utils/pkce'
import { setOauthCodeVerifier } from '../../../utils/oauth-cookies'

const querySchema = z.object({
  provider: z.enum(['google', 'github'])
})

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid provider'
    })
  }

  const { provider } = parsed.data
  const { codeVerifier, codeChallenge, codeChallengeMethod } = createPkcePair()
  setOauthCodeVerifier(event, codeVerifier)

  const { supabaseUrl } = useRuntimeConfig()
  if (!supabaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured'
    })
  }

  const origin = getRequestURL(event).origin
  const redirectTo = `${origin}/api/auth/oauth/callback`

  const url = new URL('/auth/v1/authorize', supabaseUrl)
  url.searchParams.set('provider', provider)
  url.searchParams.set('redirect_to', redirectTo)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', codeChallengeMethod)

  return sendRedirect(event, url.toString(), 302)
})
