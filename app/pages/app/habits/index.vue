<script setup lang="ts">
import type { Habit, HabitReflection } from "~/types/habits";

definePageMeta({
  layout: "app",
});

useSeoMeta({
  title: "Hábitos",
});

const {
  todayData,
  todayStatus,
  todayDate,
  refreshToday,
  listData,
  listStatus,
  listPage,
  listSearch,
  listFrequency,
  listDifficulty,
  listIdentityId,
  listPageSize,
  identities,
  insights,
  insightsStatus,
  refreshInsights,
  logHabit,
  frequencyOptions,
  difficultyOptions,
  fetchHabit,
  getCurrentWeekKey,
  saveReflection,
} = useHabits();

// ─── Active tab ───────────────────────────────────────────────────────────────
const activeTab = ref("today");

const tabs = [
  { label: "Hoje", value: "today", icon: "i-lucide-sun" },
  { label: "Todos", value: "all", icon: "i-lucide-list" },
  { label: "Revisão", value: "review", icon: "i-lucide-notebook-pen" },
];

// Load insights when tab is selected
watch(activeTab, (tab) => {
  if (tab === "review") {
    reviewWeekKey.value = reviewWeekKey.value || currentWeekKey.value;
    loadReflection(reviewWeekKey.value);
    loadReflectionsList(true);
  }
});

// ─── Modals ───────────────────────────────────────────────────────────────────
const createModalOpen = ref(false);
const editModalOpen = ref(false);
const archiveModalOpen = ref(false);
const detailSlideoverOpen = ref(false);
const identityModalOpen = ref(false);
const selectedHabit = ref<Habit | null>(null);

const ALL_FILTER_VALUE = "__all__";

const listFrequencyModel = computed({
  get: () => listFrequency.value || ALL_FILTER_VALUE,
  set: (value: string) => {
    listFrequency.value = value === ALL_FILTER_VALUE ? "" : value;
  },
});

const listDifficultyModel = computed({
  get: () => listDifficulty.value || ALL_FILTER_VALUE,
  set: (value: string) => {
    listDifficulty.value = value === ALL_FILTER_VALUE ? "" : value;
  },
});

// ─── Today actions ────────────────────────────────────────────────────────────
async function onToggleHabit(habitId: string, completed: boolean) {
  const today = todayDate.value ?? new Date().toISOString().split("T")[0]!;
  await logHabit({ habitId, logDate: today, completed });
  await refreshInsights();
}

async function onSelectHabit(habitId: string) {
  const habit = await fetchHabit(habitId);
  if (habit) {
    selectedHabit.value = habit;
    detailSlideoverOpen.value = true;
  }
}

// ─── List actions ─────────────────────────────────────────────────────────────
function onEditHabit(habit: Habit) {
  selectedHabit.value = habit;
  editModalOpen.value = true;
}

function onArchiveHabit(habit: Habit) {
  selectedHabit.value = habit;
  archiveModalOpen.value = true;
}

function onHabitArchived() {
  detailSlideoverOpen.value = false;
  selectedHabit.value = null;
}

// ─── Weekly Review ────────────────────────────────────────────────────────────
const currentReflection = ref<HabitReflection | null>(null);
const reflectionLoading = ref(false);

const currentWeekKey = computed(() => getCurrentWeekKey());
const reviewWeekKey = ref(currentWeekKey.value);

const reflectionsList = ref<HabitReflection[]>([]);
const reflectionsListLoading = ref(false);
const reflectionsPage = ref(1);
const reflectionsPageSize = 12;
const reflectionsHasMore = ref(true);

const reviewWeekOptions = computed(() => {
  const items: { label: string; value: string }[] = [
    { label: `Semana atual (${currentWeekKey.value})`, value: currentWeekKey.value },
  ];

  const seen = new Set<string>([currentWeekKey.value]);
  for (const r of reflectionsList.value) {
    if (!r?.weekKey) continue;
    if (seen.has(r.weekKey)) continue;
    seen.add(r.weekKey);
    items.push({ label: `Semana ${r.weekKey}`, value: r.weekKey });
  }

  return items;
});

const reviewEditable = computed(() => reviewWeekKey.value === currentWeekKey.value);

async function loadReflectionsList(reset = false) {
  if (reflectionsListLoading.value) return;
  reflectionsListLoading.value = true;
  try {
    if (reset) {
      reflectionsPage.value = 1;
      reflectionsHasMore.value = true;
      reflectionsList.value = [];
    }

    const data = await $fetch<HabitReflection[]>("/api/habits/reflections", {
      query: {
        page: reflectionsPage.value,
        pageSize: reflectionsPageSize,
      },
    });

    const incoming = data ?? [];
    const byWeek = new Map(reflectionsList.value.map((r) => [r.weekKey, r] as const));
    for (const r of incoming) {
      if (r?.weekKey) byWeek.set(r.weekKey, r);
    }
    reflectionsList.value = Array.from(byWeek.values()).sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));

    if (incoming.length < reflectionsPageSize) {
      reflectionsHasMore.value = false;
    }
  } catch {
    reflectionsHasMore.value = false;
  } finally {
    reflectionsListLoading.value = false;
  }
}

async function onLoadMoreReflections() {
  if (!reflectionsHasMore.value) return;
  reflectionsPage.value += 1;
  await loadReflectionsList(false);
}

async function loadReflection(weekKey: string) {
  reflectionLoading.value = true;
  try {
    const data = await $fetch<HabitReflection | null>(
      "/api/habits/reflections",
      {
        query: { weekKey },
      },
    );
    currentReflection.value = data;
  } catch {
    currentReflection.value = null;
  } finally {
    reflectionLoading.value = false;
  }
}

async function onSaveWeeklyReview(payload: {
  weekKey: string;
  wins?: string;
  improvements?: string;
}) {
  const result = await saveReflection(payload);
  if (result) {
    currentReflection.value = result;
    await loadReflectionsList(true);
    return true;
  }
  return false;
}

watch(reviewWeekKey, async (wk) => {
  if (activeTab.value !== "review") return;
  await loadReflection(wk);
});

// ─── Filter options ───────────────────────────────────────────────────────────
const frequencyFilterOptions = computed(() => [
  { label: "Todas", value: ALL_FILTER_VALUE },
  ...frequencyOptions,
]);

const difficultyFilterOptions = computed(() => [
  { label: "Todas", value: ALL_FILTER_VALUE },
  ...difficultyOptions,
]);

const identityFilterOptions = computed(() => [
  { label: "Todas", value: ALL_FILTER_VALUE },
  ...(identities.value ?? []).map((i) => ({ label: i.name, value: i.id })),
]);

// Format today's date for display
const todayFormatted = computed(() => {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
});
</script>

<template>
  <UDashboardPanel id="habits">
    <template #header>
      <UDashboardNavbar title="Hábitos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
          <UButton
            label="Novo hábito"
            icon="i-lucide-plus"
            @click="createModalOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <HabitsInsightsPanel
          :insights="insights ?? null"
          :loading="insightsStatus === 'pending'"
        />

        <!-- Tabs -->
        <UTabs
          :items="tabs"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        />

        <!-- TODAY TAB -->
        <div v-if="activeTab === 'today'">
          <p class="text-sm text-muted mb-4 capitalize">
            {{ todayFormatted }}
          </p>
          <HabitsTodayList
            :habits="todayData?.habits ?? []"
            :completed-count="todayData?.completedCount ?? 0"
            :total-count="todayData?.totalCount ?? 0"
            :loading="todayStatus === 'pending'"
            @toggle="onToggleHabit"
            @select="onSelectHabit"
          />
        </div>

        <!-- ALL HABITS TAB -->
        <div v-if="activeTab === 'all'" class="space-y-4">
          <!-- Filters -->
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="listSearch"
              icon="i-lucide-search"
              placeholder="Buscar hábitos..."
              class="max-w-xs"
            />
            <USelect
              v-model="listFrequencyModel"
              :items="frequencyFilterOptions"
              value-key="value"
              placeholder="Frequência"
              class="min-w-32"
            />
            <USelect
              v-model="listDifficultyModel"
              :items="difficultyFilterOptions"
              value-key="value"
              placeholder="Dificuldade"
              class="min-w-32"
            />
          </div>

          <HabitsAllList
            :habits="listData?.data ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectHabit"
            @edit="onEditHabit"
            @archive="onArchiveHabit"
          />
        </div>

        <!-- REVIEW TAB -->
        <div v-if="activeTab === 'review'">
          <template v-if="reflectionLoading">
            <div class="space-y-4">
              <USkeleton class="h-6 w-40" />
              <USkeleton class="h-32 w-full" />
            </div>
          </template>

          <template v-else>
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <USelect
                v-model="reviewWeekKey"
                :items="reviewWeekOptions"
                value-key="value"
                class="min-w-56"
              />
              <UButton
                v-if="reflectionsHasMore"
                label="Carregar mais"
                color="neutral"
                variant="subtle"
                size="sm"
                :loading="reflectionsListLoading"
                :disabled="reflectionsListLoading"
                @click="onLoadMoreReflections"
              />
            </div>

            <HabitsWeeklyReview
              :week-key="reviewWeekKey"
              :existing-reflection="currentReflection"
              :editable="reviewEditable"
              :on-save="reviewEditable ? onSaveWeeklyReview : undefined"
            />
          </template>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <HabitsCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
    @identityModalOpen="identityModalOpen = true"
  />

  <HabitsEditModal
    v-if="selectedHabit"
    :open="editModalOpen"
    :habit="selectedHabit"
    @update:open="editModalOpen = $event"
    @updated="refreshToday()"
    @identityModalOpen="identityModalOpen = true"
  />

  <HabitsArchiveModal
    v-if="selectedHabit"
    :open="archiveModalOpen"
    :habit-id="selectedHabit.id"
    :habit-name="selectedHabit.name"
    @update:open="archiveModalOpen = $event"
    @archived="onHabitArchived"
    @identityModalOpen="identityModalOpen = true"
  />

  <HabitsDetailSlideover
    v-if="selectedHabit"
    :open="detailSlideoverOpen"
    :habit="selectedHabit"
    @update:open="detailSlideoverOpen = $event"
    @edit="editModalOpen = true"
    @archive="archiveModalOpen = true"
    @identityModalOpen="identityModalOpen = true"
  />

  <HabitsIdentityCreateModal
    :open="identityModalOpen"
    @update:open="identityModalOpen = $event"
  />
</template>
