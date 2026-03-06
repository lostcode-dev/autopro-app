<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { HabitFrequency, HabitDifficulty } from "~/types/habits";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  identityModalOpen: [value: boolean];
}>();

const {
  createHabit,
  frequencyOptions,
  difficultyOptions,
  dayOptions,
  identities,
} = useHabits();

const schema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(200),
    description: z.string().max(1000).optional(),
    frequency: z.nativeEnum(HabitFrequency).default(HabitFrequency.Daily),
    difficulty: z.nativeEnum(HabitDifficulty).default(HabitDifficulty.Normal),
    identityId: z.string().uuid().optional(),
    customDays: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .refine(
    (data) =>
      data.frequency !== HabitFrequency.Custom ||
      (data.customDays && data.customDays.length > 0),
    { message: "Selecione ao menos um dia", path: ["customDays"] },
  );

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  name: "",
  description: "",
  frequency: HabitFrequency.Daily,
  difficulty: HabitDifficulty.Normal,
  identityId: undefined,
  customDays: [],
});

const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true;
  try {
    const result = await createHabit(event.data);
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
  state.frequency = HabitFrequency.Daily;
  state.difficulty = HabitDifficulty.Normal;
  state.identityId = undefined;
  state.customDays = [];
}

function onClose() {
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

const identityItems = computed(() => {
  return [
    { label: "Nenhuma", value: "" },
    ...(identities.value ?? []).map((i) => ({ label: i.name, value: i.id })),
  ];
});
</script>

<template>
  <UModal
    :open="props.open"
    title="Novo hábito"
    description="Comece pequeno. Um passo de cada vez."
    @update:open="onClose"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Nome" name="name">
          <UInput
            v-model="state.name"
            placeholder="Ex: Ler 10 páginas"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Descrição" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Por que esse hábito é importante?"
            class="w-full"
            :rows="2"
          />
        </UFormField>

        <UFormField label="Frequência" name="frequency">
          <USelect
            v-model="state.frequency"
            :items="frequencyOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="state.frequency === HabitFrequency.Custom"
          label="Dias da semana"
          name="customDays"
        >
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="day in dayOptions"
              :key="day.value"
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
        </UFormField>

        <UFormField label="Dificuldade" name="difficulty">
          <div class="flex gap-2">
            <UButton
              v-for="opt in difficultyOptions"
              :key="opt.value"
              :label="opt.label"
              size="sm"
              :color="state.difficulty === opt.value ? 'primary' : 'neutral'"
              :variant="state.difficulty === opt.value ? 'solid' : 'outline'"
              @click="state.difficulty = opt.value"
            />
          </div>
        </UFormField>

        <div class="flex items-end gap-2">
          <UFormField label="Identidade" name="identityId">
            <USelect
              v-model="state.identityId"
              :items="identityItems"
              value-key="value"
              placeholder="Quem você quer se tornar?"
              class="w-full"
            />
          </UFormField>

           <UButton
              icon="i-lucide-user-plus"
              color="neutral"
              variant="subtle"
              size="md"
              aria-label="Gerenciar identidades"
              @click="emit('identityModalOpen', true)"
            />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="onClose"
          />
          <UButton label="Criar hábito" type="submit" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
