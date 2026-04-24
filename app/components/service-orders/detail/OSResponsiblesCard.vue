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

const totalCommissionAmount = computed(() =>
  responsiblesInfo.value.reduce(
    (total, responsible) => total + Number(responsible.commission_amount ?? 0),
    0
  )
)

function getResponsibleRateLabel(assignee: ResponsibleInfo) {
  if (!assignee.has_commission || assignee.commission_value == null) return null

  return assignee.commission_type === 'percentage'
    ? `${assignee.commission_value}%`
    : formatCurrency(assignee.commission_value)
}

function getResponsibleBaseLabel(assignee: ResponsibleInfo) {
  if (!assignee.has_commission) return null

  return assignee.commission_base === 'profit'
    ? 'Base: lucro'
    : 'Base: faturamento'
}

function getResponsibleCommissionNote(assignee: ResponsibleInfo) {
  if (assignee.has_commission) return null

  return {
    label: 'Sem comissão',
    color: 'neutral' as const,
    icon: 'i-lucide-circle-off'
  }
}
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-round-cog" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Responsáveis e comissão
        </h3>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-if="!responsiblesInfo.length"
        class="rounded-xl border border-dashed border-default bg-elevated/40 px-4 py-8 text-center"
      >
        <UIcon
          name="i-lucide-users-round"
          class="mx-auto size-8 text-dimmed"
        />
        <p class="mt-3 text-sm font-medium text-highlighted">
          Nenhum responsável adicionado
        </p>
        <p class="mt-1 text-sm text-muted">
          Esta OS não possui responsáveis vinculados.
        </p>
      </div>

      <div
        v-for="assignee in responsiblesInfo"
        :key="assignee.employee_id"
        class="rounded-xl border border-default bg-default p-4 shadow-xs"
      >
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div class="min-w-0 flex-1">
            <div class="rounded-xl border border-default bg-default px-3 py-2 text-sm text-highlighted">
              {{ assignee.name ?? 'Funcionário não encontrado' }}
            </div>

            <div
              class="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-elevated/60 px-3 py-2 text-sm lg:flex-nowrap"
            >
              <UBadge
                color="primary"
                variant="soft"
                leading-icon="i-lucide-wallet-cards"
                :label="`Comissão: ${formatCurrency(assignee.commission_amount)}`"
              />
              <UBadge
                v-if="getResponsibleRateLabel(assignee)"
                color="success"
                variant="subtle"
                leading-icon="i-lucide-badge-percent"
                :label="getResponsibleRateLabel(assignee)"
              />
              <UBadge
                v-if="getResponsibleBaseLabel(assignee)"
                color="neutral"
                variant="outline"
                leading-icon="i-lucide-scale"
                :label="getResponsibleBaseLabel(assignee)"
              />
              <UTooltip
                v-if="getResponsibleCommissionNote(assignee)"
                :text="getResponsibleCommissionNote(assignee)?.label"
              >
                <UButton
                  :color="getResponsibleCommissionNote(assignee)?.color ?? 'neutral'"
                  variant="ghost"
                  :icon="getResponsibleCommissionNote(assignee)?.icon"
                  size="xs"
                  square
                />
              </UTooltip>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="responsiblesInfo.length"
        class="rounded-xl border border-success/20 bg-success/10 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-success/80">
          Total de comissão estimada
        </p>
        <p class="mt-1 text-lg font-semibold text-success">
          {{ formatCurrency(totalCommissionAmount) }}
        </p>
      </div>
    </div>
  </UCard>
</template>
