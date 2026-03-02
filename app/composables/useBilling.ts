type BillingState = {
  hasAccess: boolean | null
  subscription: {
    status: string
    price_id: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean | null
  } | null
  checkedAt: number | null
}

export function useBilling() {
  const state = useState<BillingState>('billing', () => ({
    hasAccess: null,
    subscription: null,
    checkedAt: null
  }))

  const hasAccess = computed(() => state.value.hasAccess)
  const subscription = computed(() => state.value.subscription)

  async function fetchStatus() {
    const response = await $fetch<{ hasAccess: boolean, subscription: BillingState['subscription'] }>('/api/billing/status')
    state.value.hasAccess = response.hasAccess
    state.value.subscription = response.subscription
    state.value.checkedAt = Date.now()
    return response
  }

  async function ensureReady() {
    if (state.value.checkedAt && Date.now() - state.value.checkedAt < 30_000)
      return
    await fetchStatus()
  }

  function reset() {
    state.value.hasAccess = null
    state.value.subscription = null
    state.value.checkedAt = null
  }

  return {
    hasAccess,
    subscription,
    fetchStatus,
    ensureReady,
    reset
  }
}
