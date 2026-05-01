<script setup lang="ts">
import type { ServiceOrderDetailFull, ServiceOrderItem } from '~/types/service-orders'
import type { OrganizationData } from '~/types/organization'
import {
  formatCurrency,
  formatDate,
  formatPhone,
  formatTaxId,
  formatZipCode,
  getItemTotal
} from '~/utils/service-orders'

const props = defineProps<{
  detail: ServiceOrderDetailFull
  organization: OrganizationData | null
  quoteMode?: boolean
}>()

const workshopName = computed(
  () =>
    props.organization?.trade_name?.trim()
    || props.organization?.name?.trim()
    || 'AutoPro'
)

const subtotal = computed(() =>
  (props.detail.order.items ?? []).reduce(
    (total, item) => total + getItemTotal(item),
    0
  )
)

const totalAmount = computed(() => Number(props.detail.order.total_amount ?? 0))
const discountAmount = computed(() => Number(props.detail.order.discount ?? 0))

const groupedItems = computed(() => {
  const items = props.detail.order.items ?? []
  const groups = new Map<string, ServiceOrderItem[]>()
  for (const item of items) {
    const cat = item.category_name?.trim() || 'Serviços e Peças'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(item)
  }
  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    items
  }))
})

function getClientPhone() {
  return props.detail.client?.mobile_phone || props.detail.client?.phone || null
}
</script>

<template>
  <article
    class="mx-auto overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
  >
    <div
      class="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-2"
    >
      <div class="flex items-center gap-4">
        <img
          v-if="organization?.logo_url"
          :src="organization.logo_url"
          alt="Logo da oficina"
          class="max-h-12 max-w-[200px] w-auto h-auto object-contain flex-shrink-0"
        >
        <div
          v-else
          class="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-slate-950 text-white shadow-lg flex-shrink-0"
        >
          <UIcon name="i-lucide-wrench" class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="mt-1 text-lg font-black tracking-tight text-slate-950">
            {{ workshopName }}
          </h2>
        </div>
      </div>
    </div>

    <div class="space-y-2 p-4">
      <div class="grid gap-2 lg:grid-cols-[1.2fr_1fr]">
        <section class="grid gap-6 sm:grid-cols-3">
          <div>
            <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Ordem
            </h3>
            <div class="mt-1 space-y-1 text-sm text-slate-700">
              <p>
                <span class="font-semibold text-slate-950">OS Nº:</span>
                {{ detail.order.number ?? '—' }}
              </p>
              <p>
                <span class="font-semibold text-slate-950">Data:</span>
                {{ formatDate(detail.order.entry_date) }}
              </p>
              <p>
                <span class="font-semibold text-slate-950">Previsão:</span>
                {{ formatDate(detail.order.expected_date) }}
              </p>
            </div>
          </div>

          <div class="col-span-2">
            <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Cliente
            </h3>
            <div class="mt-1 space-y-1 text-sm text-slate-700">
              <p>
                <span class="font-semibold text-slate-950">Nome:</span>
                {{ detail.client?.name ?? '—' }}
              </p>
              <p>
                <span class="font-semibold text-slate-950">Telefone:</span>
                {{ formatPhone(getClientPhone()) }}
              </p>
              <p v-if="detail.client?.email">
                <span class="font-semibold text-slate-950">Email:</span>
                {{ detail.client.email }}
              </p>
            </div>
          </div>
        </section>

        <section class="text-right">
          <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Dados da Empresa
          </h3>
          <div class="mt-1 space-y-1 text-sm text-slate-700">
            <p v-if="organization?.tax_id">
              <span class="font-semibold text-slate-950">CNPJ/CPF:</span>
              {{ formatTaxId(organization.tax_id) }}
            </p>
            <p v-if="organization?.phone">
              <span class="font-semibold text-slate-950">Telefone:</span>
              {{ formatPhone(organization.phone) }}
            </p>
            <p v-if="organization?.mobile_phone">
              <span class="font-semibold text-slate-950">WhatsApp:</span>
              {{ formatPhone(organization.mobile_phone) }}
            </p>
            <p v-if="organization?.email">
              <span class="font-semibold text-slate-950">Email:</span>
              {{ organization.email }}
            </p>
            <p v-if="organization?.website">
              <span class="font-semibold text-slate-950">Site:</span>
              {{ organization.website }}
            </p>
            <div
              v-if="organization?.address_street || organization?.address_city"
              class="pt-1 leading-relaxed"
            >
              <p v-if="organization?.address_street">
                {{ organization.address_street }}{{ organization.address_number ? `, ${organization.address_number}` : '' }}
              </p>
              <p v-if="organization?.address_neighborhood">
                {{ organization.address_neighborhood }}
              </p>
              <p v-if="organization?.address_city || organization?.address_state">
                {{ organization?.address_city ?? '' }}{{ organization?.address_state ? ` - ${organization.address_state}` : '' }}
              </p>
              <p v-if="organization?.address_zip_code">
                CEP: {{ formatZipCode(organization.address_zip_code) }}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div
        v-if="quoteMode !== false"
        class="rounded-[24px] border border-slate-200 bg-slate-50 px-6 py-4 text-center"
      >
        <p class="text-lg font-black tracking-[0.18em] text-slate-950">
          ORÇAMENTO DE SERVIÇOS
        </p>
      </div>

      <section v-if="detail.vehicle" class="space-y-3">
        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Veículo
        </h3>
        <div
          class="grid gap-3 rounded-[24px] border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4 p-5"
        >
          <p class="text-sm text-slate-700">
            <span class="font-semibold text-slate-950">Marca/Modelo:</span>
            {{ detail.vehicle.brand }} {{ detail.vehicle.model }}
          </p>
          <p class="text-sm text-slate-700">
            <span class="font-semibold text-slate-950">Placa:</span>
            {{ detail.vehicle.license_plate ?? '—' }}
          </p>
          <p class="text-sm text-slate-700">
            <span class="font-semibold text-slate-950">Ano:</span>
            {{ detail.vehicle.year ?? '—' }}
          </p>
          <p class="text-sm text-slate-700">
            <span class="font-semibold text-slate-950">Combustível:</span>
            {{ detail.vehicle.fuel_type ?? '—' }}
          </p>
        </div>
      </section>

      <section
        v-if="detail.masterProduct"
        class="rounded-[24px] border border-violet-200 bg-violet-50/70 p-2"
      >
        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-violet-700">
          Produto Master
        </h3>
        <div class="mt-1 space-y-2 text-sm text-slate-700">
          <p>
            <span class="font-semibold text-slate-950">Nome:</span>
            {{ detail.masterProduct.name }}
          </p>
          <p v-if="detail.masterProduct.description">
            <span class="font-semibold text-slate-950">Descrição:</span>
            {{ detail.masterProduct.description }}
          </p>
          <p v-if="detail.masterProduct.notes">
            <span class="font-semibold text-slate-950">Observações:</span>
            {{ detail.masterProduct.notes }}
          </p>
        </div>
      </section>

      <section class="rounded-[24px] border border-slate-200 bg-slate-50/70 p-2">
        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Problema Relatado
        </h3>
        <p class="mt-1 text-sm leading-relaxed text-slate-700">
          {{ detail.order.reported_defect || 'Não informado' }}
        </p>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Serviços e Produtos
        </h3>
        <div class="overflow-hidden rounded-[24px] border border-slate-200">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th
                  class="px-4 py-1 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  Descrição
                </th>
                <th
                  class="px-4 py-1 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  Qtd
                </th>
                <th
                  class="px-4 py-1 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  Valor Unit.
                </th>
                <th
                  class="px-4 py-1 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              <template v-for="group in groupedItems" :key="group.category">
                <tr class="bg-slate-100/80">
                  <td
                    colspan="4"
                    class="px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {{ group.category }}
                  </td>
                </tr>
                <tr
                  v-for="(item, index) in group.items"
                  :key="`${group.category}-${index}`"
                >
                  <td class="px-4 py-1 text-sm text-slate-700">
                    {{ item.description || item.name || '—' }}
                  </td>
                  <td class="px-4 py-1 text-center text-sm text-slate-700">
                    {{ item.quantity }}
                  </td>
                  <td class="px-4 py-1 text-center text-sm text-slate-700">
                    {{ formatCurrency(item.unit_price) }}
                  </td>
                  <td class="px-4 py-1 text-right text-sm font-semibold text-slate-950">
                    {{ formatCurrency(getItemTotal(item)) }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <div class="flex justify-end">
        <div
          class="w-full max-w-[320px] rounded-[24px] border border-slate-200 bg-slate-50/80 p-2"
        >
          <div class="flex items-center justify-between py-1 text-sm text-slate-700">
            <span>Subtotal</span>
            <span class="font-semibold text-slate-950">{{ formatCurrency(subtotal) }}</span>
          </div>
          <div
            v-if="discountAmount > 0"
            class="flex items-center justify-between py-1 text-sm text-rose-600"
          >
            <span>Desconto</span>
            <span class="font-semibold">- {{ formatCurrency(discountAmount) }}</span>
          </div>
          <div
            class="mt-1 flex items-center justify-between border-t-2 border-slate-200 pt-2 text-base font-bold text-slate-950"
          >
            <span>TOTAL</span>
            <span class="text-xl text-emerald-600">{{ formatCurrency(totalAmount) }}</span>
          </div>
        </div>
      </div>

      <footer class="border-t border-slate-200 pt-2 text-center">
        <p v-if="quoteMode !== false" class="text-sm font-medium text-slate-600">
          Este orçamento tem validade de 30 dias.
        </p>
        <p class="mt-1 text-sm text-slate-500">
          {{ workshopName }} - Sistema de Gestão
        </p>
      </footer>
    </div>
  </article>
</template>
