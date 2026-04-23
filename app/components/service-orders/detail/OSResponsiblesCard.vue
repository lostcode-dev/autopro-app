<script setup lang="ts">
import type { ServiceOrderDetailFull } from '~/types/service-orders'
import { formatCurrency } from '~/utils/service-orders'

const props = defineProps<{
  responsibleNames: ServiceOrderDetailFull['responsibleNames']
  employees: ServiceOrderDetailFull['employees']
  commissions: ServiceOrderDetailFull['commissions']
}>()

type ResponsibleInfo = {
  employee_id: string
  name: string | null
  commission_type: string | null | undefined
  commission_value: number | null | undefined
  commission_base: string | null | undefined
  has_commission: boolean
  commission_amount: number | null
}

const responsiblesInfo = computed<ResponsibleInfo[]>(() => {
  return props.responsibleNames.map((r) => {
    const emp = props.employees.find(e => e.id === r.employee_id)
    const commission = props.commissions.find(c => c.employee_id === r.employee_id)
    return {
      employee_id: r.employee_id,
      name: r.name,
      commission_type: emp?.commission_type,
      commission_value: emp?.commission_value,
      commission_base: emp?.commission_base,
      has_commission: Boolean(emp?.has_commission),
      commission_amount: commission ? Number(commission.amount) : null
    }
  })
})
</script>

<template>
  <UCard v-if="responsiblesInfo.length" variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-users" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Responsáveis ({{ responsiblesInfo.length }})
        </h3>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="assignee in responsiblesInfo"
        :key="assignee.employee_id"
        class="flex items-start justify-between gap-3 rounded-lg border border-default bg-elevated p-3"
      >
        <div class="min-w-0">
          <p class="font-medium text-highlighted truncate">
            {{ assignee.name ?? 'Funcionário não encontrado' }}
          </p>
          <p v-if="assignee.has_commission && assignee.commission_base" class="mt-0.5 text-xs text-muted">
            {{ assignee.commission_base === 'gross' ? 'Do valor total' : 'Do lucro' }}
          </p>
          <p v-else class="mt-0.5 text-xs text-muted italic">
            Sem comissão configurada
          </p>
        </div>

        <div v-if="assignee.has_commission" class="shrink-0 text-right">
          <p v-if="assignee.commission_value" class="text-sm font-medium text-warning">
            {{ assignee.commission_type === 'percentage'
              ? `${assignee.commission_value}%`
              : formatCurrency(assignee.commission_value) }}
          </p>
          <p v-if="assignee.commission_amount !== null" class="text-xs font-semibold text-success">
            = {{ formatCurrency(assignee.commission_amount) }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
