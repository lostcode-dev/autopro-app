<script setup lang="ts">
import type { ServiceOrderDetailFull, ServiceOrderItem } from '~/types/service-orders'
import type { OrganizationData } from '~/types/organization'
import {
  formatCurrency,
  formatDate,
  formatPhone,
  formatTaxId,
  getItemTotal
} from '~/utils/service-orders'

const props = defineProps<{
  detail: ServiceOrderDetailFull
  organization: OrganizationData | null
  quoteMode?: boolean
}>()

const rootEl = ref<HTMLElement | null>(null)
defineExpose({ el: rootEl })

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

const flatPrintRows = computed(() => {
  const rows: { isCategory: boolean, label: string, item?: ServiceOrderItem }[] = []
  for (const group of groupedItems.value) {
    rows.push({ isCategory: true, label: group.category })
    for (const item of group.items) {
      rows.push({ isCategory: false, label: '', item })
    }
  }
  return rows
})

function getClientPhone() {
  return props.detail.client?.mobile_phone || props.detail.client?.phone || null
}
</script>

<template>
  <div
    ref="rootEl"
    style="position: absolute; top: -9999px; left: 0; width: 800px; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; padding: 36px 40px; box-sizing: border-box;"
  >
    <!-- Header -->
    <div
      style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; gap: 16px;"
    >
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <img
          v-if="organization?.logo_url"
          :src="organization.logo_url"
          alt="Logo"
          style="max-height: 40px; max-width: 160px; width: auto; height: auto; object-fit: contain; display: block; flex-shrink: 0;"
        >
        <div
          v-else
          style="height: 40px; width: 40px; background: #111; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
        >
          <span style="color: #fff; font-size: 18px; font-weight: 700;">
            {{ workshopName.charAt(0) }}
          </span>
        </div>
        <div style="min-width: 0;">
          <div
            style="font-size: 15px; font-weight: 800; letter-spacing: -0.2px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
          >
            {{ workshopName }}
          </div>
          <div style="font-size: 10px; color: #555; margin-top: 1px; white-space: nowrap;">
            <span v-if="organization?.tax_id">{{ formatTaxId(organization.tax_id) }}</span>
            <span v-if="organization?.tax_id && (organization?.phone || organization?.email)"> · </span>
            <span v-if="organization?.phone">{{ formatPhone(organization.phone) }}</span>
            <span v-if="organization?.phone && organization?.email"> · </span>
            <span v-if="organization?.email">{{ organization.email }}</span>
          </div>
          <div
            v-if="organization?.address_city"
            style="font-size: 10px; color: #777; margin-top: 1px;"
          >
            {{ organization.address_city }}{{ organization.address_state ? ` - ${organization.address_state}` : '' }}
          </div>
        </div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div
          style="font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;"
        >
          {{ quoteMode !== false ? 'Orçamento' : 'Ordem de Serviço' }}
        </div>
        <div style="font-size: 11px; color: #333; margin-top: 2px;">
          Nº <strong>{{ detail.order.number ?? '—' }}</strong>
        </div>
        <div style="font-size: 11px; color: #555; margin-top: 1px;">
          {{ formatDate(detail.order.entry_date) }}{{ detail.order.expected_date ? ` · Prev: ${formatDate(detail.order.expected_date)}` : '' }}
        </div>
      </div>
    </div>

    <!-- Client + Vehicle -->
    <div
      style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ccc; margin-bottom: 12px;"
    >
      <div style="padding: 10px 14px; border-right: 1px solid #ccc;">
        <div
          style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 6px;"
        >
          Cliente
        </div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">
          {{ detail.client?.name ?? '—' }}
        </div>
        <div v-if="getClientPhone()" style="font-size: 12px; color: #444;">
          {{ formatPhone(getClientPhone()) }}
        </div>
        <div v-if="detail.client?.email" style="font-size: 12px; color: #444;">
          {{ detail.client.email }}
        </div>
      </div>
      <div style="padding: 10px 14px;">
        <div
          style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 6px;"
        >
          Veículo
        </div>
        <div v-if="detail.vehicle">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">
            {{ detail.vehicle.brand }} {{ detail.vehicle.model }}
          </div>
          <div style="font-size: 12px; color: #444;">
            Placa: {{ detail.vehicle.license_plate ?? '—' }}<span v-if="detail.vehicle.year"> · Ano: {{ detail.vehicle.year }}</span>
          </div>
          <div v-if="detail.vehicle.fuel_type" style="font-size: 12px; color: #444;">
            Combustível: {{ detail.vehicle.fuel_type }}
          </div>
        </div>
        <div v-else style="font-size: 12px; color: #888;">
          Não informado
        </div>
      </div>
    </div>

    <!-- Reported defect -->
    <div
      v-if="detail.order.reported_defect"
      style="border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 12px;"
    >
      <div
        style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 5px;"
      >
        Problema Relatado
      </div>
      <div style="font-size: 12px; line-height: 1.5; color: #333;">
        {{ detail.order.reported_defect }}
      </div>
    </div>

    <!-- Items table -->
    <div style="margin-bottom: 12px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #111;">
            <th
              style="padding: 5px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff;"
            >
              Descrição
            </th>
            <th
              style="padding: 5px 8px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; width: 44px;"
            >
              Qtd
            </th>
            <th
              style="padding: 5px 8px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; width: 100px;"
            >
              Val. Unit.
            </th>
            <th
              style="padding: 5px 8px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; width: 100px;"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in flatPrintRows" :key="idx">
            <td
              v-if="row.isCategory"
              colspan="4"
              style="background: #e8e8e8; padding: 4px 8px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #444;"
            >
              {{ row.label }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; font-size: 11px; color: #333;"
            >
              {{ row.item?.description || row.item?.name || '—' }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; text-align: center; font-size: 11px; color: #333;"
            >
              {{ row.item?.quantity }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; text-align: right; font-size: 11px; color: #333;"
            >
              {{ row.item ? formatCurrency(row.item.unit_price) : '' }}
            </td>
            <td
              v-if="!row.isCategory"
              style="border-bottom: 1px solid #e8e8e8; padding: 3px 8px; text-align: right; font-size: 11px; font-weight: 600; color: #111;"
            >
              {{ row.item ? formatCurrency(getItemTotal(row.item)) : '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
      <div style="width: 260px; border: 1px solid #ccc;">
        <div
          style="display: flex; justify-content: space-between; padding: 6px 12px; font-size: 12px; border-bottom: 1px solid #e5e5e5;"
        >
          <span style="color: #555;">Subtotal</span>
          <span style="font-weight: 600;">{{ formatCurrency(subtotal) }}</span>
        </div>
        <div
          v-if="discountAmount > 0"
          style="display: flex; justify-content: space-between; padding: 6px 12px; font-size: 12px; color: #b00; border-bottom: 1px solid #e5e5e5;"
        >
          <span>Desconto</span>
          <span style="font-weight: 600;">- {{ formatCurrency(discountAmount) }}</span>
        </div>
        <div
          style="display: flex; justify-content: space-between; padding: 8px 12px; font-size: 14px; font-weight: 700; background: #f0f0f0; border-top: 2px solid #999;"
        >
          <span>TOTAL</span>
          <span>{{ formatCurrency(totalAmount) }}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div
      v-if="detail.order.notes"
      style="border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 20px;"
    >
      <div
        style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 5px;"
      >
        Observações
      </div>
      <div style="font-size: 12px; line-height: 1.5; color: #333;">
        {{ detail.order.notes }}
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #ccc; padding-top: 16px;">
      <div
        v-if="quoteMode !== false"
        style="font-size: 11px; color: #555; margin-bottom: 24px;"
      >
        Este orçamento tem validade de 30 dias a partir da data de emissão.
      </div>
      <div
        style="display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: flex-end;"
      >
        <div>
          <div
            style="border-top: 1px solid #111; padding-top: 5px; font-size: 11px; color: #555; text-align: center;"
          >
            Assinatura do Cliente
          </div>
        </div>
        <div style="font-size: 11px; color: #555; white-space: nowrap; padding-bottom: 5px;">
          Data: _____ / _____ / __________
        </div>
      </div>
    </div>
  </div>
</template>
