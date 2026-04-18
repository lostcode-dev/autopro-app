<script setup lang="ts">
import type { TagFilterOption } from "~/components/ui/TagFilter.vue";

const props = withDefaults(
  defineProps<{
    dateLabel?: string;
    orderStatusLabel?: string;
    paymentStatusLabel?: string;
  }>(),
  {
    dateLabel: "Período",
    orderStatusLabel: "Status da OS",
    paymentStatusLabel: "Pagamento",
  },
);

const dateFrom = defineModel<string>("dateFrom");
const dateTo = defineModel<string>("dateTo");
const orderStatusFilters = defineModel<string[]>("orderStatusFilters", {
  default: () => [],
});
const paymentStatusFilters = defineModel<string[]>("paymentStatusFilters", {
  default: () => [],
});

const orderStatusOptions: TagFilterOption[] = [
  {
    value: "open",
    label: "Aberta",
    color: "info",
    icon: "i-lucide-circle-dot",
  },
  {
    value: "in_progress",
    label: "Em andamento",
    color: "warning",
    icon: "i-lucide-wrench",
  },
  {
    value: "waiting_for_part",
    label: "Aguard. peça",
    color: "warning",
    icon: "i-lucide-package-search",
  },
  {
    value: "completed",
    label: "Concluída",
    color: "success",
    icon: "i-lucide-check-circle-2",
  },
  {
    value: "delivered",
    label: "Entregue",
    color: "success",
    icon: "i-lucide-truck",
  },
  {
    value: "estimate",
    label: "Orçamento",
    color: "neutral",
    icon: "i-lucide-file-text",
  },
];

const paymentStatusOptions: TagFilterOption[] = [
  {
    value: "pending",
    label: "Pendente",
    color: "warning",
    icon: "i-lucide-clock",
  },
  {
    value: "paid",
    label: "Pago",
    color: "success",
    icon: "i-lucide-circle-check",
  },
  { value: "partial", label: "Parcial", color: "info", icon: "i-lucide-split" },
];
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="space-y-3 grid grid-cols-2 gap-3">
      <div class="flex items-center gap-2 text-muted col-span-2">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>
      <div class="w-full">
        <p class="mb-1 text-xs font-medium text-muted">{{ props.dateLabel }}</p>
        <UiDateRangePicker
          v-model:from="dateFrom"
          v-model:to="dateTo"
          class="w-full"
        />
      </div>
      <div></div>
      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          {{ props.orderStatusLabel }}
        </p>
        <UiTagFilter
          v-model="orderStatusFilters"
          :options="orderStatusOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          {{ props.paymentStatusLabel }}
        </p>
        <UiTagFilter
          v-model="paymentStatusFilters"
          :options="paymentStatusOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>
    </div>
  </UCard>
</template>
