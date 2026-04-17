<script setup lang="ts">
import type { GroupItem } from '~/types/products'

const modelValue = defineModel<GroupItem[]>({ required: true })

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const totalCost = computed(() =>
  modelValue.value.reduce((acc, item) => acc + (item.preco_custo ?? 0) * (item.quantidade ?? 0), 0)
)

const totalSale = computed(() =>
  modelValue.value.reduce((acc, item) => acc + (item.preco_venda ?? 0) * (item.quantidade ?? 0), 0)
)

function addItem() {
  modelValue.value.push({
    descricao: '',
    quantidade: 1,
    unidade_medida: 'un',
    preco_custo: 0,
    preco_venda: 0,
    controlar_estoque: false,
    quantidade_inicial_estoque: 0
  })
}

function removeItem(index: number) {
  modelValue.value.splice(index, 1)
}
</script>

<template>
  <div class="space-y-3">
    <USeparator label="Itens do grupo" />

    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="rounded-lg border border-default p-3 space-y-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-muted">Item {{ index + 1 }}</span>
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
          <UInput v-model="item.descricao" class="w-full" />
        </UFormField>

        <UFormField label="Quantidade">
          <UInput
            v-model.number="item.quantidade"
            type="number"
            min="1"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Unidade">
          <UInput
            v-model="item.unidade_medida"
            class="w-full"
            placeholder="un"
          />
        </UFormField>

        <UFormField label="Preço de custo">
          <UInput
            v-model.number="item.preco_custo"
            type="number"
            min="0"
            step="0.01"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Preço de venda">
          <UInput
            v-model.number="item.preco_venda"
            type="number"
            min="0"
            step="0.01"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <div class="flex items-center justify-between gap-4">
      <UButton
        label="Adicionar item"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        @click="addItem"
      />

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
