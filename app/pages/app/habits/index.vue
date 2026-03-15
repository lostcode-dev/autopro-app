<script setup lang="ts">
import type { Habit, HabitReflection, HabitTreeSyncNode } from "~/types/habits";
import { HabitLogStatus } from "~/types/habits";

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
  refreshList,
  listSearch,
  listFrequency,
  listDifficulty,
  listPageSize,
  identitiesStatus,
  refreshIdentities,
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
  refreshStacks,
  removeStacksByTrigger,
  removeStack,
  syncHabitTree,
  tagsStatus,
  refreshTags,
} = useHabits();

// ─── Active tab ───────────────────────────────────────────────────────────────
const activeTab = ref("today");

const tabs = [
  { label: "Hoje", value: "today", icon: "i-lucide-sun" },
  { label: "Todos", value: "all", icon: "i-lucide-list" },
  { label: "Revisão", value: "review", icon: "i-lucide-notebook-pen" },
  { label: "Insights", value: "insights", icon: "i-lucide-bar-chart-3" },
];

const todayDateKey = computed(
  () => todayDate.value ?? new Date().toISOString().split("T")[0]!,
);

const isViewingHistoricalToday = computed(
  () => todayDateKey.value !== new Date().toISOString().split("T")[0]!,
);

const todayStacks = computed(() => todayData.value?.stacks ?? []);

const detailStacks = computed(() => {
  if (activeTab.value === "today") {
    return todayStacks.value;
  }

  return stacks.value ?? [];
});

function ensureLoaded(
  status: Ref<"idle" | "pending" | "success" | "error">,
  refresh: () => Promise<unknown>,
) {
  if (status.value === "idle") {
    void refresh();
  }
}

// Load insights when tab is selected
watch(
  activeTab,
  (tab) => {
    if (tab === "today") {
      ensureLoaded(todayStatus, refreshToday);
      ensureLoaded(stacksStatus, refreshStacks);
    }

    if (tab === "all") {
      ensureLoaded(listStatus, refreshList);
      ensureLoaded(stacksStatus, refreshStacks);
    }

    if (tab === "review") {
      reviewWeekKey.value = reviewWeekKey.value || currentWeekKey.value;
      loadReflection(reviewWeekKey.value);
      loadReflectionsList(true);
    }

    if (tab === "insights") {
      ensureLoaded(insightsStatus, refreshInsights);
    }
  },
  { immediate: true },
);

// ─── Modals ───────────────────────────────────────────────────────────────────
const createModalOpen = ref(false);
const editModalOpen = ref(false);
const archiveModalOpen = ref(false);
const detailSlideoverOpen = ref(false);
const stackCreateModalOpen = ref(false);
const stackSourceHabit = ref<Habit | null>(null);
const selectedHabit = ref<Habit | null>(null);
const settingsModalOpen = ref(false);
const shareImageModalOpen = ref(false);
const shareImageHabit = ref<Habit | null>(null);

watch(createModalOpen, (open) => {
  if (open) {
    ensureLoaded(identitiesStatus, refreshIdentities);
    ensureLoaded(tagsStatus, refreshTags);
  }
});

watch(stackCreateModalOpen, (open) => {
  if (open) {
    ensureLoaded(listStatus, refreshList);
    ensureLoaded(stacksStatus, refreshStacks);
  }
});

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

async function onLogWithNote(
  habitId: string,
  status: HabitLogStatus,
  note: string,
) {
  const date = todayDate.value ?? new Date().toISOString().split("T")[0]!;
  const completed = status !== HabitLogStatus.Skipped;
  await logHabit({ habitId, logDate: date, completed, note, status });
  await refreshInsights();
}

function onNavigateDate(direction: "prev" | "next") {
  const current = new Date(
    (todayDate.value ?? new Date().toISOString().split("T")[0]!) + "T12:00:00",
  );
  current.setDate(current.getDate() + (direction === "next" ? 1 : -1));
  todayDate.value = current.toISOString().split("T")[0]!;
}

async function onSelectHabit(habitId: string) {
  if (activeTab.value === "today") {
    const habit = todayData.value?.habits.find((item) => item.id === habitId) ?? null;

    if (habit) {
      selectedHabit.value = habit;
      detailSlideoverOpen.value = true;
      return;
    }
  }

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
  ensureLoaded(identitiesStatus, refreshIdentities);
  ensureLoaded(tagsStatus, refreshTags);
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

async function onRemoveSingleStack(stackId: string) {
  await removeStack(stackId);
}

function onStackHabit(habit: Habit) {
  stackSourceHabit.value = habit;
  stackCreateModalOpen.value = true;
}

function onShareHabit(habit: Habit) {
  shareImageHabit.value = habit;
  shareImageModalOpen.value = true;
}

async function onSyncHabitTree(nodes: HabitTreeSyncNode[]) {
  await syncHabitTree(nodes);
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
    {
      label: `Semana atual (${currentWeekKey.value})`,
      value: currentWeekKey.value,
    },
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

const reviewEditable = computed(
  () => reviewWeekKey.value === currentWeekKey.value,
);

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
    const byWeek = new Map(
      reflectionsList.value.map((r) => [r.weekKey, r] as const),
    );
    for (const r of incoming) {
      if (r?.weekKey) byWeek.set(r.weekKey, r);
    }
    reflectionsList.value = Array.from(byWeek.values()).sort((a, b) =>
      a.weekKey < b.weekKey ? 1 : -1,
    );

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
            to="/app/habits/identity"
            icon="i-lucide-users"
            label="Identidades"
            color="neutral"
            variant="subtle"
            class="hidden sm:inline-flex"
          />
          <UButton
            icon="i-lucide-plus"
            square
            class="flex sm:hidden items-center justify-center"
            @click="createModalOpen = true"
          />
          <UButton
            label="Novo hábito"
            icon="i-lucide-plus"
            class="hidden sm:inline-flex"
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

        <!-- TODAY TAB -->
        <div v-if="activeTab === 'today'">
          <HabitsTodayList
            :habits="todayData?.habits ?? []"
            :stacks="todayStacks"
            :completed-count="todayData?.completedCount ?? 0"
            :total-count="todayData?.totalCount ?? 0"
            :loading="todayStatus === 'pending'"
            :current-date="todayDateKey"
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
              class="w-full sm:max-w-xs"
            />
            <USelect
              v-model="listFrequencyModel"
              :items="frequencyFilterOptions"
              value-key="value"
              placeholder="Frequência"
              class="min-w-0 flex-1 sm:min-w-32 sm:flex-none"
            />
            <USelect
              v-model="listDifficultyModel"
              :items="difficultyFilterOptions"
              value-key="value"
              placeholder="Dificuldade"
              class="min-w-0 flex-1 sm:min-w-32 sm:flex-none"
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
            @share="onShareHabit"
            @remove-stacks="onRemoveStack"
            @archive="onArchiveHabit"
            @sync-tree="onSyncHabitTree"
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
            <div class="ml-auto">
              <UButton
                icon="i-lucide-settings"
                label="Configurações"
                color="neutral"
                variant="subtle"
                size="sm"
                @click="settingsModalOpen = true"
              />
            </div>
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

        <!-- INSIGHTS TAB -->
        <div v-if="activeTab === 'insights'">
          <HabitsInsightsPanel
            :insights="insights ?? null"
            :loading="insightsStatus === 'pending'"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Slideover first so modals render on top -->
  <HabitsDetailSlideover
    v-if="selectedHabit"
    :open="detailSlideoverOpen"
    :habit="selectedHabit"
    :stacks="detailStacks"
    :stack-actions-disabled="activeTab === 'today' && isViewingHistoricalToday"
    @update:open="detailSlideoverOpen = $event"
    @edit="editModalOpen = true"
    @stack="onStackHabit(selectedHabit)"
    @share="
      shareImageModalOpen = true;
      shareImageHabit = selectedHabit;
    "
    @remove-stack="onRemoveSingleStack"
    @remove-stacks="onRemoveStack(selectedHabit)"
    @archive="archiveModalOpen = true"
  />

  <!-- Modals -->
  <HabitsCreateModal
    :open="createModalOpen"
    @update:open="createModalOpen = $event"
  />

  <HabitsShareImageModal
    :open="shareImageModalOpen"
    :habit="shareImageHabit"
    @update:open="shareImageModalOpen = $event"
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
  />
  <HabitsStackCreateModal
    :open="stackCreateModalOpen"
    :habits="listData?.data ?? []"
    :initial-trigger-habit-id="stackSourceHabit?.id"
    :initial-trigger-habit-name="stackSourceHabit?.name"
    @update:open="
      (value: boolean) => {
        stackCreateModalOpen = value;
        if (!value) stackSourceHabit = null;
      }
    "
    @created="() => {}"
  />

  <HabitsSettingsModal
    :open="settingsModalOpen"
    @update:open="settingsModalOpen = $event"
  />
</template>

<!--
  TO DO

  ========================
  🔢 Lógica / Regras de Negócio
  ========================

  - Revisar fluxo de "Identificadores".
    O fluxo apresenta diversos bugs, tanto relacionados a dados quanto ao layout.

  - É bom deixar somente no no forms a possibilidade de selecionar uma identidade, e fica na 
  aba das 4 leis. Deve tirar do forms o btn de  gereciar identidade, e deve ficar no lado esquerdo de novo hábito.
  Deve exibir uma view completamente diferente, como se fosse uma página separada, com um layout mais limpo e organizado.
  Com a lista de identidades, e a possibilidade' de criar, editar e excluir as identidades. 
  E quando clicar em criar ou editar, abre um modal para preencher os dados da identidade.

  ========================
  🎨 Interface / UX
  ========================

  - Melhorar a área de Insights:
    - Atualmente há muito espaço vazio.
    - Incluir mais informações relevantes para o usuário.
    - Tornar a seção totalmente responsiva.

  - Permitir seleção de múltiplas frequências no formulário de hábitos.
    Atualmente só é possível selecionar uma frequência, mas muitos hábitos ocorrem em múltiplos dias da semana.

  - Melhorar o campo de horário do hábito.
    O objetivo é permitir que o usuário utilize o horário como referência na agenda diária.

  - Personalizar o scroll da aplicação para manter consistência visual com o design do app.

  - Corrigir o HourPicker dentro do modal.
    Atualmente ele está abrindo atrás do modal.

  ========================
  🔐 Autenticação / Sessão
  ========================

  - Investigar problema de logout inesperado.
    O usuário está sendo deslogado ocasionalmente sem motivo aparente.

  - Corrigir persistência de sessão.
    O sistema está exigindo login com muita frequência, indicando que a sessão não está sendo armazenada corretamente.

  ========================
   🏷️ Organização / Estrutura
  ========================

  - Adicionar suporte a tags nos hábitos.
    Isso permitirá melhor organização, categorização e filtragem.

  - Permitir seleção de um emoji como avatar do hábito.
    Isso facilita identificação visual e personalização da lista de hábitos.

 ========================
  🔔 Notificações
  ========================

  - Implementar notificações para alertar o usuário sobre hábitos.
    Agora que a API com Cron já existe, é possível evoluir esse fluxo.

  - Avaliar outros canais de notificação além do sistema web.
    Possibilidades:
      - Push notifications (mobile / PWA)
      - Notificações do navegador
      - E-mail
      - Integrações futuras

  ========================
  🚀 Onboarding
  ========================

  - Criar um fluxo de onboarding para novos usuários.
    O objetivo é guiar o usuário nas primeiras ações dentro da aplicação,
    como criação do primeiro hábito e entendimento da lógica de funcionamento.

  - Avaliar qual ferramenta utilizar para implementação do onboarding.

  ========================
  📊 Analytics / Product Insights
  ========================

  - Integrar o PostHog para monitorar comportamento dos usuários dentro da aplicação.

    Exemplos de métricas:
      - cliques
      - telas visitadas
      - fluxo de navegação
      - ações realizadas nos hábitos

    O tracking deve rodar apenas em produção para evitar poluição de dados com eventos de desenvolvimento.
 -->

 <!--

 Backlog:

 - Preciso saber os dias, o período que é a da revisão. Porque somente pela semana, é fácil para o usuário se perder no que está avaliando.
  - Notificação para lembrar de fazer a revisão.

  - No Mobile o menu está ficando como se estivesse fechado.
  - Não consigo ver o fundo de qualquer página.
  - ⁠Mudar  o comportamento quando é mobile em hábitos, checkbox pequeno e fica sem espaço para ficar empilhado
   
  - Remover a identidade da listagem, é um conteúdo grande para ficar exibindo, pode ser usado em notificações, e para entender melhor sobre o hábito.
 -->
