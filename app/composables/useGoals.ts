import { useDebounceFn } from '@vueuse/core'
import type {
  CreateGoalPayload,
  CreateGoalTaskPayload,
  Goal,
  GoalInsights,
  GoalListResponse,
  GoalTask,
  GoalHabitLink,
  UpdateGoalPayload,
  UpdateGoalTaskPayload,
  LinkHabitPayload
} from '~/types/goals'
import { GoalLifeCategory, GoalStatus, GoalTimeCategory } from '~/types/goals'

type BadgeColor = 'success' | 'error' | 'primary' | 'secondary' | 'info' | 'warning' | 'neutral'

export function useGoals() {
  const toast = useToast()

  // ─── Goals list (paginated) ─────────────────────────────────────────────────
  const listPage = ref(1)
  const listPageSize = ref(20)
  const listSearch = ref('')
  const listStatus = ref<string>('')
  const listTimeCategory = ref<string>('')
  const listLifeCategory = ref<string>('')

  const {
    data: listData,
    status: listFetchStatus,
    refresh: refreshList
  } = useFetch<GoalListResponse>('/api/goals', {
    query: computed(() => ({
      page: listPage.value,
      pageSize: listPageSize.value,
      search: listSearch.value || undefined,
      status: listStatus.value || undefined,
      timeCategory: listTimeCategory.value || undefined,
      lifeCategory: listLifeCategory.value || undefined
    })),
    lazy: true,
    immediate: false,
    key: 'goals-list',
    watch: [listPage, listPageSize, listStatus, listTimeCategory, listLifeCategory]
  })

  const debouncedRefreshList = useDebounceFn(() => {
    refreshList()
  }, 300)

  watch(listSearch, () => {
    listPage.value = 1
    debouncedRefreshList()
  })

  // ─── Insights ───────────────────────────────────────────────────────────────
  const {
    data: insights,
    status: insightsStatus,
    refresh: refreshInsights
  } = useFetch<GoalInsights>('/api/goals/insights', {
    lazy: true,
    immediate: false,
    key: 'goals-insights'
  })

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function createGoal(payload: CreateGoalPayload): Promise<Goal | null> {
    try {
      const goal = await $fetch<Goal>('/api/goals', {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Meta criada', description: `"${goal.title}" adicionada com sucesso.`, color: 'success' })
      await refreshList()
      return goal
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar a meta.', color: 'error' })
      return null
    }
  }

  async function updateGoal(id: string, payload: UpdateGoalPayload): Promise<Goal | null> {
    try {
      const goal = await $fetch<Goal>(`/api/goals/${id}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({ title: 'Meta atualizada', description: `"${goal.title}" salva com sucesso.`, color: 'success' })
      await refreshList()
      return goal
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar a meta.', color: 'error' })
      return null
    }
  }

  async function archiveGoal(id: string, title: string): Promise<boolean> {
    try {
      const endpoint: string = `/api/goals/${id}`
      await $fetch(endpoint, { method: 'DELETE' })
      toast.add({ title: 'Meta arquivada', description: `"${title}" foi arquivada.`, color: 'success' })
      await refreshList()
      return true
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível arquivar a meta.', color: 'error' })
      return false
    }
  }

  async function restoreGoal(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/goals/${id}/restore`, { method: 'POST' })
      toast.add({ title: 'Meta restaurada', description: 'A meta foi restaurada com sucesso.', color: 'success' })
      await refreshList()
      return true
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível restaurar a meta.', color: 'error' })
      return false
    }
  }

  async function completeGoal(id: string, title: string): Promise<boolean> {
    try {
      const endpoint: string = `/api/goals/${id}`
      await $fetch(endpoint, {
        method: 'PUT',
        body: { status: GoalStatus.Completed }
      })
      toast.add({ title: 'Meta concluída!', description: `"${title}" foi marcada como concluída.`, color: 'success' })
      await refreshList()
      return true
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível concluir a meta.', color: 'error' })
      return false
    }
  }

  async function fetchGoal(id: string): Promise<Goal | null> {
    try {
      return await $fetch<Goal>(`/api/goals/${id}`)
    } catch {
      toast.add({ title: 'Erro', description: 'Meta não encontrada.', color: 'error' })
      return null
    }
  }

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  async function createTask(goalId: string, payload: CreateGoalTaskPayload): Promise<GoalTask | null> {
    try {
      const task = await $fetch<GoalTask>(`/api/goals/${goalId}/tasks`, {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Tarefa criada', description: `"${task.title}" adicionada.`, color: 'success' })
      return task
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar a tarefa.', color: 'error' })
      return null
    }
  }

  async function updateTask(taskId: string, payload: UpdateGoalTaskPayload): Promise<GoalTask | null> {
    try {
      const task = await $fetch<GoalTask>(`/api/goals/tasks/${taskId}`, {
        method: 'PUT',
        body: payload
      })
      return task
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar a tarefa.', color: 'error' })
      return null
    }
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    try {
      const endpoint: string = `/api/goals/tasks/${taskId}`
      await $fetch(endpoint, { method: 'DELETE' })
      toast.add({ title: 'Tarefa removida', description: 'A tarefa foi excluída.', color: 'success' })
      return true
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível excluir a tarefa.', color: 'error' })
      return false
    }
  }

  // ─── Habit Links ────────────────────────────────────────────────────────────

  async function linkHabit(goalId: string, payload: LinkHabitPayload): Promise<GoalHabitLink | null> {
    try {
      const link = await $fetch<GoalHabitLink>(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Hábito vinculado', description: 'Hábito associado à meta.', color: 'success' })
      return link
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível vincular o hábito.', color: 'error' })
      return null
    }
  }

  async function unlinkHabit(linkId: string): Promise<boolean> {
    try {
      const endpoint: string = `/api/goals/habits/${linkId}`
      await $fetch(endpoint, { method: 'DELETE' })
      toast.add({ title: 'Vínculo removido', description: 'O hábito foi desvinculado da meta.', color: 'success' })
      return true
    } catch {
      toast.add({ title: 'Erro', description: 'Não foi possível remover o vínculo.', color: 'error' })
      return false
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const timeCategoryOptions = [
    { label: 'Diário', value: GoalTimeCategory.Daily },
    { label: 'Semanal', value: GoalTimeCategory.Weekly },
    { label: 'Mensal', value: GoalTimeCategory.Monthly },
    { label: 'Trimestral', value: GoalTimeCategory.Quarterly },
    { label: 'Anual', value: GoalTimeCategory.Yearly },
    { label: 'Longo prazo', value: GoalTimeCategory.LongTerm }
  ]

  const lifeCategoryOptions = [
    { label: 'Pessoal', value: GoalLifeCategory.Personal },
    { label: 'Carreira', value: GoalLifeCategory.Career },
    { label: 'Saúde', value: GoalLifeCategory.Health },
    { label: 'Finanças', value: GoalLifeCategory.Finance },
    { label: 'Espiritual', value: GoalLifeCategory.Spiritual },
    { label: 'Aprendizado', value: GoalLifeCategory.Learning },
    { label: 'Relacionamentos', value: GoalLifeCategory.Relationships },
    { label: 'Estilo de vida', value: GoalLifeCategory.Lifestyle }
  ]

  const statusOptions = [
    { label: 'Ativa', value: GoalStatus.Active },
    { label: 'Concluída', value: GoalStatus.Completed },
    { label: 'Arquivada', value: GoalStatus.Archived }
  ]

  function getLifeCategoryLabel(value: string): string {
    return lifeCategoryOptions.find(o => o.value === value)?.label ?? value
  }

  function getTimeCategoryLabel(value: string): string {
    return timeCategoryOptions.find(o => o.value === value)?.label ?? value
  }

  function getStatusColor(status: string): BadgeColor {
    switch (status) {
      case GoalStatus.Active: return 'primary'
      case GoalStatus.Completed: return 'success'
      case GoalStatus.Archived: return 'neutral'
      default: return 'neutral'
    }
  }

  function getStatusLabel(status: string): string {
    return statusOptions.find(o => o.value === status)?.label ?? status
  }

  return {
    // List
    listData,
    listFetchStatus,
    listPage,
    listPageSize,
    listSearch,
    listStatus,
    listTimeCategory,
    listLifeCategory,
    refreshList,
    // Insights
    insights,
    insightsStatus,
    refreshInsights,
    // Actions
    createGoal,
    updateGoal,
    archiveGoal,
    restoreGoal,
    completeGoal,
    fetchGoal,
    // Tasks
    createTask,
    updateTask,
    deleteTask,
    // Habit Links
    linkHabit,
    unlinkHabit,
    // Helpers
    timeCategoryOptions,
    lifeCategoryOptions,
    statusOptions,
    getLifeCategoryLabel,
    getTimeCategoryLabel,
    getStatusColor,
    getStatusLabel
  }
}
