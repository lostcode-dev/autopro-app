import type { DailyDashboardResponse, LifeInsights, LifeArea, EntityLink, CreateLifeAreaPayload, CreateEntityLinkPayload } from '~/types/life-os'

export function useLifeOS() {
  const toast = useToast()

  // ─── Daily Dashboard ────────────────────────────────────────────────────
  const {
    data: dashboard,
    status: dashboardStatus,
    refresh: refreshDashboard
  } = useFetch<DailyDashboardResponse>('/api/life/dashboard', {
    lazy: true,
    default: () => ({
      date: '',
      habits: { items: [], completedCount: 0, totalCount: 0 },
      tasks: { items: [], pendingCount: 0, overdueCount: 0 },
      events: { items: [], totalCount: 0 },
      journal: {
        id: null,
        entryDate: '',
        title: null,
        contentPreview: null,
        exists: false
      }
    })
  })

  // ─── Insights ───────────────────────────────────────────────────────────
  const {
    data: insights,
    status: insightsStatus,
    refresh: refreshInsights
  } = useFetch<LifeInsights>('/api/life/insights', {
    lazy: true,
    default: () => ({
      period: '30d',
      habits: { completionRate7d: 0, completionRate30d: 0, averageStreak: 0, totalActive: 0 },
      tasks: { completedLast7d: 0, completedLast30d: 0, pendingCount: 0, overdueCount: 0 },
      goals: { totalActive: 0, averageProgress: 0, completedCount: 0 },
      journal: { entriesLast7d: 0, entriesLast30d: 0, currentStreak: 0 }
    })
  })

  // ─── Life Areas ─────────────────────────────────────────────────────────
  const {
    data: areasResponse,
    status: areasStatus,
    refresh: refreshAreas
  } = useFetch<{ data: LifeArea[], total: number }>('/api/life/areas', {
    lazy: true,
    default: () => ({ data: [], total: 0 })
  })

  const areas = computed(() => areasResponse.value?.data ?? [])

  async function createArea(payload: CreateLifeAreaPayload) {
    try {
      await $fetch('/api/life/areas', { method: 'POST', body: payload })
      toast.add({ title: 'Área criada', description: `"${payload.name}" foi adicionada.`, color: 'success' })
      await refreshAreas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  async function updateArea(id: string, payload: CreateLifeAreaPayload) {
    try {
      await $fetch(`/api/life/areas/${id}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Área atualizada', description: `"${payload.name}" foi atualizada.`, color: 'success' })
      await refreshAreas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  async function deleteArea(id: string) {
    try {
      await $fetch(`/api/life/areas/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Área excluída', description: 'Área de vida removida.', color: 'success' })
      await refreshAreas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── Entity Links ──────────────────────────────────────────────────────
  async function createLink(payload: CreateEntityLinkPayload) {
    try {
      const result = await $fetch<EntityLink>('/api/life/links', { method: 'POST', body: payload })
      toast.add({ title: 'Vínculo criado', description: 'Entidades vinculadas com sucesso.', color: 'success' })
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  async function deleteLink(id: string) {
    try {
      await $fetch(`/api/life/links/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Vínculo removido', description: 'Vínculo excluído com sucesso.', color: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.add({ title: 'Erro', description: msg, color: 'error' })
      throw err
    }
  }

  // ─── Refresh All ────────────────────────────────────────────────────────
  async function refreshAll() {
    await Promise.all([
      refreshDashboard(),
      refreshInsights(),
      refreshAreas()
    ])
  }

  return {
    // Dashboard
    dashboard,
    dashboardStatus,
    refreshDashboard,
    // Insights
    insights,
    insightsStatus,
    refreshInsights,
    // Life Areas
    areas,
    areasStatus,
    refreshAreas,
    createArea,
    updateArea,
    deleteArea,
    // Entity Links
    createLink,
    deleteLink,
    // Utilities
    refreshAll
  }
}
