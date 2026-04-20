<script setup lang="ts">
import type { Feedback, CreateFeedbackPayload } from '~/types/feedback'
import {
  FeedbackType,
  FeedbackStatus,
  feedbackTypeLabels,
  feedbackTypeIcons,
  feedbackTypeColors,
  feedbackStatusLabels,
  feedbackStatusColors
} from '~/types/feedback'

definePageMeta({ layout: 'app' })

useSeoMeta({
  title: 'Suporte'
})

const {
  listData,
  listFetchStatus,
  listPage,
  listPageSize,
  listType,
  listStatus,
  listSearch,
  createFeedback,
  deleteFeedback,
  addResponse
} = useFeedback()

const createModalOpen = ref(false)
const detailSlideoverOpen = ref(false)
const selectedTicket = ref<Feedback | null>(null)

const ALL_FILTER_VALUE = '__all__'

const listTypeModel = computed({
  get: () => listType.value || ALL_FILTER_VALUE,
  set: (value: string) => { listType.value = value === ALL_FILTER_VALUE ? '' : value }
})

const listStatusModel = computed({
  get: () => listStatus.value || ALL_FILTER_VALUE,
  set: (value: string) => { listStatus.value = value === ALL_FILTER_VALUE ? '' : value }
})

const tickets = computed(() => (listData.value?.data ?? []) as unknown as Record<string, unknown>[])
const total = computed(() => listData.value?.total ?? 0)

const typeFilterOptions = [
  { label: 'Todos os tipos', value: ALL_FILTER_VALUE },
  ...Object.values(FeedbackType).map(t => ({ label: feedbackTypeLabels[t], value: t }))
]

const statusFilterOptions = [
  { label: 'Todos os status', value: ALL_FILTER_VALUE },
  ...Object.values(FeedbackStatus).map(s => ({ label: feedbackStatusLabels[s], value: s }))
]

const columns = [
  { accessorKey: 'title', header: 'Assunto', enableSorting: false },
  { accessorKey: 'type', header: 'Tipo', enableSorting: false },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
  { accessorKey: 'created_at', header: 'Abertura', enableSorting: false },
  { id: 'actions', header: '', enableSorting: false }
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function openDetail(row: Record<string, unknown>) {
  selectedTicket.value = row as unknown as Feedback
  detailSlideoverOpen.value = true
}

async function onCreateSubmit(payload: CreateFeedbackPayload) {
  await createFeedback(payload)
  createModalOpen.value = false
}

async function onDeleteTicket(id: string) {
  await deleteFeedback(id)
  detailSlideoverOpen.value = false
  selectedTicket.value = null
}

async function onRespond(feedbackId: string, content: string) {
  await addResponse(feedbackId, { content })
}
</script>

<template>
  <UDashboardPanel id="support">
    <template #header>
      <AppPageHeader title="Suporte">
        <template #right>
          <UButton label="Novo chamado" icon="i-lucide-plus" @click="createModalOpen = true" />
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <AppDataTable
            v-model:search-term="listSearch"
            v-model:page="listPage"
            v-model:page-size="listPageSize"
            :columns="columns"
            :data="tickets"
            :loading="listFetchStatus === 'pending'"
            :total="total"
            :show-search="true"
            :show-view-mode-toggle="false"
            :show-page-size-selector="true"
            search-placeholder="Buscar por assunto..."
            empty-icon="i-lucide-headset"
            empty-title="Nenhum chamado encontrado"
            empty-description="Abra um chamado para entrar em contato com o suporte."
          >
            <template #toolbar-right>
              <UButton
                label="Novo chamado"
                icon="i-lucide-plus"
                size="sm"
                @click="createModalOpen = true"
              />
            </template>

            <template #filters>
              <USelectMenu
                v-model="listTypeModel"
                :items="typeFilterOptions"
                value-key="value"
                class="w-full sm:w-44"
                :search-input="false"
              />
              <USelectMenu
                v-model="listStatusModel"
                :items="statusFilterOptions"
                value-key="value"
                class="w-full sm:w-44"
                :search-input="false"
              />
            </template>

            <template #title-cell="{ row }">
              <button
                class="text-left max-w-xs truncate font-medium hover:text-primary transition-colors"
                @click="openDetail(row.original)"
              >
                {{ row.original.title }}
              </button>
            </template>

            <template #type-cell="{ row }">
              <UBadge
                :label="feedbackTypeLabels[row.original.type as FeedbackType]"
                :color="feedbackTypeColors[row.original.type as FeedbackType]"
                variant="subtle"
                size="sm"
              >
                <template #leading>
                  <UIcon :name="feedbackTypeIcons[row.original.type as FeedbackType]" class="size-3" />
                </template>
              </UBadge>
            </template>

            <template #status-cell="{ row }">
              <UBadge
                :label="feedbackStatusLabels[row.original.status as FeedbackStatus]"
                :color="feedbackStatusColors[row.original.status as FeedbackStatus]"
                variant="subtle"
                size="sm"
              />
            </template>

            <template #created_at-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatDate(row.original.created_at as string) }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  icon="i-lucide-eye"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="openDetail(row.original)"
                />
                <UButton
                  v-if="(row.original.status as string) === 'submitted'"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="onDeleteTicket(row.original.id as string)"
                />
              </div>
            </template>
          </AppDataTable>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <FeedbackCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
    @submit="onCreateSubmit"
  />

  <FeedbackDetailSlideover
    :open="detailSlideoverOpen"
    :feedback="selectedTicket"
    @update:open="detailSlideoverOpen = $event"
    @delete="onDeleteTicket"
    @respond="onRespond"
  />
</template>
