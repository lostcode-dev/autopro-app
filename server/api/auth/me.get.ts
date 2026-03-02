import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { getAccessTokenFromCookies, getRefreshTokenFromCookies, setAuthCookies } from '../../utils/auth-cookies'

export default eventHandler(async (event) => {
  const supabase = getSupabaseAnonClient()
  const accessToken = getAccessTokenFromCookies(event)
  const refreshToken = getRefreshTokenFromCookies(event)

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (!error)
      return { user: data.user }
  }

  if (!refreshToken)
    return { user: null }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken
  })

  if (refreshError || !refreshed.session)
    return { user: null }

  setAuthCookies(event, refreshed.session)

  const { data: userData, error: userError } = await supabase.auth.getUser(refreshed.session.access_token)

  if (userError)
    return { user: null }

  return { user: userData.user }
})
