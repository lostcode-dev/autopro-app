<script setup lang="ts">
import type { Goal } from '~/types/goals'
import { GoalStatus } from '~/types/goals'

definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Metas'
})

const {
  listData,
  listFetchStatus,
  listPage,
  listPageSize,
  listSearch,
  listStatus,
  listTimeCategory,
  listLifeCategory,
  insights,
  insightsStatus,
  refreshInsights,
  refreshList,
  completeGoal,
  restoreGoal,
  fetchGoal,
  timeCategoryOptions,
  lifeCategoryOptions,
  statusOptions
} = useGoals()

// ─── Active tab ───────────────────────────────────────────────────────────────
const activeTab = ref('active')

const tabs = [
  { label: 'Ativas', value: 'active', icon: 'i-lucide-target' },
  { label: 'Todas', value: 'all', icon: 'i-lucide-list' },
  { label: 'Insights', value: 'insights', icon: 'i-lucide-bar-chart-3' }
]

watch(activeTab, (tab) => {
  if (tab === 'active') {
    listStatus.value = GoalStatus.Active
  } else if (tab === 'all') {
    listStatus.value = ''
  }
  if (tab === 'insights') {
    refreshInsights()
  }
  listPage.value = 1
}, { immediate: true })

// ─── Modals ───────────────────────────────────────────────────────────────────
const createModalOpen = ref(false)
const editModalOpen = ref(false)
const archiveModalOpen = ref(false)
const detailSlideoverOpen = ref(false)
const selectedGoal = ref<Goal | null>(null)

const ALL_FILTER_VALUE = '__all__'

const listTimeCategoryModel = computed({
  get: () => listTimeCategory.value || ALL_FILTER_VALUE,
  set: (value: string) => {
    listTimeCategory.value = value === ALL_FILTER_VALUE ? '' : value
  }
})

const listLifeCategoryModel = computed({
  get: () => listLifeCategory.value || ALL_FILTER_VALUE,
  set: (value: string) => {
    listLifeCategory.value = value === ALL_FILTER_VALUE ? '' : value
  }
})

const listStatusModel = computed({
  get: () => listStatus.value || ALL_FILTER_VALUE,
  set: (value: string) => {
    listStatus.value = value === ALL_FILTER_VALUE ? '' : value
  }
})

// ─── Actions ──────────────────────────────────────────────────────────────────
async function onSelectGoal(goalId: string) {
  const goal = await fetchGoal(goalId)
  if (goal) {
    selectedGoal.value = goal
    detailSlideoverOpen.value = true
  }
}

function onEditGoal(goal: Goal) {
  selectedGoal.value = goal
  editModalOpen.value = true
}

function onArchiveGoal(goal: Goal) {
  selectedGoal.value = goal
  archiveModalOpen.value = true
}

async function onCompleteGoal(goal: Goal) {
  await completeGoal(goal.id, goal.title)
}

async function onRestoreGoal(goal: Goal) {
  await restoreGoal(goal.id)
}

function onGoalArchived() {
  detailSlideoverOpen.value = false
  selectedGoal.value = null
}

function onGoalUpdated() {
  refreshList()
}

// ─── Filter options ───────────────────────────────────────────────────────────
const timeCategoryFilterOptions = computed(() => [
  { label: 'Todos', value: ALL_FILTER_VALUE },
  ...timeCategoryOptions
])

const lifeCategoryFilterOptions = computed(() => [
  { label: 'Todas', value: ALL_FILTER_VALUE },
  ...lifeCategoryOptions
])

const statusFilterOptions = computed(() => [
  { label: 'Todas', value: ALL_FILTER_VALUE },
  ...statusOptions
])
</script>
              v-model="listTimeCategoryModel"
<template>
  <UDashboardPanel id="goals">
    <template #header>
      <UDashboardNavbar title="Metas">
        <template #leading>
          <UDashboardSidebarCollapse />
              v-model="listLifeCategoryModel"

        <template #right>
          <NotificationsButton />
          <UButton
            label="Nova meta"
            icon="i-lucide-plus"
              v-model="listStatusModel"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Tabs -->
        <UTabs
          :items="tabs"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        />

        <!-- ACTIVE TAB -->
        <div v-if="activeTab === 'active'" class="space-y-4">
          <GoalsGoalsList
            :goals="listData?.data ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listFetchStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectGoal"
            @edit="onEditGoal"
            @archive="onArchiveGoal"
            @complete="onCompleteGoal"
            @restore="onRestoreGoal"
          />
        </div>

        <!-- ALL GOALS TAB -->
        <div v-if="activeTab === 'all'" class="space-y-4">
          <!-- Filters -->
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="listSearch"
              icon="i-lucide-search"
              placeholder="Buscar metas..."
              class="max-w-xs"
            />
            <USelect
              v-model="listTimeCategory"
              :items="timeCategoryFilterOptions"
              value-key="value"
              placeholder="Prazo"
              class="min-w-32"
            />
            <USelect
              v-model="listLifeCategory"
              :items="lifeCategoryFilterOptions"
              value-key="value"
              placeholder="Área"
              class="min-w-32"
            />
            <USelect
              v-model="listStatus"
              :items="statusFilterOptions"
              value-key="value"
              placeholder="Status"
              class="min-w-32"
            />
          </div>

          <GoalsGoalsList
            :goals="listData?.data ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listFetchStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectGoal"
            @edit="onEditGoal"
            @archive="onArchiveGoal"
            @complete="onCompleteGoal"
            @restore="onRestoreGoal"
          />
        </div>

        <!-- INSIGHTS TAB -->
        <div v-if="activeTab === 'insights'">
          <GoalsInsightsPanel
            :insights="insights ?? null"
            :loading="insightsStatus === 'pending'"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <GoalsCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
  />

  <GoalsEditModal
    v-if="selectedGoal"
    :open="editModalOpen"
    :goal="selectedGoal"
    @update:open="editModalOpen = $event"
  />

  <GoalsArchiveModal
    v-if="selectedGoal"
    :open="archiveModalOpen"
    :goal="selectedGoal"
    @update:open="archiveModalOpen = $event"
    @archived="onGoalArchived"
  />

  <GoalsDetailSlideover
    v-if="selectedGoal"
    :open="detailSlideoverOpen"
    :goal="selectedGoal"
    @update:open="detailSlideoverOpen = $event"
    @edit="editModalOpen = true"
    @archive="archiveModalOpen = true"
    @updated="onGoalUpdated"
  />
</template>
