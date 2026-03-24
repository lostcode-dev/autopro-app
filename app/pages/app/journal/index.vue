<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Diário de Bordo'
})

const {
  todayData,
  todayStatus,
  refreshToday,
  listData,
  listFetchStatus,
  listPage,
  listPageSize,
  listSearch,
  listFrom,
  listTo,
  listTag,
  tags,
  metricDefinitions,
  metricDefinitionsStatus,
  metricTypeOptions,
  insights,
  insightsStatus,
  insightsRange,
  refreshInsights,
  calendarDates,
  calendarStatus,
  calendarFrom,
  calendarTo,
  refreshCalendar,
  upsertEntry,
  createMetricDefinition,
  upsertMetricValues
} = useJournal()

// ─── Active tab ───────────────────────────────────────────────────────────────
const activeTab = ref('today')

const tabItems = [
  { label: 'Hoje', value: 'today', icon: 'i-lucide-pen-line' },
  { label: 'Calendário', value: 'calendar', icon: 'i-lucide-calendar' },
  { label: 'Entradas', value: 'entries', icon: 'i-lucide-list' },
  { label: 'Insights', value: 'insights', icon: 'i-lucide-bar-chart-3' }
]

watch(activeTab, (tab) => {
  if (tab === 'today') {
    refreshToday()
  }
  if (tab === 'insights') {
    refreshInsights()
  }
  if (tab === 'calendar') {
    refreshCalendar()
  }
  if (tab === 'entries') {
    listPage.value = 1
  }
})

// ─── Modals / Slideover ───────────────────────────────────────────────────────
const metricCreateModalOpen = ref(false)
const detailSlideoverOpen = ref(false)
const selectedDate = ref('')

function onSelectDate(date: string) {
  selectedDate.value = date
  detailSlideoverOpen.value = true
}

function onCalendarMonthChange(from: string, to: string) {
  calendarFrom.value = from
  calendarTo.value = to
}

function onInsightsRangeChange(range: '7d' | '30d' | '90d') {
  insightsRange.value = range
}

// ─── Tag filter options ───────────────────────────────────────────────────────
const ALL_FILTER_VALUE = '__all__'

const listTagModel = computed({
  get: () => listTag.value || ALL_FILTER_VALUE,
  set: (value: string) => {
    listTag.value = value === ALL_FILTER_VALUE ? '' : value
  }
})

const tagFilterOptions = computed(() => [
  { label: 'Todas', value: ALL_FILTER_VALUE },
  ...(tags.value ?? []).map(t => ({ label: t.name, value: t.name }))
])
</script>

<template>
  <UDashboardPanel id="journal">
    <template #header>
      <UDashboardNavbar title="Diário de Bordo">
        <template #leading>
          <AppSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
          <UButton
            label="Novo indicador"
            icon="i-lucide-gauge"
            variant="outline"
            @click="metricCreateModalOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Tabs -->
        <UTabs
          :items="tabItems"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        />

        <!-- TODAY TAB -->
        <div v-if="activeTab === 'today'">
          <JournalTodayEditor
            :today-entry="todayData?.entry ?? null"
            :today-metrics="todayData?.metrics ?? []"
            :metric-definitions="metricDefinitions ?? []"
            :loading="todayStatus === 'pending' || metricDefinitionsStatus === 'pending'"
            :on-upsert-entry="upsertEntry"
            :on-upsert-metric-values="upsertMetricValues"
            @saved="refreshToday()"
            @metrics-saved="refreshToday()"
          />
        </div>

        <!-- CALENDAR TAB -->
        <div v-if="activeTab === 'calendar'">
          <JournalCalendarView
            :entry-dates="calendarDates ?? []"
            :loading="calendarStatus === 'pending'"
            @select-date="onSelectDate"
            @month-change="onCalendarMonthChange"
          />
        </div>

        <!-- ENTRIES TAB -->
        <div
          v-if="activeTab === 'entries'"
          class="space-y-4"
        >
          <!-- Filters -->
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="listSearch"
              icon="i-lucide-search"
              placeholder="Buscar entradas..."
              class="max-w-xs"
            />
            <UInput
              v-model="listFrom"
              type="date"
              placeholder="De"
              class="max-w-40"
            />
            <UInput
              v-model="listTo"
              type="date"
              placeholder="Até"
              class="max-w-40"
            />
            <USelect
              v-model="listTagModel"
              :items="tagFilterOptions"
              value-key="value"
              placeholder="Tag"
              class="min-w-28"
            />
          </div>

          <JournalEntryList
            :entries="listData?.data ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listFetchStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectDate"
          />
        </div>

        <!-- INSIGHTS TAB -->
        <div v-if="activeTab === 'insights'">
          <JournalInsightsPanel
            :insights="insights ?? null"
            :loading="insightsStatus === 'pending'"
            @range-change="onInsightsRangeChange"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <JournalMetricCreateModal
    :open="metricCreateModalOpen"
    :metric-type-options="metricTypeOptions"
    :on-create-metric-definition="createMetricDefinition"
    @update:open="metricCreateModalOpen = $event"
  />

  <JournalEntryDetailSlideover
    v-if="selectedDate"
    :open="detailSlideoverOpen"
    :date="selectedDate"
    @update:open="detailSlideoverOpen = $event"
    @updated="refreshToday(); refreshCalendar()"
  />
</template>
