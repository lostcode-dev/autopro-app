import { clearAuthCookies } from '../../utils/auth-cookies'
import { clearAuthUserCookie } from '../../utils/auth-user'

export default eventHandler(async (event) => {
  console.log('[auth/logout] clearing-session')
  clearAuthCookies(event)
  clearAuthUserCookie(event)
  return { ok: true }
})
