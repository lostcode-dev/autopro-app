<script setup lang="ts">
import { z } from "zod";
import type { FinancialCategory, Income } from "~/types/financial";

const props = defineProps<{
  open: boolean;
  categories: FinancialCategory[];
  income?: Income | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { createIncome, updateIncome } = useFinancial();

const isEdit = computed(() => !!props.income);

const schema = z.object({
  source: z.string().min(1, "Informe a fonte da receita"),
  description: z.string().optional(),
  amount: z
    .number({ error: "Informe o valor" })
    .positive("O valor deve ser positivo"),
  date: z.string().min(1, "Informe a data"),
  recurring: z.boolean(),
  recurringDay: z.number().int().min(1).max(31).optional(),
  categoryId: z.string().optional(),
});

type FormState = z.infer<typeof schema>;

const state = reactive<FormState>({
  source: "",
  description: "",
  amount: 0,
  date: new Date().toISOString().split("T")[0]!,
  recurring: false,
  recurringDay: undefined,
  categoryId: undefined,
});

const submitting = ref(false);

const categoryOptions = computed(() => [
  { label: "Sem categoria", value: "" },
  ...props.categories.map((c) => ({ label: c.name, value: c.id })),
]);

watch(
  () => props.income,
  (income) => {
    if (income) {
      state.source = income.source;
      state.description = income.description ?? "";
      state.amount = income.amount;
      state.date = income.date;
      state.recurring = income.recurring;
      state.recurringDay = income.recurringDay ?? undefined;
      state.categoryId = income.categoryId ?? undefined;
    }
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open && !props.income) {
      resetForm();
    }
  },
);

function resetForm(): void {
  state.source = "";
  state.description = "";
  state.amount = 0;
  state.date = new Date().toISOString().split("T")[0]!;
  state.recurring = false;
  state.recurringDay = undefined;
  state.categoryId = undefined;
}

async function onSubmit(): Promise<void> {
  submitting.value = true;
  try {
    const payload = {
      source: state.source,
      description: state.description || undefined,
      amount: state.amount,
      date: state.date,
      recurring: state.recurring,
      recurringDay: state.recurring ? state.recurringDay : undefined,
      categoryId: state.categoryId || undefined,
    };

    let result;
    if (isEdit.value && props.income) {
      result = await updateIncome(props.income.id, payload);
    } else {
      result = await createIncome(payload);
    }

    if (result) {
      emit("saved");
      emit("update:open", false);
      resetForm();
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold">
        {{ isEdit ? "Editar receita" : "Nova receita" }}
      </h3>
    </template>

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Fonte" name="source">
          <UInput
            v-model="state.source"
            placeholder="Ex: Salário, freelance..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Descrição" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Detalhes opcionais..."
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Valor (R$)" name="amount">
            <UInput
              v-model.number="state.amount"
              type="number"
              step="0.01"
              min="0"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Data" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Categoria" name="categoryId">
          <USelect
            v-model="state.categoryId"
            :items="categoryOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="recurring">
          <UCheckbox
            v-model="state.recurring"
            label="Receita recorrente"
            size="sm"
          />
        </UFormField>

        <UFormField
          v-if="state.recurring"
          label="Dia do mês"
          name="recurringDay"
        >
          <UInput
            v-model.number="state.recurringDay"
            type="number"
            min="1"
            max="31"
            placeholder="Ex: 5"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            icon="i-lucide-x"
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            icon="i-lucide-check"
            label="Salvar"
            :loading="submitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
