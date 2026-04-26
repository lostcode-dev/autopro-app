export default defineNuxtPlugin((nuxtApp) => {
  const hash = window.location.hash
  if (!hash || !hash.includes('access_token=')) return

  const params = new URLSearchParams(hash.slice(1))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const type = params.get('type')

  if (!accessToken || !refreshToken) return
  if (type !== 'recovery' && type !== 'magiclink') return

  // Remove tokens from URL immediately to avoid exposure in history
  history.replaceState(null, '', window.location.pathname + window.location.search)

  if (type === 'recovery') {
    sessionStorage.setItem('sb-recovery-access-token', accessToken)
    sessionStorage.setItem('sb-recovery-refresh-token', refreshToken)

    nuxtApp.hook('app:mounted', async () => {
      const router = useRouter()
      await router.replace('/reset-password?mode=recovery')
    })
    return
  }

  // Magic link: set session via server (sets HTTP-only cookies), then navigate into the app
  nuxtApp.hook('app:mounted', async () => {
    const router = useRouter()
    try {
      await $fetch('/api/auth/set-session', {
        method: 'POST',
        body: { access_token: accessToken, refresh_token: refreshToken },
        credentials: 'include'
      })
      const { fetchUser } = useAuth()
      await fetchUser()
      await router.replace('/app')
    } catch {
      await router.replace('/login')
    }
  })
})
