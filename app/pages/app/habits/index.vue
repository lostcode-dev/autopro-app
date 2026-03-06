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
    loadReflection();
  }
});

// ─── Modals ───────────────────────────────────────────────────────────────────
const createModalOpen = ref(false);
const editModalOpen = ref(false);
const archiveModalOpen = ref(false);
const detailSlideoverOpen = ref(false);
const identityModalOpen = ref(false);
const selectedHabit = ref<Habit | null>(null);

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

async function loadReflection() {
  reflectionLoading.value = true;
  try {
    const weekKey = getCurrentWeekKey();
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

// ─── Filter options ───────────────────────────────────────────────────────────
const frequencyFilterOptions = computed(() => [
  { label: "Todas", value: "" },
  ...frequencyOptions,
]);

const difficultyFilterOptions = computed(() => [
  { label: "Todas", value: "" },
  ...difficultyOptions,
]);

const identityFilterOptions = computed(() => [
  { label: "Todas", value: "" },
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
              v-model="listFrequency"
              :items="frequencyFilterOptions"
              value-key="value"
              placeholder="Frequência"
              class="min-w-32"
            />
            <USelect
              v-model="listDifficulty"
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
          <HabitsWeeklyReview v-else :existing-reflection="currentReflection" />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <HabitsCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
  />

  <HabitsEditModal
    v-if="selectedHabit"
    :open="editModalOpen"
    :habit="selectedHabit"
    @update:open="editModalOpen = $event"
    @updated="refreshToday()"
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
