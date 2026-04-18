<script setup lang="ts">
import type { TagFilterOption } from "~/components/ui/TagFilter.vue";

const props = withDefaults(
  defineProps<{
    suppliers: Array<{ id: string; name: string }>;
    dateLabel?: string;
    statusLabel?: string;
    suppliersLabel?: string;
  }>(),
  {
    dateLabel: "Período",
    statusLabel: "Status do pagamento",
    suppliersLabel: "Fornecedores",
  },
);

const dateFrom = defineModel<string>("dateFrom");
const dateTo = defineModel<string>("dateTo");
const paymentStatus = defineModel<string[]>("paymentStatus", {
  default: () => [],
});
const supplierIds = defineModel<string[]>("supplierIds", { default: () => [] });

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? "").toUpperCase();
  return (
    (parts[0]?.charAt(0) ?? "") + (parts[parts.length - 1]?.charAt(0) ?? "")
  ).toUpperCase();
}

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
  {
    value: "overdue",
    label: "Vencido",
    color: "error",
    icon: "i-lucide-alert-triangle",
  },
];

const sortedSuppliers = computed(() =>
  [...props.suppliers].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  ),
);
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="space-y-3 grid grid-cols-2 gap-3">
      <div class="flex items-center gap-2 text-muted col-span-2">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          {{ props.dateLabel }}
        </p>
        <UiDateRangePicker
          v-model:from="dateFrom"
          v-model:to="dateTo"
          class="w-full"
        />
      </div>

      <div> </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          {{ props.statusLabel }}
        </p>
        <UiTagFilter
          v-model="paymentStatus"
          :options="paymentStatusOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          {{ props.suppliersLabel }}
        </p>
        <UiTagFilter
          v-model="supplierIds"
          :options="
            sortedSuppliers.map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
              color: 'neutral' as const,
              initials: getInitials(supplier.name),
            }))
          "
          placeholder="Selecionar"
          class="w-full"
        />
      </div>
    </div>
  </UCard>
</template>
