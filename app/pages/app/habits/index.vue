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
  stacks,
  stacksStatus,
  removeStacksByTrigger,
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
const stackCreateModalOpen = ref(false);
const stackSourceHabit = ref<Habit | null>(null);
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
  const date = todayDate.value ?? new Date().toISOString().split("T")[0]!;
  await logHabit({ habitId, logDate: date, completed });
  await refreshInsights();
}

async function onLogWithNote(habitId: string, completed: boolean, note: string) {
  const date = todayDate.value ?? new Date().toISOString().split("T")[0]!;
  await logHabit({ habitId, logDate: date, completed, note });
  await refreshInsights();
}

function onNavigateDate(direction: "prev" | "next") {
  const current = new Date((todayDate.value ?? new Date().toISOString().split("T")[0]!) + "T12:00:00");
  current.setDate(current.getDate() + (direction === "next" ? 1 : -1));
  todayDate.value = current.toISOString().split("T")[0]!;
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

// ─── Stacking actions ─────────────────────────────────────────────────────────
async function onRemoveStack(habit: Habit) {
  await removeStacksByTrigger(habit.id, habit.name);
}

function onStackHabit(habit: Habit) {
  stackSourceHabit.value = habit;
  stackCreateModalOpen.value = true;
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

/** Navigate week for review */
function navigateReviewWeek(direction: "prev" | "next") {
  const match = reviewWeekKey.value.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return;
  let year = parseInt(match[1]!);
  let week = parseInt(match[2]!);
  if (direction === "prev") {
    week--;
    if (week < 1) {
      year--;
      week = 52;
    }
  } else {
    week++;
    if (week > 52) {
      year++;
      week = 1;
    }
  }
  reviewWeekKey.value = `${year}-W${String(week).padStart(2, "0")}`;
}

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

const _identityFilterOptions = computed(() => [
  { label: "Todas", value: ALL_FILTER_VALUE },
  ...(identities.value ?? []).map((i) => ({ label: i.name, value: i.id })),
]);
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
          <HabitsTodayList
            :habits="todayData?.habits ?? []"
            :stacks="stacks ?? []"
            :completed-count="todayData?.completedCount ?? 0"
            :total-count="todayData?.totalCount ?? 0"
            :loading="todayStatus === 'pending'"
            :current-date="todayDate ?? new Date().toISOString().split('T')[0]!"
            @toggle="onToggleHabit"
            @select="onSelectHabit"
            @log-with-note="onLogWithNote"
            @navigate-date="onNavigateDate"
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
            :stacks="stacks ?? []"
            :total="listData?.total ?? 0"
            :page="listPage"
            :page-size="listPageSize"
            :loading="listStatus === 'pending'"
            @update:page="listPage = $event"
            @select="onSelectHabit"
            @edit="onEditHabit"
            @stack="onStackHabit"
            @remove-stacks="onRemoveStack"
            @archive="onArchiveHabit"
          />
        </div>

        <!-- REVIEW TAB -->
        <div v-if="activeTab === 'review'">
          <!-- Week selector dropdown -->
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
              icon="i-lucide-download"
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
            :loading="reflectionLoading"
            :on-save="reviewEditable ? onSaveWeeklyReview : undefined"
            @navigate-week="navigateReviewWeek"
          />
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
  />

  <HabitsDetailSlideover
    v-if="selectedHabit"
    :open="detailSlideoverOpen"
    :habit="selectedHabit"
    :stacks="stacks ?? []"
    @update:open="detailSlideoverOpen = $event"
    @edit="editModalOpen = true"
    @stack="onStackHabit(selectedHabit)"
    @remove-stacks="onRemoveStack(selectedHabit)"
    @archive="archiveModalOpen = true"
  />

  <HabitsIdentityCreateModal
    :open="identityModalOpen"
    @update:open="identityModalOpen = $event"
  />

  <HabitsStackCreateModal
    :open="stackCreateModalOpen"
    :habits="listData?.data ?? []"
    :initial-trigger-habit-id="stackSourceHabit?.id"
    :initial-trigger-habit-name="stackSourceHabit?.name"
    @update:open="(value: boolean) => { stackCreateModalOpen = value; if (!value) stackSourceHabit = null; }"
    @created="() => {}"
  />
</template>

<!--
  DONE:
   ✅ Adicionar icons para dificuldade e frequência, mapeado em enum (DIFFICULTY_META, FREQUENCY_META, HABIT_TYPE_META)
   ✅ Sem tabs em Detalhes: visão geral + calendário juntos, icons em streak
   ✅ Revisão com setas para navegar entre semanas + dropdown + loading skeleton
   ✅ Padrão nos botões: icon + "Salvar", "Cancelar" com icon
   ✅ Em "todos", exibir dias personalizados quando frequência é custom
   ✅ Rastrear mudanças de dificuldade/frequência/identidade (habit_change_history table + API)
   ✅ Hábitos positivos/negativos com indicador visual (cores/ícones)
   ✅ Navegar entre dias na tab de Hoje
   ✅ Adicionar observação ao marcar como feito/não feito
   ✅ Futuro no calendário não mostra status de feito/não feito

  TODO (futuras iterações):
   - Escolher dia da semana para revisão (configurável por usuário)
   - Notificações/lembretes para revisão
   - Compartilhar hábitos e progresso
   - Definir ordem de execução dos hábitos (sort_order já está no DB)
   - "Feito mais tarde" como status específico
   - Responsividade avançada para mobile (já usa Tailwind/flex-wrap)
   - Transformar o Create Habits in multi step, onde cada step guia o usuário atráves das 4 leis dos hábitos (gatilho, rotina, recompensa, crença)
-->