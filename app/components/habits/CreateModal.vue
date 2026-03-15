<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { HabitFrequency, HabitDifficulty, HabitType } from "~/types/habits";

const RICH_TEXT_MAX_LENGTH = 10000;

const formTabItems = [
  { label: "Principal", value: "main", icon: "i-lucide-clipboard-list" },
  { label: "Agendamento", value: "schedule", icon: "i-lucide-clock-3" },
  { label: "4 leis", value: "strategy", icon: "i-lucide-layers-3" },
];

const FORM_ID = "habit-create-form";
const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_ONLY = [1, 2, 3, 4, 5];
const WEEKEND_ONLY = [0, 6];

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const {
  createHabit,
  difficultyOptions,
  habitTypeOptions,
  dayOptions,
  identities,
  tags,
} = useHabits();

const schema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(200),
    description: z.string().max(RICH_TEXT_MAX_LENGTH).optional(),
    obviousStrategy: z.string().max(RICH_TEXT_MAX_LENGTH).optional(),
    attractiveStrategy: z.string().max(RICH_TEXT_MAX_LENGTH).optional(),
    easyStrategy: z.string().max(RICH_TEXT_MAX_LENGTH).optional(),
    satisfyingStrategy: z.string().max(RICH_TEXT_MAX_LENGTH).optional(),
    difficulty: z.nativeEnum(HabitDifficulty).default(HabitDifficulty.Normal),
    habitType: z.nativeEnum(HabitType).default(HabitType.Positive),
    identityId: z.string().uuid().optional(),
    customDays: z.array(z.number().int().min(0).max(6)).min(1, "Selecione ao menos um dia"),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm').optional(),
    scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm').optional(),
  });

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  name: "",
  description: "",
  obviousStrategy: "",
  attractiveStrategy: "",
  easyStrategy: "",
  satisfyingStrategy: "",
  difficulty: HabitDifficulty.Normal,
  habitType: HabitType.Positive,
  identityId: undefined,
  customDays: [...ALL_WEEK_DAYS],
  scheduledTime: undefined,
  scheduledEndTime: undefined,
});

const loading = ref(false);
const activeFormTab = ref("main");
const selectedTagIds = ref<string[]>([]);

watch(
  () => props.open,
  (open) => {
    if (!open) activeFormTab.value = "main";
  },
);

const NONE_IDENTITY_VALUE = "__none__";

const identityIdModel = computed<string | undefined>({
  get: () => state.identityId,
  set: (value) => {
    state.identityId = value === NONE_IDENTITY_VALUE ? undefined : value;
  },
});

function normalizeRichText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value) return;
  loading.value = true;
  try {
    const frequencySelection = normalizeFrequencySelection(event.data.customDays);
    const result = await createHabit({
      description: normalizeRichText(event.data.description),
      obviousStrategy: normalizeRichText(event.data.obviousStrategy),
      attractiveStrategy: normalizeRichText(event.data.attractiveStrategy),
      easyStrategy: normalizeRichText(event.data.easyStrategy),
      satisfyingStrategy: normalizeRichText(event.data.satisfyingStrategy),
      name: event.data.name,
      difficulty: event.data.difficulty,
      habitType: event.data.habitType,
      identityId: event.data.identityId,
      frequency: frequencySelection.frequency,
      customDays: frequencySelection.customDays,
      scheduledTime: event.data.scheduledTime || undefined,
      scheduledEndTime: event.data.scheduledEndTime || undefined,
      tagIds: selectedTagIds.value.length > 0 ? selectedTagIds.value : undefined,
    });
    if (result) {
      resetForm();
      emit("update:open", false);
    }
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  state.name = "";
  state.description = "";
  state.obviousStrategy = "";
  state.attractiveStrategy = "";
  state.easyStrategy = "";
  state.satisfyingStrategy = "";
  state.difficulty = HabitDifficulty.Normal;
  state.habitType = HabitType.Positive;
  state.identityId = undefined;
  state.customDays = [...ALL_WEEK_DAYS];
  state.scheduledTime = undefined;
  state.scheduledEndTime = undefined;
  selectedTagIds.value = [];
  activeFormTab.value = "main";
}

function onClose() {
  activeFormTab.value = "main";
  emit("update:open", false);
}

function toggleDay(day: number) {
  if (!state.customDays) state.customDays = [];
  const idx = state.customDays.indexOf(day);
  if (idx >= 0) {
    state.customDays.splice(idx, 1);
  } else {
    state.customDays.push(day);
  }
}

function setSelectedDays(days: number[]) {
  state.customDays = [...days].sort((a, b) => a - b);
}

function normalizeFrequencySelection(days: number[]) {
  const uniqueDays = [...new Set(days)].sort((a, b) => a - b);

  if (uniqueDays.length === ALL_WEEK_DAYS.length) {
    return {
      frequency: HabitFrequency.Daily,
      customDays: undefined,
    };
  }

  return {
    frequency: HabitFrequency.Custom,
    customDays: uniqueDays,
  };
}

const selectedDaysSummary = computed(() => {
  const selectedDays = state.customDays ?? [];

  if (selectedDays.length === ALL_WEEK_DAYS.length) {
    return "Todos os dias";
  }

  if (selectedDays.length === WEEKDAY_ONLY.length && WEEKDAY_ONLY.every((day) => selectedDays.includes(day))) {
    return "Dias úteis";
  }

  if (selectedDays.length === WEEKEND_ONLY.length && WEEKEND_ONLY.every((day) => selectedDays.includes(day))) {
    return "Fim de semana";
  }

  return selectedDays.map((day) => dayOptions.find((option) => option.value === day)?.label ?? "").filter(Boolean).join(", ");
});

const identityItems = computed(() => {
  return [
    { label: "Nenhuma", value: NONE_IDENTITY_VALUE },
    ...(identities.value ?? []).map((i) => ({ label: i.name, value: i.id })),
  ];
});

watch(
  identities,
  (items) => {
    if (!state.identityId) return;
    const exists = (items ?? []).some((identity) => identity.id === state.identityId);
    if (!exists) {
      state.identityId = undefined;
    }
  },
  { deep: false },
);

function getHabitDifficultyIcon(difficulty: HabitDifficulty) {
  switch (difficulty) {
    case HabitDifficulty.Tiny:
      return "i-lucide-feather";
    case HabitDifficulty.Normal:
      return "i-lucide-shield";
    case HabitDifficulty.Hard:
      return "i-lucide-mountain";
    default:
      return "";
  }
}

function getHabitTypeIcon(habitType: HabitType) {
  switch (habitType) {
    case HabitType.Positive:
      return "i-lucide-thumbs-up";
    case HabitType.Negative:
      return "i-lucide-thumbs-down";
    default:
      return "";
  }
}
</script>

<template>
  <UModal
    :open="props.open"
    scrollable
    title="Novo hábito"
    description="Comece pequeno. Um passo de cada vez."
    :ui="{
      overlay: 'z-[200] bg-elevated/75',
      content: 'z-[210] w-[calc(100vw-2rem)] max-w-4xl overflow-visible'
    }"
    @update:open="onClose"
  >
    <template #body>
      <UForm
        :id="FORM_ID"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
          <UTabs
            v-model="activeFormTab"
            :items="formTabItems"
            color="neutral"
            class="w-full"
            :ui="{
              list: 'inline-flex rounded-lg ring ring-default p-1',
              indicator: 'rounded-md',
            }"
          />

          <div v-if="activeFormTab === 'main'" class="space-y-4">
            <UFormField label="Nome" name="name">
              <UInput
                v-model="state.name"
                placeholder="Ex: Ler 10 páginas"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Descrição" name="description">
              <RichTextEditor
                v-model="state.description"
                placeholder="Por que esse hábito é importante?"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Dias do hábito"
              name="customDays"
            >
              <div class="space-y-3">
                <div class="flex flex-wrap gap-2">
                  <UButton
                    type="button"
                    label="Todos os dias"
                    size="sm"
                    color="neutral"
                    variant="subtle"
                    @click="setSelectedDays(ALL_WEEK_DAYS)"
                  />
                  <UButton
                    type="button"
                    label="Dias úteis"
                    size="sm"
                    color="neutral"
                    variant="subtle"
                    @click="setSelectedDays(WEEKDAY_ONLY)"
                  />
                  <UButton
                    type="button"
                    label="Fim de semana"
                    size="sm"
                    color="neutral"
                    variant="subtle"
                    @click="setSelectedDays(WEEKEND_ONLY)"
                  />
                </div>

                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="day in dayOptions"
                    :key="day.value"
                    type="button"
                    :label="day.label"
                    size="sm"
                    :color="
                      state.customDays?.includes(day.value) ? 'primary' : 'neutral'
                    "
                    :variant="
                      state.customDays?.includes(day.value) ? 'solid' : 'outline'
                    "
                    @click="toggleDay(day.value)"
                  />
                </div>

                <p class="text-sm text-muted">
                  {{ selectedDaysSummary || "Nenhum dia selecionado" }}
                </p>
              </div>
            </UFormField>

            <div class="space-y-4">
              <UFormField label="Dificuldade" name="difficulty">
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="opt in difficultyOptions"
                    :key="opt.value"
                    type="button"
                    :label="opt.label"
                    :icon="getHabitDifficultyIcon(opt.value)"
                    size="sm"
                    :color="state.difficulty === opt.value ? 'primary' : 'neutral'"
                    :variant="state.difficulty === opt.value ? 'solid' : 'outline'"
                    @click="state.difficulty = opt.value"
                  />
                </div>
              </UFormField>

              <UFormField label="Tipo" name="habitType">
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="opt in habitTypeOptions"
                    :key="opt.value"
                    type="button"
                    :label="opt.label"
                    :icon="getHabitTypeIcon(opt.value)"
                    size="sm"
                    :color="state.habitType === opt.value ? (opt.value === HabitType.Positive ? 'success' : 'error') : 'neutral'"
                    :variant="state.habitType === opt.value ? 'solid' : 'outline'"
                    @click="state.habitType = opt.value"
                  />
                </div>
              </UFormField>
            </div>

            <UFormField label="Tags" name="tags">
              <USelectMenu
                v-model="selectedTagIds"
                :items="(tags ?? []).map(t => ({ label: t.name, value: t.id }))"
                value-key="value"
                placeholder="Selecione tags..."
                multiple
                class="w-full"
              />
            </UFormField>
          </div>

          <div v-else-if="activeFormTab === 'schedule'" class="space-y-5">
            <UCard>
              <div class="space-y-2">
                <p class="text-sm font-medium text-highlighted">
                  Referência para sua agenda
                </p>
                <p class="text-sm text-muted">
                  Defina um horário para o hábito aparecer como guia do seu dia. Isso ajuda a organizar a rotina sem transformar o hábito em compromisso rígido.
                </p>
              </div>
            </UCard>

            <div class="grid gap-4 lg:grid-cols-2">
              <UFormField
                label="Horário de início"
                name="scheduledTime"
                description="Momento ideal para começar esse hábito."
              >
                <UiTimePicker
                  v-model="state.scheduledTime"
                  placeholder="Selecione o início"
                />
              </UFormField>

              <UFormField
                label="Horário de término"
                name="scheduledEndTime"
                description="Opcional. Use quando o hábito tiver janela de execução."
              >
                <UiTimePicker
                  v-model="state.scheduledEndTime"
                  placeholder="Selecione o término"
                />
              </UFormField>
            </div>

            <UCard>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm font-medium text-highlighted">
                    Resumo do agendamento
                  </p>
                  <p class="text-sm text-muted">
                    Visualização rápida de como o hábito vai aparecer na agenda.
                  </p>
                </div>

                <UBadge color="neutral" variant="subtle" size="lg">
                  {{
                    state.scheduledTime
                      ? state.scheduledEndTime
                        ? `${state.scheduledTime} - ${state.scheduledEndTime}`
                        : state.scheduledTime
                      : "Sem horário definido"
                  }}
                </UBadge>
              </div>
            </UCard>
          </div>

          <div v-else class="space-y-4">
            <UFormField label="Identidade" name="identityId">
              <USelect
                v-model="identityIdModel"
                :items="identityItems"
                value-key="value"
                placeholder="Quem você quer se tornar?"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Tornar Óbvio" name="obviousStrategy">
              <RichTextEditor
                v-model="state.obviousStrategy"
                placeholder="Como esse hábito vai ficar visível no seu ambiente e na sua rotina?"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Tornar Atraente" name="attractiveStrategy">
              <RichTextEditor
                v-model="state.attractiveStrategy"
                placeholder="O que pode tornar esse hábito mais desejável ou prazeroso?"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Tornar Fácil" name="easyStrategy">
              <RichTextEditor
                v-model="state.easyStrategy"
                placeholder="Como reduzir atrito e deixar a ação mais simples de começar?"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Tornar Satisfatório" name="satisfyingStrategy">
              <RichTextEditor
                v-model="state.satisfyingStrategy"
                placeholder="Qual recompensa imediata vai reforçar a repetição desse hábito?"
                class="w-full"
              />
            </UFormField>
          </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          icon="i-lucide-x"
          label="Cancelar"
          type="button"
          color="neutral"
          variant="subtle"
          @click="onClose"
        />
        <UButton
          icon="i-lucide-check"
          label="Salvar"
          type="submit"
          :form="FORM_ID"
          :loading="loading"
          :disabled="loading"
        />
      </div>
    </template>
  </UModal>
</template>
