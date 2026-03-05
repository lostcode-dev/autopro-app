<script setup lang="ts">
import type { Feedback, CreateFeedbackPayload } from '~/types/feedback'
import {
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
  feedbackTypeLabels,
  feedbackStatusLabels,
  feedbackPriorityLabels
} from '~/types/feedback'

definePageMeta({ layout: 'app' })

const {
  listData,
  listFetchStatus,
  listPage,
  listPageSize,
  listType,
  listStatus,
  listSearch,
  createFeedback,
  fetchFeedback,
  deleteFeedback,
  addResponse,
  adminListData,
  adminListFetchStatus,
  adminPage,
  adminPageSize,
  adminType,
  adminStatus,
  adminPriority,
  adminSearch,
  refreshAdminList,
  adminUpdateFeedback,
  adminLinkEntity
} = useFeedback()

const activeTab = ref('my')
const tabs = [
  { label: 'Meus feedbacks', value: 'my', icon: 'i-lucide-message-circle' },
  { label: 'Admin', value: 'admin', icon: 'i-lucide-shield' }
]

const createModalOpen = ref(false)
const detailSlideoverOpen = ref(false)
const adminSlideoverOpen = ref(false)
const selectedFeedback = ref<Feedback | null>(null)

const userFeedbacks = computed(() => listData.value?.data ?? [])
const userTotal = computed(() => listData.value?.total ?? 0)
const adminFeedbacks = computed(() => adminListData.value?.data ?? [])
const adminTotal = computed(() => adminListData.value?.total ?? 0)

const typeFilterOptions = [
  { label: 'Todos os tipos', value: '' },
  ...Object.values(FeedbackType).map(t => ({
    label: feedbackTypeLabels[t],
    value: t
  }))
]

const statusFilterOptions = [
  { label: 'Todos os status', value: '' },
  ...Object.values(FeedbackStatus).map(s => ({
    label: feedbackStatusLabels[s],
    value: s
  }))
]

const priorityFilterOptions = [
  { label: 'Todas prioridades', value: '' },
  ...Object.values(FeedbackPriority).map(p => ({
    label: feedbackPriorityLabels[p],
    value: p
  }))
]

// ─── Handlers ────────────────────────────────────────
async function onCreateSubmit(payload: CreateFeedbackPayload) {
  await createFeedback(payload)
}

function onSelectFeedback(fb: Feedback) {
  selectedFeedback.value = fb
  detailSlideoverOpen.value = true
}

function onSelectAdminFeedback(fb: Feedback) {
  selectedFeedback.value = fb
  adminSlideoverOpen.value = true
}

async function onDeleteFeedback(id: string) {
  await deleteFeedback(id)
  detailSlideoverOpen.value = false
  selectedFeedback.value = null
}

async function onRespond(feedbackId: string, content: string) {
  await addResponse(feedbackId, { content })
  if (selectedFeedback.value) {
    selectedFeedback.value = await fetchFeedback(feedbackId)
  }
}

async function onAdminUpdateStatus(id: string, status: FeedbackStatus) {
  await adminUpdateFeedback(id, { status })
}

async function onAdminUpdatePriority(id: string, priority: FeedbackPriority) {
  await adminUpdateFeedback(id, { priority })
}

async function onAdminRespond(feedbackId: string, content: string) {
  await addResponse(feedbackId, { content })
  await refreshAdminList()
}

async function onAdminLinkEntity(feedbackId: string, entityType: string, entityId: string | undefined, externalUrl: string | undefined) {
  await adminLinkEntity(feedbackId, { entityType, entityId, externalUrl })
}

function onUserPageUpdate(page: number) {
  listPage.value = page
}

function onAdminPageUpdate(page: number) {
  adminPage.value = page
}
</script>

<template>
  <UDashboardPanel id="feedback">
    <template #header>
      <UDashboardNavbar title="Feedback">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <NotificationsButton />
          <UButton label="Novo feedback" icon="i-lucide-plus" @click="createModalOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-4">
        <UTabs
          :items="tabs"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        />

        <!-- My Feedbacks Tab -->
        <div v-if="activeTab === 'my'" class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <UInput
              v-model="listSearch"
              icon="i-lucide-search"
              placeholder="Buscar feedbacks..."
              class="w-full sm:w-64"
            />
            <USelect
              :model-value="listType"
              :items="typeFilterOptions"
              value-key="value"
              class="w-40"
              @update:model-value="listType = $event"
            />
            <USelect
              :model-value="listStatus"
              :items="statusFilterOptions"
              value-key="value"
              class="w-40"
              @update:model-value="listStatus = $event"
            />
          </div>

          <FeedbackList
            :feedbacks="userFeedbacks"
            :loading="listFetchStatus === 'pending'"
            :total="userTotal"
            :page="listPage"
            :page-size="listPageSize"
            @select="onSelectFeedback"
            @delete="onDeleteFeedback"
            @update:page="onUserPageUpdate"
          />
        </div>

        <!-- Admin Tab -->
        <div v-if="activeTab === 'admin'" class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <UInput
              v-model="adminSearch"
              icon="i-lucide-search"
              placeholder="Buscar feedbacks..."
              class="w-full sm:w-64"
            />
            <USelect
              :model-value="adminType"
              :items="typeFilterOptions"
              value-key="value"
              class="w-40"
              @update:model-value="adminType = $event"
            />
            <USelect
              :model-value="adminStatus"
              :items="statusFilterOptions"
              value-key="value"
              class="w-40"
              @update:model-value="adminStatus = $event"
            />
            <USelect
              :model-value="adminPriority"
              :items="priorityFilterOptions"
              value-key="value"
              class="w-40"
              @update:model-value="adminPriority = $event"
            />
          </div>

          <FeedbackAdminList
            :feedbacks="adminFeedbacks"
            :loading="adminListFetchStatus === 'pending'"
            :total="adminTotal"
            :page="adminPage"
            :page-size="adminPageSize"
            @select="onSelectAdminFeedback"
            @update-status="onAdminUpdateStatus"
            @update-priority="onAdminUpdatePriority"
            @update:page="onAdminPageUpdate"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create Modal -->
  <FeedbackCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
    @submit="onCreateSubmit"
  />

  <!-- User Detail Slideover -->
  <FeedbackDetailSlideover
    :open="detailSlideoverOpen"
    :feedback="selectedFeedback"
    @update:open="detailSlideoverOpen = $event"
    @delete="onDeleteFeedback"
    @respond="onRespond"
  />

  <!-- Admin Detail Slideover -->
  <FeedbackAdminSlideover
    :open="adminSlideoverOpen"
    :feedback="selectedFeedback"
    @update:open="adminSlideoverOpen = $event"
    @update-status="onAdminUpdateStatus"
    @update-priority="onAdminUpdatePriority"
    @respond="onAdminRespond"
    @link-entity="onAdminLinkEntity"
  />
</template>
