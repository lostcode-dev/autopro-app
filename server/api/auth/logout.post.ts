import { clearAuthCookies } from '../../utils/auth-cookies'

export default eventHandler(async (event) => {
  clearAuthCookies(event)
  return { ok: true }
})
