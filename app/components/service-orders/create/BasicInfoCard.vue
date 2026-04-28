<script setup lang="ts">
interface SelectOption { label: string; value: string }
interface MasterProductDisplay { name: string; description?: string | null }

defineProps<{
  number: string
  status: string
  clientId: string
  vehicleId: string
  masterProductId: string
  entryDate: string | undefined
  expectedDate: string | undefined
  clientOptions: SelectOption[]
  vehicleOptions: SelectOption[]
  masterProductOptions: SelectOption[]
  selectedMasterProduct: MasterProductDisplay | null
  isLoadingNextNumber: boolean
}>()

const emit = defineEmits<{
  'update:number': [v: string]
  'update:status': [v: string]
  'update:clientId': [v: string]
  'update:vehicleId': [v: string]
  'update:masterProductId': [v: string]
  'update:entryDate': [v: string | undefined]
  'update:expectedDate': [v: string | undefined]
  'openMasterProductEditor': []
  'openMasterProductManager': []
}>()

const statusOptions = [
  { label: 'Orçamento', value: 'estimate' },
  { label: 'Aberta', value: 'open' },
  { label: 'Em andamento', value: 'in_progress' },
]
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-clipboard-list" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">Informações básicas</h3>
      </div>
    </template>

    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UFormField label="Número da OS">
          <UInput
            :model-value="number"
            :placeholder="isLoadingNextNumber ? 'Gerando número...' : 'Auto (ex: OS4001)'"
            class="w-full"
            @update:model-value="emit('update:number', String($event ?? ''))"
          />
          <p v-if="isLoadingNextNumber" class="mt-2 text-xs text-muted">
            Buscando o próximo número disponível...
          </p>
        </UFormField>

        <UFormField label="Status inicial">
          <USelectMenu
            :model-value="status"
            :items="statusOptions"
            value-key="value"
            class="w-full"
            :search-input="false"
            @update:model-value="emit('update:status', String($event ?? ''))"
          />
        </UFormField>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UFormField label="Data de entrada">
          <UiDatePicker
            :model-value="entryDate"
            placeholder="Selecione a data"
            class="w-full"
            @update:model-value="emit('update:entryDate', $event as string | undefined)"
          />
        </UFormField>

        <UFormField label="Data prevista">
          <UiDatePicker
            :model-value="expectedDate"
            placeholder="Selecione a data"
            class="w-full"
            @update:model-value="emit('update:expectedDate', $event as string | undefined)"
          />
        </UFormField>

        <UFormField label="Cliente">
          <USelectMenu
            :model-value="clientId"
            :items="[{ label: 'Sem cliente', value: '' }, ...clientOptions]"
            value-key="value"
            class="w-full"
            searchable
            @update:model-value="emit('update:clientId', String($event ?? ''))"
          />
        </UFormField>

        <UFormField label="Veículo">
          <USelectMenu
            :model-value="vehicleId"
            :items="[{ label: 'Sem veículo', value: '' }, ...vehicleOptions]"
            value-key="value"
            class="w-full"
            searchable
            :disabled="!!clientId && !vehicleOptions.length"
            @update:model-value="emit('update:vehicleId', String($event ?? ''))"
          />
        </UFormField>

        <UFormField label="Produto master">
          <div class="space-y-3">
            <div class="flex items-start gap-2">
              <USelectMenu
                :model-value="masterProductId"
                :items="[{ label: 'Sem produto master', value: '' }, ...masterProductOptions]"
                value-key="value"
                class="min-w-0 flex-1"
                searchable
                @update:model-value="emit('update:masterProductId', String($event ?? ''))"
              />
              <div class="flex shrink-0 items-center gap-2">
                <UTooltip text="Novo produto master">
                  <UButton
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="emit('openMasterProductEditor')"
                  />
                </UTooltip>
                <UTooltip text="Gerenciar produtos master">
                  <UButton
                    icon="i-lucide-settings-2"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="emit('openMasterProductManager')"
                  />
                </UTooltip>
              </div>
            </div>

            <div v-if="selectedMasterProduct" class="rounded-xl border border-default bg-elevated/50 p-3">
              <div class="flex items-start gap-3">
                <UIcon name="i-lucide-box" class="mt-0.5 size-4 text-primary" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-highlighted">{{ selectedMasterProduct.name }}</p>
                  <p v-if="selectedMasterProduct.description" class="mt-1 text-sm text-muted">
                    {{ selectedMasterProduct.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UFormField>
      </div>
    </div>
  </UCard>
</template>
