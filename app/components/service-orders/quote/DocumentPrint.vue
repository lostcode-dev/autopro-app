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

// ─── A4 page dimensions at 96 dpi ────────────────────────────────────────────
const PAGE_W = 794
const PAGE_H = 1123
const H_PAD = 36 // horizontal padding
const PG_HDR = 58 // per-page header height
const PG_FTR = 42 // per-page footer height
const V_PAD = 22 // vertical padding top + bottom inside content area
const CONTENT = PAGE_H - PG_HDR - PG_FTR - V_PAD * 2 // 979 px

// Row heights (conservative / slightly generous to prevent overflow)
const ROW_ITEM = 28
const ROW_CAT = 26
const TBL_TH = 28

// First-page fixed section heights (include their own margin-bottom)
const H_INFO = 133 // 3-col grid (order / client / company)
const H_BANNER = 46 // "ORÇAMENTO DE SERVIÇOS" banner
const H_VEHICLE = 86 // vehicle 4-col grid
const H_MASTER = 74 // master product block
const H_DEFECT = 66 // reported defect block
const H_LABEL = 24 // "Serviços e Produtos" label + small gap before table
const GAP = 8 // margin-bottom between each section

// Closing-block section heights (last page)
const H_TOTALS = 96 // subtotal + discount + total
const H_NOTES = 74 // optional notes block
const H_SIGN = 60 // validity text + signature line

// ─── Computed data ────────────────────────────────────────────────────────────
const workshopName = computed(
  () =>
    props.organization?.trade_name?.trim()
    || props.organization?.name?.trim()
    || 'AutoPro'
)

const subtotal = computed(() => (props.detail.order.items ?? []).reduce((s, i) => s + getItemTotal(i), 0))
const totalAmount = computed(() => Number(props.detail.order.total_amount ?? 0))
const discountAmount = computed(() => Number(props.detail.order.discount ?? 0))

const groupedItems = computed(() => {
  const items = props.detail.order.items ?? []
  const map = new Map<string, ServiceOrderItem[]>()
  for (const item of items) {
    const cat = item.category_name?.trim() || 'Serviços e Peças'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  return Array.from(map.entries()).map(([category, list]) => ({
    category,
    items: [...list].sort((a, b) =>
      (a.description || a.name || '').toLowerCase()
        .localeCompare((b.description || b.name || '').toLowerCase(), 'pt-BR')
    )
  }))
})

// ─── Page distribution ────────────────────────────────────────────────────────
interface PrintRow {
  type: 'category' | 'item'
  label?: string
  item?: ServiceOrderItem
}

const flatRows = computed<PrintRow[]>(() => {
  const rows: PrintRow[] = []
  for (const g of groupedItems.value) {
    rows.push({ type: 'category', label: g.category })
    for (const item of g.items) rows.push({ type: 'item', item })
  }
  return rows
})

// Pixels consumed by first-page fixed sections before the table rows
const firstOverhead = computed(() => {
  let h = H_INFO + GAP
  if (props.quoteMode !== false) h += H_BANNER + GAP
  if (props.detail.vehicle) h += H_VEHICLE + GAP
  if (props.detail.masterProduct) h += H_MASTER + GAP
  h += H_DEFECT + GAP + H_LABEL + TBL_TH
  return h
})

// Pixels needed for the closing block at the bottom of the last page
const closingH = computed(() => {
  let h = GAP + H_TOTALS
  if (props.detail.order.notes) h += GAP + H_NOTES
  if (props.quoteMode !== false) h += GAP + H_SIGN
  return h
})

interface PrintPage {
  rows: PrintRow[]
  pageNum: number
  total: number
  isFirst: boolean
  isLast: boolean
}

const pages = computed<PrintPage[]>(() => {
  const rows = flatRows.value
  const firstCap = CONTENT - firstOverhead.value
  const otherCap = CONTENT - TBL_TH

  const buckets: PrintRow[][] = []
  let cur: PrintRow[] = []
  let used = 0

  for (const row of rows) {
    const h = row.type === 'category' ? ROW_CAT : ROW_ITEM
    const cap = buckets.length === 0 ? firstCap : otherCap
    if (used + h > cap && cur.length > 0) {
      buckets.push(cur)
      cur = []
      used = 0
    }
    cur.push(row)
    used += h
  }
  buckets.push(cur) // last batch (may be empty when there are no items at all)

  // If the closing block doesn't fit on the last page, add a dedicated page for it
  const lastIdx = buckets.length - 1
  const lastCap = buckets.length === 1 ? firstCap : otherCap
  const lastBucket = buckets[lastIdx] ?? []
  const lastUsed = lastBucket.reduce(
    (s, r) => s + (r.type === 'category' ? ROW_CAT : ROW_ITEM), 0
  )
  if (lastUsed + closingH.value > lastCap) {
    buckets.push([])
  }

  const total = buckets.length
  return buckets.map((rows, i) => ({
    rows,
    pageNum: i + 1,
    total,
    isFirst: i === 0,
    isLast: i === total - 1
  }))
})

function getClientPhone() {
  return props.detail.client?.mobile_phone || props.detail.client?.phone || null
}
</script>

<template>
  <!-- Root: stacks exact A4 pages (794 × 1123 px) with no gaps between them -->
  <div
    ref="rootEl"
    :style="`width:${PAGE_W}px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#111; background:#fff; line-height:1.4;`"
  >
    <div
      v-for="page in pages"
      :key="page.pageNum"
      :style="`width:${PAGE_W}px; height:${PAGE_H}px; background:#fff; overflow:hidden; display:flex; flex-direction:column; box-sizing:border-box;`"
    >
      <!-- ── Per-page header ───────────────────────────────────────────────── -->
      <div
        :style="`height:${PG_HDR}px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:0 ${H_PAD}px; border-bottom:1px solid #e2e8f0; background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%); box-sizing:border-box;`"
      >
        <div style="display:flex; align-items:center; gap:10px; min-width:0; overflow:hidden;">
          <img
            v-if="organization?.logo_url"
            :src="organization.logo_url"
            alt="Logo"
            style="max-height:36px; max-width:140px; width:auto; height:auto; object-fit:contain; flex-shrink:0; display:block;"
          >
          <div
            v-else
            style="height:36px; width:36px; background:#0f172a; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
          >
            <span style="color:#fff; font-size:16px; font-weight:600; line-height:1;">{{ workshopName.charAt(0) }}</span>
          </div>
          <div style="min-width:0; overflow:hidden;">
            <div style="font-size:14px; font-weight:500; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              {{ workshopName }}
            </div>
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0; padding-left:12px;">
          <div style="font-size:11px; color:#475569; margin-top:2px;">
            Nº <strong>{{ detail.order.number ?? '—' }}</strong>
          </div>
          <div style="font-size:10px; color:#94a3b8; margin-top:1px;">
            {{ formatDate(detail.order.entry_date) }}
          </div>
        </div>
      </div>

      <!-- ── Content area ──────────────────────────────────────────────────── -->
      <div
        :style="`flex:1; min-height:0; padding:${V_PAD}px ${H_PAD}px; overflow:hidden; display:flex; flex-direction:column; box-sizing:border-box;`"
      >
        <!-- ── First-page fixed sections ──────────────────────────────────── -->
        <template v-if="page.isFirst">
          <!-- Info grid: order / client / company -->
          <div
            style="display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #e2e8f0; margin-bottom:8px; flex-shrink:0;"
          >
            <div style="padding:9px 11px; border-right:1px solid #e2e8f0;">
              <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-bottom:5px;">
                Ordem de Serviço
              </div>
              <div style="font-size:11px; color:#334155; line-height:1.55;">
                <div>
                  <span style="font-weight:600; color:#0f172a;">Nº:</span> {{ detail.order.number ?? '—' }}
                </div>
                <div>
                  <span style="font-weight:600; color:#0f172a;">Data:</span> {{ formatDate(detail.order.entry_date) }}
                </div>
                <div>
                  <span style="font-weight:600; color:#0f172a;">Previsão:</span> {{ formatDate(detail.order.expected_date) }}
                </div>
              </div>
            </div>
            <div style="padding:9px 11px; border-right:1px solid #e2e8f0;">
              <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-bottom:5px;">
                Cliente
              </div>
              <div style="font-size:11px; color:#334155; line-height:1.55;">
                <div style="font-weight:600; color:#0f172a;">
                  {{ detail.client?.name ?? '—' }}
                </div>
                <div v-if="getClientPhone()">
                  {{ formatPhone(getClientPhone()) }}
                </div>
                <div
                  v-if="detail.client?.email"
                  style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                >
                  {{ detail.client.email }}
                </div>
              </div>
            </div>
            <div style="padding:9px 11px;">
              <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-bottom:5px;">
                Dados da Empresa
              </div>
              <div style="font-size:10px; color:#334155; line-height:1.55;">
                <div v-if="organization?.tax_id">
                  {{ formatTaxId(organization.tax_id) }}
                </div>
                <div v-if="organization?.phone">
                  {{ formatPhone(organization.phone) }}
                </div>
                <div
                  v-if="organization?.email"
                  style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                >
                  {{ organization.email }}
                </div>
                <div v-if="organization?.address_city">
                  {{ organization.address_city }}{{ organization.address_state ? ` - ${organization.address_state}` : '' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Quote banner -->
          <div
            v-if="quoteMode !== false"
            style="border:1px solid #e2e8f0; background:#f8fafc; padding:12px 16px; text-align:center; margin-bottom:8px; flex-shrink:0;"
          >
            <div style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.22em; color:#0f172a;">
              Orçamento de Serviços
            </div>
          </div>

          <!-- Vehicle -->
          <div
            v-if="detail.vehicle"
            style="border:1px solid #e2e8f0; padding:9px 11px; margin-bottom:8px; flex-shrink:0;"
          >
            <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-bottom:6px;">
              Veículo
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">
              <div style="font-size:11px; color:#334155;">
                <span style="font-weight:700; color:#0f172a; display:block; font-size:9px; margin-bottom:2px;">Marca / Modelo</span>
                {{ detail.vehicle.brand }} {{ detail.vehicle.model }}
              </div>
              <div style="font-size:11px; color:#334155;">
                <span style="font-weight:700; color:#0f172a; display:block; font-size:9px; margin-bottom:2px;">Placa</span>
                {{ detail.vehicle.license_plate ?? '—' }}
              </div>
              <div style="font-size:11px; color:#334155;">
                <span style="font-weight:700; color:#0f172a; display:block; font-size:9px; margin-bottom:2px;">Ano</span>
                {{ detail.vehicle.year ?? '—' }}
              </div>
              <div style="font-size:11px; color:#334155;">
                <span style="font-weight:700; color:#0f172a; display:block; font-size:9px; margin-bottom:2px;">Combustível</span>
                {{ detail.vehicle.fuel_type ?? '—' }}
              </div>
            </div>
          </div>

          <!-- Master product -->
          <div
            v-if="detail.masterProduct"
            style="border:1px solid #ddd6fe; background:#f5f3ff; padding:9px 11px; margin-bottom:8px; flex-shrink:0;"
          >
            <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#7c3aed; margin-bottom:5px;">
              Produto Master
            </div>
            <div style="font-size:11px; color:#334155; line-height:1.5;">
              <span style="font-weight:600; color:#0f172a;">{{ detail.masterProduct.name }}</span>
              <span v-if="detail.masterProduct.description" style="color:#64748b;"> — {{ detail.masterProduct.description }}</span>
            </div>
          </div>

          <!-- Reported defect -->
          <div style="border:1px solid #e2e8f0; background:#f8fafc; padding:9px 11px; margin-bottom:8px; flex-shrink:0;">
            <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-bottom:5px;">
              Problema Relatado
            </div>
            <div style="font-size:11px; line-height:1.5; color:#334155;">
              {{ detail.order.reported_defect || 'Não informado' }}
            </div>
          </div>

          <!-- Items section label -->
          <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.16em; color:#94a3b8; margin-bottom:4px; flex-shrink:0;">
            Serviços e Produtos
          </div>
        </template>

        <!-- ── Items table (repeated on every page) ────────────────────────── -->
        <table style="width:100%; border-collapse:collapse; flex-shrink:0;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1;">
              <th style="padding:5px 8px; text-align:left; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#475569;">
                Descrição
              </th>
              <th style="padding:5px 8px; text-align:center; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#475569; width:44px;">
                Qtd
              </th>
              <th style="padding:5px 8px; text-align:right; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#475569; width:96px;">
                Val. Unit.
              </th>
              <th style="padding:5px 8px; text-align:right; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#475569; width:96px;">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(row, idx) in page.rows" :key="idx">
              <tr v-if="row.type === 'category'" style="background:#eef2ff;">
                <td
                  colspan="4"
                  style="padding:4px 8px; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.14em; color:#4338ca;"
                >
                  {{ row.label }}
                </td>
              </tr>
              <tr v-else style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:4px 8px; font-size:11px; color:#334155;">
                  {{ row.item?.description || row.item?.name || '—' }}
                </td>
                <td style="padding:4px 8px; text-align:center; font-size:11px; color:#334155;">
                  {{ row.item?.quantity }}
                </td>
                <td style="padding:4px 8px; text-align:right; font-size:11px; color:#334155;">
                  {{ row.item ? formatCurrency(row.item.unit_price) : '' }}
                </td>
                <td style="padding:4px 8px; text-align:right; font-size:11px; font-weight:600; color:#0f172a;">
                  {{ row.item ? formatCurrency(getItemTotal(row.item)) : '' }}
                </td>
              </tr>
            </template>
            <!-- Keep table valid when page has no rows (closing-block-only page) -->
            <tr v-if="page.rows.length === 0">
              <td colspan="4" style="height:2px;" />
            </tr>
          </tbody>
        </table>

        <!-- Flex spacer: pushes closing block to the bottom of the last page -->
        <div v-if="page.isLast" style="flex:1;" />

        <!-- ── Closing block (last page only) ─────────────────────────────── -->
        <template v-if="page.isLast">
          <!-- Totals -->
          <div style="display:flex; justify-content:flex-end; margin-top:8px; flex-shrink:0;">
            <div style="width:264px; border:1px solid #e2e8f0;">
              <div
                style="display:flex; justify-content:space-between; padding:6px 12px; font-size:11px; border-bottom:1px solid #e2e8f0; color:#475569;"
              >
                <span>Subtotal</span>
                <span style="font-weight:600; color:#0f172a;">{{ formatCurrency(subtotal) }}</span>
              </div>
              <div
                v-if="discountAmount > 0"
                style="display:flex; justify-content:space-between; padding:6px 12px; font-size:11px; color:#dc2626; border-bottom:1px solid #e2e8f0;"
              >
                <span>Desconto</span>
                <span style="font-weight:600;">- {{ formatCurrency(discountAmount) }}</span>
              </div>
              <div
                style="display:flex; justify-content:space-between; padding:8px 12px; font-size:14px; font-weight:700; background:#f8fafc; border-top:1px solid #e2e8f0;"
              >
                <span>TOTAL</span>
                <span style="color:#16a34a;">{{ formatCurrency(totalAmount) }}</span>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div
            v-if="detail.order.notes"
            style="border:1px solid #e2e8f0; padding:9px 11px; margin-top:8px; flex-shrink:0;"
          >
            <div style="font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-bottom:5px;">
              Observações
            </div>
            <div style="font-size:11px; line-height:1.5; color:#334155;">
              {{ detail.order.notes }}
            </div>
          </div>

          <!-- Validity + signature (quote mode only) -->
          <div v-if="quoteMode !== false" style="margin-top:12px; flex-shrink:0;">
            <div style="font-size:10px; color:#64748b; margin-bottom:18px;">
              Este orçamento tem validade de 30 dias a partir da data de emissão.
            </div>
            <div style="display:grid; grid-template-columns:1fr auto; gap:24px; align-items:flex-end;">
              <div>
                <div style="border-top:1px solid #0f172a; padding-top:6px; font-size:10px; color:#64748b; text-align:center;">
                  Assinatura do Cliente
                </div>
              </div>
              <div style="font-size:10px; color:#64748b; white-space:nowrap; padding-bottom:6px;">
                Data: _____ / _____ / __________
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Per-page footer ───────────────────────────────────────────────── -->
      <div
        :style="`height:${PG_FTR}px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:0 ${H_PAD}px; border-top:1px solid #e2e8f0; background:#f8fafc; box-sizing:border-box;`"
      >
        <span style="font-size:9px; color:#cbd5e1; font-style:italic; letter-spacing:0.04em;">
          AutoPro Beenk
        </span>
        <span style="font-size:9px; color:#94a3b8; font-weight:600;">
          Página {{ page.pageNum }} / {{ page.total }}
        </span>
      </div>
    </div>
  </div>
</template>
