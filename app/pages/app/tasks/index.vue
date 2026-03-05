<script setup lang="ts">
import type { Task } from '~/types/tasks'
import { TaskStatus } from '~/types/tasks'

definePageMeta({
  layout: 'app'
})

const {
  listData,
  listFetchStatus,
  listPage,
  listPageSize,
  listSearch,
  listStatus,
  listPriority,
  listListId,
  taskLists,
  insights,
  insightsStatus,
  refreshInsights,
  refreshList,
  completeTask,
  fetchTask,
  priorityOptions,
  statusOptions
} = useTasks()

// ─── Active tab ───────────────────────────────────────────────────────────────
const activeTab = ref('pending')

const tabs = [
  { label: 'Pendentes', value: 'pending', icon: 'i-lucide-clock' },
  { label: 'Todas', value: 'all', icon: 'i-lucide-list' },
  { label: 'Insights', value: 'insights', icon: 'i-lucide-bar-chart-3' }
]

watch(activeTab, (tab) => {
  if (tab === 'pending') {
    listStatus.value = TaskStatus.Pending
    listPriority.value = ''
    listListId.value = ''
    listSearch.value = ''
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
const listCreateModalOpen = ref(false)
const detailSlideoverOpen = ref(false)
const selectedTask = ref<Task | null>(null)

// ─── Actions ──────────────────────────────────────────────────────────────────
async function onSelectTask(taskId: string) {
  const task = await fetchTask(taskId)
  if (task) {
    selectedTask.value = task
    detailSlideoverOpen.value = true
  }
}

function onEditTask(task: Task) {
  selectedTask.value = task
  editModalOpen.value = true
}

function onArchiveTask(task: Task) {
  selectedTask.value = task
  archiveModalOpen.value = true
}

async function onCompleteTask(task: Task) {
  await completeTask(task.id, task.title)
}

function onTaskArchived() {
  detailSlideoverOpen.value = false
  selectedTask.value = null
}

function onTaskUpdated() {
  refreshList()
}

// ─── Filter options ───────────────────────────────────────────────────────────
const priorityFilterOptions = computed(() => [
  { label: 'Todas', value: '' },
  ...priorityOptions
])

const statusFilterOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...statusOptions
])

const listFilterOptions = computed(() => [
  { label: 'Todas', value: '' },
  ...(taskLists.value ?? []).map(l => ({ label: l.name, value: l.id }))
])
</script>

<template>
  <UDashboardPanel id="tasks">
    <template #header>
      <UDashboardNavbar title="Tarefas">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Nova lista"
            icon="i-lucide-folder-plus"
            variant="outline"
            @click="listCreateModalOpen = true"
          />
          <UButton
            label="Nova tarefa"
            icon="i-lucide-plus"
            @click="createModalOpen = true"
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

        <!-- PENDING TAB -->
        <div v-if="activeTab === 'pending'" class="space-y-4">
          <TasksTasksList
            :tasks="listData?.data ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listFetchStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectTask"
            @edit="onEditTask"
            @archive="onArchiveTask"
            @complete="onCompleteTask"
          />
        </div>

        <!-- ALL TAB -->
        <div v-if="activeTab === 'all'" class="space-y-4">
          <!-- Filters -->
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="listSearch"
              icon="i-lucide-search"
              placeholder="Buscar tarefas..."
              class="max-w-xs"
            />
            <USelect
              v-model="listPriority"
              :items="priorityFilterOptions"
              value-key="value"
              placeholder="Prioridade"
              class="min-w-32"
            />
            <USelect
              v-model="listStatus"
              :items="statusFilterOptions"
              value-key="value"
              placeholder="Status"
              class="min-w-32"
            />
            <USelect
              v-model="listListId"
              :items="listFilterOptions"
              value-key="value"
              placeholder="Lista"
              class="min-w-32"
            />
          </div>

          <TasksTasksList
            :tasks="listData?.data ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listFetchStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectTask"
            @edit="onEditTask"
            @archive="onArchiveTask"
            @complete="onCompleteTask"
          />
        </div>

        <!-- INSIGHTS TAB -->
        <div v-if="activeTab === 'insights'">
          <TasksInsightsPanel
            :insights="insights ?? null"
            :loading="insightsStatus === 'pending'"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <TasksCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
  />

  <TasksEditModal
    v-if="selectedTask"
    :open="editModalOpen"
    :task="selectedTask"
    @update:open="editModalOpen = $event"
  />

  <TasksArchiveModal
    v-if="selectedTask"
    :open="archiveModalOpen"
    :task="selectedTask"
    @update:open="archiveModalOpen = $event"
    @archived="onTaskArchived"
  />

  <TasksListCreateModal
    :open="listCreateModalOpen"
    @update:open="listCreateModalOpen = $event"
  />

  <TasksDetailSlideover
    v-if="selectedTask"
    :open="detailSlideoverOpen"
    :task="selectedTask"
    @update:open="detailSlideoverOpen = $event"
    @edit="editModalOpen = true"
    @archive="archiveModalOpen = true"
    @updated="onTaskUpdated"
  />
</template>
