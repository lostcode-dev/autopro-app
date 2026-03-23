import { useDebounceFn } from '@vueuse/core'
import type {
  GoalInsights,
  GoalListResponse,
} from '~/types/goals'
import { useGoalActions } from '~/composables/useGoalActions'

export function useGoals() {
  // ─── Goals list (paginated) ─────────────────────────────────────────────────
  const listPage = ref(1)
  const listPageSize = ref(20)
  const listSearch = ref('')
  const listStatus = ref<string>('')
  const listTimeCategory = ref<string>('')
  const listLifeCategory = ref<string>('')

  const listData = ref<GoalListResponse | null>(null)
  const listFetchStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

  async function refreshList() {
    listFetchStatus.value = 'pending'
    try {
      listData.value = await $fetch<GoalListResponse>('/api/goals', {
        query: {
          page: listPage.value,
          pageSize: listPageSize.value,
          search: listSearch.value || undefined,
          status: listStatus.value || undefined,
          timeCategory: listTimeCategory.value || undefined,
          lifeCategory: listLifeCategory.value || undefined
        }
      })
      listFetchStatus.value = 'success'
    } catch {
      listFetchStatus.value = 'error'
    }
  }

  const debouncedRefreshList = useDebounceFn(() => {
    refreshList()
  }, 300)

  watch(listSearch, () => {
    listPage.value = 1
    debouncedRefreshList()
  })

  // ─── Insights ───────────────────────────────────────────────────────────────
  const insights = ref<GoalInsights | null>(null)
  const insightsStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

  async function refreshInsights() {
    insightsStatus.value = 'pending'
    try {
      insights.value = await $fetch<GoalInsights>('/api/goals/insights')
      insightsStatus.value = 'success'
    } catch {
      insightsStatus.value = 'error'
    }
  }

  const actions = useGoalActions()

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
    // Actions & Helpers
    ...actions,
  }
}
