<script setup lang="ts">
import { formatCurrency } from '~/utils/service-orders'

interface TaxItem { id: string, name: string, type: string, rate: number }
interface SelectedTax { tax_id: string, calculated_amount: number }

const props = defineProps<{
  applyTaxes: boolean
  selectedTaxIds: string[]
  taxesCatalog: TaxItem[]
  selectedTaxes: SelectedTax[]
  totalTaxesAmount: number
  isEditMode: boolean
  createAppointment: boolean
  appointmentDate: string | undefined
  appointmentTime: string
  appointmentPriority: string
  appointmentNotes: string
}>()

const emit = defineEmits<{
  'update:applyTaxes': [v: boolean]
  'update:selectedTaxIds': [v: string[]]
  'update:createAppointment': [v: boolean]
  'update:appointmentDate': [v: string | undefined]
  'update:appointmentTime': [v: string]
  'update:appointmentPriority': [v: string]
  'update:appointmentNotes': [v: string]
}>()

const APPOINTMENT_NO_PRIORITY = 'none'

const appointmentPriorityOptions = [
  { label: 'Sem prioridade', value: APPOINTMENT_NO_PRIORITY },
  { label: 'Baixa', value: 'low' },
  { label: 'Média', value: 'medium' },
  { label: 'Alta', value: 'high' }
]

const appointmentPriorityMeta: Record<string, { label: string, icon: string, color: 'neutral' | 'info' | 'warning' }> = {
  [APPOINTMENT_NO_PRIORITY]: { label: 'Sem prioridade', icon: 'i-lucide-minus', color: 'neutral' },
  low: { label: 'Baixa', icon: 'i-lucide-arrow-down', color: 'neutral' },
  medium: { label: 'Média', icon: 'i-lucide-equal', color: 'info' },
  high: { label: 'Alta', icon: 'i-lucide-arrow-up', color: 'warning' }
}

const appointmentPriorityBadge = computed(
  () => appointmentPriorityMeta[props.appointmentPriority] ?? appointmentPriorityMeta[APPOINTMENT_NO_PRIORITY]!
)

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toggleTax(taxId: string) {
  const newIds = props.selectedTaxIds.includes(taxId)
    ? props.selectedTaxIds.filter(id => id !== taxId)
    : [...props.selectedTaxIds, taxId]
  emit('update:selectedTaxIds', newIds)
}

function getTaxCalculatedAmount(taxId: string) {
  return props.selectedTaxes.find(t => t.tax_id === taxId)?.calculated_amount ?? 0
}
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-settings-2" class="size-4 text-primary/70" />
        <h3 class="font-semibold text-highlighted">
          Configurações
        </h3>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- Taxes -->
      <div v-if="!isEditMode" class="space-y-4 rounded-2xl border border-default bg-elevated/30 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 pr-2">
            <p class="flex items-center gap-2 text-sm font-medium text-highlighted">
              <UIcon name="i-lucide-percent" class="size-4 text-primary" />
              Impostos
            </p>
            <p class="text-xs text-muted">
              Entram como custo interno da OS.
            </p>
          </div>
          <USwitch
            :model-value="applyTaxes"
            @update:model-value="emit('update:applyTaxes', $event)"
          />
        </div>

        <div v-if="applyTaxes" class="space-y-3">
          <div
            v-if="!taxesCatalog.length"
            class="rounded-xl border border-dashed border-default bg-default/70 px-4 py-5 text-center"
          >
            <UIcon name="i-lucide-percent-diamond" class="mx-auto size-6 text-dimmed" />
            <p class="mt-2 text-sm font-medium text-highlighted">
              Nenhum imposto cadastrado
            </p>
          </div>

          <button
            v-for="tax in taxesCatalog"
            :key="tax.id"
            type="button"
            class="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition"
            :class="selectedTaxIds.includes(tax.id)
              ? 'border-primary/40 bg-primary/8'
              : 'border-default bg-default hover:bg-elevated/50'"
            @click="toggleTax(tax.id)"
          >
            <div class="flex items-start gap-3">
              <input
                type="checkbox"
                class="mt-0.5 size-4"
                :checked="selectedTaxIds.includes(tax.id)"
                @click.stop="toggleTax(tax.id)"
              >
              <div>
                <p class="font-medium text-highlighted">
                  {{ tax.name }}
                </p>
                <p class="text-xs uppercase tracking-wide text-muted">
                  {{ tax.type }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-semibold text-highlighted">
                {{ toNumber(tax.rate).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }}%
              </p>
              <p v-if="selectedTaxIds.includes(tax.id)" class="text-xs text-warning">
                {{ formatCurrency(getTaxCalculatedAmount(tax.id)) }}
              </p>
            </div>
          </button>

          <div class="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-warning/80">
              Total de impostos
            </p>
            <p class="mt-1 text-base font-semibold text-warning">
              {{ formatCurrency(totalTaxesAmount) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Appointment -->
      <div class="space-y-4 rounded-2xl border border-default bg-elevated/30 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 pr-2">
            <p class="flex items-center gap-2 text-sm font-medium text-highlighted">
              <UIcon name="i-lucide-calendar-clock" class="size-4 text-primary/70" />
              Agendamento
            </p>
            <p class="text-xs text-muted">
              Cria agenda automaticamente ao salvar.
            </p>
          </div>
          <USwitch
            :model-value="createAppointment"
            @update:model-value="emit('update:createAppointment', $event)"
          />
        </div>

        <div v-if="createAppointment" class="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UFormField label="Data" required>
              <UiDatePicker
                :model-value="appointmentDate"
                placeholder="Selecione a data"
                class="w-full"
                @update:model-value="emit('update:appointmentDate', $event as string | undefined)"
              />
            </UFormField>
            <UFormField label="Horário" required>
              <UInput
                :model-value="appointmentTime"
                type="time"
                class="w-full"
                @update:model-value="emit('update:appointmentTime', String($event ?? ''))"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <UFormField label="Prioridade">
              <USelectMenu
                :model-value="appointmentPriority"
                :items="appointmentPriorityOptions"
                value-key="value"
                class="w-full"
                :search-input="false"
                @update:model-value="emit('update:appointmentPriority', String($event ?? APPOINTMENT_NO_PRIORITY))"
              />
            </UFormField>
            <div class="flex items-end">
              <UBadge
                :color="appointmentPriorityBadge.color"
                variant="subtle"
                :leading-icon="appointmentPriorityBadge.icon"
                :label="appointmentPriorityBadge.label"
                class="mb-0.5"
              />
            </div>
          </div>

          <UFormField label="Observações">
            <UTextarea
              :model-value="appointmentNotes"
              :rows="2"
              placeholder="Detalhes adicionais para a agenda..."
              class="w-full"
              @update:model-value="emit('update:appointmentNotes', String($event ?? ''))"
            />
          </UFormField>
        </div>
      </div>
    </div>
  </UCard>
</template>
