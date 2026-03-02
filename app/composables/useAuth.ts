import type { User } from '@supabase/supabase-js'

type AuthState = {
  user: User | null
  ready: boolean
}

export function useAuth() {
  const state = useState<AuthState>('auth', () => ({ user: null, ready: false }))

  const user = computed(() => state.value.user)
  const ready = computed(() => state.value.ready)
  const isAuthenticated = computed(() => Boolean(state.value.user))

  async function fetchUser() {
    const response = await $fetch<{ user: User | null }>('/api/auth/me')
    state.value.user = response.user
    state.value.ready = true
    return response.user
  }

  async function ensureReady() {
    if (!state.value.ready)
      await fetchUser()
  }

  async function login(payload: { email: string, password: string }) {
    const response = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: payload
    })

    state.value.user = response.user
    state.value.ready = true
    return response.user
  }

  async function signup(payload: { name: string, email: string, password: string }) {
    const response = await $fetch<{ user: User | null, session: { expiresAt: number | null } | null }>('/api/auth/signup', {
      method: 'POST',
      body: payload
    })

    state.value.user = response.user
    state.value.ready = true
    return response
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    state.value.user = null
    state.value.ready = true
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
