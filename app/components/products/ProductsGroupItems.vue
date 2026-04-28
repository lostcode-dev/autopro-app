<script setup lang="ts">
import type { GroupItem } from '~/types/products'

const modelValue = defineModel<GroupItem[]>({ required: true })

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const totalCost = computed(() =>
  modelValue.value.reduce((acc, item) => acc + (item.cost_price ?? 0) * (item.quantity ?? 0), 0)
)

const totalSale = computed(() =>
  modelValue.value.reduce((acc, item) => acc + (item.sale_price ?? 0) * (item.quantity ?? 0), 0)
)

function addItem() {
  modelValue.value.push({
    description: '',
    quantity: 1,
    unit: 'un',
    cost_price: 0,
    sale_price: 0,
    track_inventory: false,
    initial_stock_quantity: 0
  })
}

function removeItem(index: number) {
  modelValue.value.splice(index, 1)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
          <UIcon name="i-lucide-layers-3" class="size-4" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-highlighted">
            Itens do grupo
          </h3>
          <p class="text-xs text-muted">
            Combine peças e serviços em um único produto
          </p>
        </div>
      </div>

      <UButton
        label="Adicionar item"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        @click="addItem"
      />
    </div>

    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="space-y-3 rounded-lg border border-default bg-elevated/30 p-3"
    >
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2 text-sm font-medium text-highlighted">
          <UIcon name="i-lucide-grip" class="size-4 text-muted" />
          Item {{ index + 1 }}
        </span>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          @click="removeItem(index)"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="Descrição" required class="sm:col-span-2">
          <UInput
            v-model="item.description"
            icon="i-lucide-pencil-ruler"
            class="w-full"
            placeholder="Descrição do item"
          />
        </UFormField>

        <UFormField label="Quantidade">
          <UInput
            v-model.number="item.quantity"
            icon="i-lucide-hash"
            type="number"
            min="1"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Preço de custo">
          <UiCurrencyInput v-model="item.cost_price" />
        </UFormField>

        <UFormField label="Preço de venda">
          <UiCurrencyInput v-model="item.sale_price" />
        </UFormField>
      </div>

      <div class="space-y-3 rounded-lg border border-default bg-default p-3">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-warehouse" class="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p class="text-sm font-medium text-highlighted">
                Adicionar ao Estoque
              </p>
              <p class="text-xs text-muted">
                Este item será criado no módulo de estoque
              </p>
            </div>
          </div>
          <USwitch v-model="item.track_inventory" />
        </div>

        <UFormField v-if="item.track_inventory" label="Quantidade inicial">
          <UInput
            v-model.number="item.initial_stock_quantity"
            icon="i-lucide-boxes"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <div class="flex justify-end">
      <div class="flex gap-3">
        <div class="rounded bg-elevated px-3 py-1.5 text-center">
          <p class="text-xs text-muted">
            Custo total
          </p>
          <p class="text-sm font-semibold text-highlighted">
            {{ formatCurrency(totalCost) }}
          </p>
        </div>
        <div class="rounded bg-elevated px-3 py-1.5 text-center">
          <p class="text-xs text-muted">
            Venda total
          </p>
          <p class="text-sm font-semibold text-highlighted">
            {{ formatCurrency(totalSale) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
