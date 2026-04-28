<script setup lang="ts">
import { formatCurrency } from '~/utils/service-orders'
import type { ServiceOrderDraftItem } from '~/types/service-orders'

interface ProductGroupItem {
  description?: string | null
  quantity: number
  cost_price: number
  sale_price: number
}

interface ProductCatalogItem {
  id: string
  name: string
  type: 'unit' | 'group'
  category_id?: string | null
  unit_sale_price: number | null
  unit_cost_price: number | null
  group_items?: ProductGroupItem[] | null
}

const props = defineProps<{
  items: ServiceOrderDraftItem[]
  itemCommissionMap: Map<string, number>
}>()

const emit = defineEmits<{
  addManual: []
  addProduct: [product: ProductCatalogItem]
  remove: [id: string]
  setQuantity: [item: ServiceOrderDraftItem, value: string | number]
}>()

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function getItemTotal(item: ServiceOrderDraftItem) {
  return Math.max(toNumber(item.quantity), 0) * Math.max(toNumber(item.unit_price), 0)
}

function getItemCommission(item: ServiceOrderDraftItem) {
  const computed = (props.itemCommissionMap.get(item.id) ?? 0)
  if (computed > 0) return computed
  return item.stored_commission ?? 0
}
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-package" class="size-4 text-primary" />
          <h3 class="font-semibold text-highlighted">Itens da ordem de serviço</h3>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            label="Adicionar manual"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-square-pen"
            @click="emit('addManual')"
          />
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <div class="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/10 via-elevated to-info/5 p-4">
        <UFormField label="Adicionar Produto/Serviço">
          <template #label>
            <span class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
              <UIcon name="i-lucide-package-plus" class="size-4 text-primary" />
              Adicionar Produto/Serviço
            </span>
          </template>
          <ServiceOrdersProductSelectInput @select="emit('addProduct', $event)" />
        </UFormField>
      </div>

      <div
        v-if="!items.length"
        class="rounded-2xl border border-default bg-elevated/40 px-6 py-10 text-center"
      >
        <UIcon name="i-lucide-package-search" class="mx-auto size-10 text-dimmed" />
        <p class="mt-4 text-sm font-medium text-highlighted">Nenhum item adicionado ainda</p>
        <p class="mt-1 text-sm text-muted">
          Comece por um produto do catálogo ou crie um item manual para já sair com o valor previsto da OS.
        </p>
      </div>

      <div v-else class="space-y-4">
        <!-- Desktop table -->
        <div class="hidden overflow-x-auto lg:block">
          <table class="min-w-full divide-y divide-default overflow-hidden rounded-2xl border border-default bg-default text-sm">
            <thead class="bg-elevated/70 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">Descrição</th>
                <th class="w-24 px-4 py-3 font-medium">Qtd</th>
                <th class="w-32 px-4 py-3 font-medium">Venda</th>
                <th class="w-32 px-4 py-3 font-medium">Custo</th>
                <th class="w-28 px-4 py-3 text-right font-medium">Comissão</th>
                <th class="w-32 px-4 py-3 text-right font-medium">Total</th>
                <th class="w-20 px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="item in items" :key="item.id" class="align-top">
                <td class="px-4 py-4">
                  <div class="flex items-center gap-2">
                    <UTooltip :text="item.source === 'catalog' ? 'Item do catálogo' : 'Item manual'">
                      <div
                        class="flex size-6 shrink-0 items-center justify-center rounded-lg"
                        :class="item.source === 'catalog' ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
                      >
                        <UIcon
                          :name="item.source === 'catalog' ? 'i-lucide-package-check' : 'i-lucide-pencil-ruler'"
                          class="size-3.5"
                        />
                      </div>
                    </UTooltip>
                    <UInput v-model="item.description" placeholder="Descrição do item" class="min-w-0 flex-1" />
                  </div>
                </td>
                <td class="px-4 py-4">
                  <UInput
                    :model-value="String(item.quantity)"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full"
                    @update:model-value="emit('setQuantity', item, $event)"
                  />
                </td>
                <td class="px-4 py-4">
                  <UiCurrencyInput v-model="item.unit_price" />
                </td>
                <td class="px-4 py-4">
                  <UiCurrencyInput v-model="item.cost_price" />
                </td>
                <td class="px-4 py-4 text-right font-semibold text-info">
                  {{ formatCurrency(getItemCommission(item)) }}
                </td>
                <td class="px-4 py-4 text-right font-semibold text-highlighted">
                  {{ formatCurrency(getItemTotal(item)) }}
                </td>
                <td class="px-4 py-4 text-right">
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" square @click="emit('remove', item.id)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="space-y-2 lg:hidden">
          <div
            v-for="item in items"
            :key="item.id"
            class="rounded-2xl border border-default bg-default p-3 shadow-xs"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <UTooltip :text="item.source === 'catalog' ? 'Item do catálogo' : 'Item manual'">
                  <div
                    class="flex size-6 shrink-0 items-center justify-center rounded-lg"
                    :class="item.source === 'catalog' ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
                  >
                    <UIcon
                      :name="item.source === 'catalog' ? 'i-lucide-package-check' : 'i-lucide-pencil-ruler'"
                      class="size-3.5"
                    />
                  </div>
                </UTooltip>
                <p class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">
                  {{ item.description || item.name || 'Item sem descrição' }}
                </p>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                square
                size="xs"
                @click="emit('remove', item.id)"
              />
            </div>

            <div class="mt-3 space-y-3">
              <UFormField label="Descrição">
                <UInput v-model="item.description" placeholder="Descrição do item" class="w-full" />
              </UFormField>

              <div class="grid grid-cols-3 gap-2">
                <UFormField label="Quantidade">
                  <UInput
                    :model-value="String(item.quantity)"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full"
                    @update:model-value="emit('setQuantity', item, $event)"
                  />
                </UFormField>
                <UFormField label="Venda">
                  <UiCurrencyInput v-model="item.unit_price" />
                </UFormField>
                <UFormField label="Custo">
                  <UiCurrencyInput v-model="item.cost_price" />
                </UFormField>
              </div>

              <div class="rounded-xl bg-elevated/60 px-3 py-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-muted">Total</span>
                  <span class="text-xs font-medium text-info">
                    Com.: {{ formatCurrency(getItemCommission(item)) }}
                  </span>
                </div>
                <p class="mt-0.5 font-semibold text-highlighted">{{ formatCurrency(getItemTotal(item)) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
