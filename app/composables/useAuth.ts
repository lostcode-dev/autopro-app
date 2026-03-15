export type AuthUser = {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
}

type AuthUserCookiePayload = {
  user: AuthUser
  expiresAt: number | null
  syncedAt: number
}

type AuthSession = {
  expiresAt: number | null
}

type AuthState = {
  user: AuthUser | null
  ready: boolean
}

const AUTH_REFRESH_BUFFER_MS = 60_000
const AUTH_COOKIE_REVALIDATE_MS = 5 * 60_000
const pendingFetchMap = new WeakMap<object, Promise<AuthUser | null>>()
const pendingEnsureMap = new WeakMap<object, Promise<void>>()

export function useAuth() {
  const requestFetch = useRequestFetch()
  const nuxtApp = useNuxtApp()
  const userCookie = useCookie<string | null>('sb-user', { default: () => null })
  const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const state = useState<AuthState>('auth', () => {
    const parsed = parseUserCookie()
    if (!parsed)
      return { user: null, ready: false }

    return { user: parsed.user, ready: true }
  })

  const user = computed(() => state.value.user)
  const ready = computed(() => state.value.ready)
  const isAuthenticated = computed(() => Boolean(state.value.user))

  function log(message: string, meta?: Record<string, unknown>) {
    console.log('[auth/useAuth]', message, {
      env: import.meta.server ? 'server' : 'client',
      ...meta
    })
  }

  function parseUserCookie(): AuthUserCookiePayload | null {
    const raw = userCookie.value
    if (!raw) {
      log('parseUserCookie:empty')
      return null
    }

    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as AuthUserCookiePayload
      log('parseUserCookie:success', {
        userId: parsed.user?.id ?? null,
        expiresAt: parsed.expiresAt,
        syncedAt: parsed.syncedAt
      })
      return parsed
    } catch (error: unknown) {
      const err = error as { message?: string }
      log('parseUserCookie:error', {
        message: err?.message ?? null,
        rawLength: raw.length,
        rawPreview: raw.slice(0, 80)
      })
      return null
    }
  }

  function setUserCookie(user: AuthUser, session: AuthSession | null = null) {
    const payload: AuthUserCookiePayload = {
      user,
      expiresAt: session?.expiresAt ?? null,
      syncedAt: Date.now()
    }

    userCookie.value = encodeURIComponent(JSON.stringify(payload))
  }

  function clearUserState() {
    state.value.user = null
    userCookie.value = null
  }

  async function fetchUser(): Promise<AuthUser | null> {
    const pendingFetch = pendingFetchMap.get(nuxtApp)
    if (pendingFetch) {
      log('fetchUser:reusing-pending-request')
      return pendingFetch
    }

    const request = (async () => {
      log('fetchUser:start', {
        hasStateUser: Boolean(state.value.user),
        hasCookie: Boolean(userCookie.value),
        hasRequestCookieHeader: Boolean(requestHeaders?.cookie)
      })

      try {
        const response = await requestFetch<{ user: AuthUser | null, session: AuthSession | null }>('/api/auth/me', {
          credentials: 'include',
          headers: requestHeaders
        })

        if (response.user)
          setUserCookie(response.user, response.session)
        else
          clearUserState()

        state.value.user = response.user
        state.value.ready = true
        log('fetchUser:success', {
          hasUser: Boolean(response.user),
          userId: response.user?.id ?? null,
          expiresAt: response.session?.expiresAt ?? null
        })
        return response.user
      } catch (error: unknown) {
        state.value.user = state.value.user ?? parseUserCookie()?.user ?? null
        state.value.ready = true
        if (!state.value.user)
          userCookie.value = null

        const err = error as { statusCode?: number, status?: number, message?: string }
        log('fetchUser:error', {
          statusCode: err?.statusCode ?? err?.status ?? null,
          message: err?.message ?? null,
          fallbackUserId: state.value.user?.id ?? null
        })

        return state.value.user
      } finally {
        pendingFetchMap.delete(nuxtApp)
      }
    })()

    pendingFetchMap.set(nuxtApp, request)
    return request
  }

  function isTokenExpired(): boolean {
    const parsed = parseUserCookie()
    if (!parsed)
      return true

    if (!parsed.expiresAt) {
      const expired = parsed.syncedAt <= Date.now() - AUTH_COOKIE_REVALIDATE_MS
      log('isTokenExpired:no-expiry', {
        syncedAt: parsed.syncedAt,
        expired
      })
      return expired
    }

    const expired = parsed.expiresAt * 1000 <= Date.now() + AUTH_REFRESH_BUFFER_MS
    log('isTokenExpired:with-expiry', {
      expiresAt: parsed.expiresAt,
      expired
    })
    return expired
  }

  async function ensureReady() {
    const pendingEnsure = pendingEnsureMap.get(nuxtApp)
    if (pendingEnsure) {
      log('ensureReady:reusing-pending-request')
      await pendingEnsure
      return
    }

    const request = (async () => {
      log('ensureReady:start', {
        ready: state.value.ready,
        hasStateUser: Boolean(state.value.user),
        hasCookie: Boolean(userCookie.value)
      })

      if (state.value.ready) {
        // Even when ready, proactively refresh if token is near expiry
        if (state.value.user && isTokenExpired()) {
          log('ensureReady:refreshing-ready-state', {
            userId: state.value.user.id
          })
          await fetchUser()
        }
        return
      }

      const parsed = parseUserCookie()
      if (parsed) {
        log('ensureReady:hydrated-from-cookie', {
          userId: parsed.user.id,
          expiresAt: parsed.expiresAt,
          syncedAt: parsed.syncedAt
        })
        state.value.user = parsed.user
        state.value.ready = true

        if (isTokenExpired())
          await fetchUser()

        return
      }

      await fetchUser()
    })().finally(() => {
      pendingEnsureMap.delete(nuxtApp)
    })

    pendingEnsureMap.set(nuxtApp, request)
    await request
  }

  async function login(payload: { email: string, password: string, remember?: boolean }) {
    log('login:start', {
      email: payload.email,
      remember: payload.remember ?? true
    })
    const response = await $fetch<{ user: AuthUser, session: AuthSession }>('/api/auth/login', {
      method: 'POST',
      body: payload,
      credentials: 'include'
    })

    setUserCookie(response.user, response.session)
    state.value.user = response.user
    state.value.ready = true
    log('login:success', {
      userId: response.user.id,
      expiresAt: response.session.expiresAt
    })
    return response.user
  }

  async function signup(payload: { name: string, email: string, password: string }) {
    const response = await $fetch<{ user: AuthUser | null, session: { expiresAt: number | null } | null }>('/api/auth/signup', {
      method: 'POST',
      body: payload,
      credentials: 'include'
    })

    if (response.session) {
      if (response.user)
        setUserCookie(response.user, response.session)

      state.value.user = response.user
      state.value.ready = true
    }

    return response
  }

  async function logout() {
    log('logout:start', {
      userId: state.value.user?.id ?? null
    })
    await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    state.value.user = null
    state.value.ready = true
    userCookie.value = null
    log('logout:success')
  }

  return {
    user,
    ready,
    isAuthenticated,
    fetchUser,
    ensureReady,
    login,
    signup,
    logout
  }
}
