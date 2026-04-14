import type { PermissionMap, WorkshopBootstrapResponse } from '~/types/workshop'

type WorkshopBootstrapState = {
  data: WorkshopBootstrapResponse | null
  ready: boolean
  pending: boolean
  errorMessage: string | null
}

let pendingWorkshopBootstrap: Promise<WorkshopBootstrapResponse | null> | null = null

function getEmptyPermissions(): PermissionMap {
  return {}
}

export function useWorkshopBootstrap() {
  const auth = useAuth()
  const requestFetch = useRequestFetch()
  const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const state = useState<WorkshopBootstrapState>('workshop-bootstrap', () => ({
    data: null,
    ready: false,
    pending: false,
    errorMessage: null
  }))

  const data = computed(() => state.value.data)
  const currentUser = computed(() => data.value?.currentUser ?? null)
  const organization = computed(() => data.value?.organization ?? null)
  const userRole = computed(() => data.value?.userRole ?? null)
  const employee = computed(() => data.value?.employee ?? null)
  const roles = computed(() => data.value?.roles ?? [])
  const actions = computed(() => data.value?.actions ?? [])
  const roleActions = computed(() => data.value?.roleActions ?? [])
  const permissions = computed<PermissionMap>(() => data.value?.permissions ?? getEmptyPermissions())
  const organizationId = computed(() => data.value?.organizationId ?? currentUser.value?.organization_id ?? null)
  const isOwner = computed(() => data.value?.isOwner === true)
  const isAdmin = computed(() => data.value?.isAdmin === true)
  const isOnboardingComplete = computed(() => data.value?.onboardingCompleted === true)
  const terminated = computed(() => data.value?.terminated === true)
  const ready = computed(() => state.value.ready)
  const pending = computed(() => state.value.pending)
  const errorMessage = computed(() => state.value.errorMessage)

  function clear() {
    state.value = {
      data: null,
      ready: true,
      pending: false,
      errorMessage: null
    }
  }

  async function fetchBootstrap(force = false) {
    if (!auth.isAuthenticated.value) {
      clear()
      return null
    }

    if (!force && pendingWorkshopBootstrap)
      return pendingWorkshopBootstrap

    pendingWorkshopBootstrap = (async () => {
      state.value.pending = true
      state.value.errorMessage = null

      try {
        const response = await requestFetch<WorkshopBootstrapResponse>('/api/users/initial-data', {
          method: 'POST',
          credentials: 'include',
          headers: requestHeaders
        })

        state.value.data = response
        state.value.ready = true
        return response
      } catch (error: unknown) {
        const err = error as { data?: { statusMessage?: string }, statusMessage?: string, status?: number, statusCode?: number }
        const statusCode = err?.statusCode || err?.status

        if (statusCode === 401) {
          clear()
          return null
        }

        state.value.ready = true
        state.value.errorMessage = err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel carregar o bootstrap da oficina.'
        throw error
      } finally {
        state.value.pending = false
        pendingWorkshopBootstrap = null
      }
    })()

    return pendingWorkshopBootstrap
  }

  async function ensureReady(force = false) {
    await auth.ensureReady()

    if (!auth.isAuthenticated.value) {
      clear()
      return null
    }

    if (state.value.ready && state.value.data && !force)
      return state.value.data

    return fetchBootstrap(force)
  }

  return {
    data,
    currentUser,
    organization,
    userRole,
    employee,
    roles,
    actions,
    roleActions,
    permissions,
    organizationId,
    isOwner,
    isAdmin,
    isOnboardingComplete,
    terminated,
    ready,
    pending,
    errorMessage,
    clear,
    fetchBootstrap,
    ensureReady
  }
}
