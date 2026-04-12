type BillingSubscription = {
  stripe_customer_id: string | null
  stripe_subscription_id: string
  status: string
  price_id: string | null
  quantity: number | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  canceled_at: string | null
}

type BillingStatusResponse = {
  hasAccess: boolean
  subscription: BillingSubscription | null
}

type BillingState = {
  data: BillingStatusResponse | null
  ready: boolean
  pending: boolean
}

let pendingBillingRequest: Promise<BillingStatusResponse | null> | null = null

export function useBilling() {
  const auth = useAuth()
  const requestFetch = useRequestFetch()
  const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const state = useState<BillingState>('billing-status', () => ({
    data: null,
    ready: false,
    pending: false
  }))

  const data = computed(() => state.value.data)
  const hasAccess = computed(() => data.value?.hasAccess === true)
  const subscription = computed(() => data.value?.subscription ?? null)
  const ready = computed(() => state.value.ready)
  const pending = computed(() => state.value.pending)

  function clear() {
    state.value = {
      data: null,
      ready: true,
      pending: false
    }
  }

  async function fetchStatus(force = false) {
    if (!auth.isAuthenticated.value) {
      clear()
      return null
    }

    if (!force && pendingBillingRequest)
      return pendingBillingRequest

    pendingBillingRequest = (async () => {
      state.value.pending = true
      try {
        const response = await requestFetch<BillingStatusResponse>('/api/billing/status', {
          credentials: 'include',
          headers: requestHeaders
        })

        state.value.data = response
        state.value.ready = true
        return response
      } catch (error: unknown) {
        const err = error as { status?: number, statusCode?: number }
        const statusCode = err?.statusCode || err?.status
        if (statusCode === 401) {
          clear()
          return null
        }

        throw error
      } finally {
        state.value.pending = false
        pendingBillingRequest = null
      }
    })()

    return pendingBillingRequest
  }

  async function ensureReady(force = false) {
    await auth.ensureReady()

    if (!auth.isAuthenticated.value) {
      clear()
      return null
    }

    if (state.value.ready && !force)
      return state.value.data

    return fetchStatus(force)
  }

  return {
    data,
    hasAccess,
    subscription,
    ready,
    pending,
    clear,
    fetchStatus,
    ensureReady
  }
}
