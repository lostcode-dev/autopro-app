<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'NFS-e — Notas de Serviço' })

type NfseRow = {
  id: string
  service_order_id: string | null
  organization_id: string | null
  status: string
  service_order_number: string | null
  provider_nfse_id: string | null
  provider_status: string | null
  nfse_number: string | null
  verification_code: string | null
  issued_at: string | null
  environment: string | null
  provider_reference: string
  dps_series: string | null
  dps_number: string | null
  document_url: string | null
  last_error_message: string | null
  last_error_at: string | null
  created_at: string
  updated_at: string
}

type NfseListResponse = {
  success: boolean
  data: NfseRow[]
  meta: { total: number; page: number; limit: number; pages: number }
}

type NfseDetail = {
  reference: string
  status: string
  nfse_number: string | null
  verification_code: string | null
  issued_at: string | null
  environment: string | null
  document_url: string | null
  taker_name: string | null
  taker_id: string | null
  taker_email: string | null
  services_amount: number | null
  deductions_amount: number | null
  iss_amount: number | null
  effective_rate: number | null
  services_description: string | null
  service_item_code: string | null
  errors: Array<{ code: string; message: string; correction: string | null }>
}

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MANAGED_QUERY_KEYS = ['search', 'page', 'pageSize', 'status'] as const

const toast = useToast()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

function parsePage(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}
function parsePageSize(v: unknown) {
  const n = Number(v)
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE
}

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const debouncedSearch = ref(search.value)
const page = ref(parsePage(route.query.page))
const pageSize = ref(parsePageSize(route.query.pageSize))
const statusFilter = ref(typeof route.query.status === 'string' ? route.query.status : '')

const requestQuery = computed(() => ({
  search: debouncedSearch.value || undefined,
  page: page.value,
  limit: pageSize.value,
  status: statusFilter.value || undefined
}))

const { data, status: fetchStatus, refresh } = await useAsyncData(
  () => `nfse-list-${debouncedSearch.value}-${page.value}-${pageSize.value}-${statusFilter.value}`,
  () => requestFetch<NfseListResponse>('/api/fiscal/nfse', {
    headers: requestHeaders,
    query: requestQuery.value
  }),
  {
    watch: [requestQuery],
    default: () => ({ success: true, data: [], meta: { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, pages: 0 } })
  }
)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    pageSize: pageSize.value !== DEFAULT_PAGE_SIZE ? String(pageSize.value) : undefined,
    status: statusFilter.value || undefined
  }
}

async function syncQuery() {
  const next = Object.fromEntries(
    Object.entries(route.query).filter(([k]) => !MANAGED_QUERY_KEYS.includes(k as (typeof MANAGED_QUERY_KEYS)[number]))
  ) as Record<string, string | undefined>
  Object.assign(next, buildManagedQuery())
  if (JSON.stringify(route.query) === JSON.stringify(next)) return
  await router.replace({ query: next })
}

watch(() => route.query, (q) => {
  const ns = typeof q.search === 'string' ? q.search : ''
  if (search.value !== ns) { search.value = ns; debouncedSearch.value = ns }
  const np = parsePage(q.page)
  if (page.value !== np) page.value = np
  const nps = parsePageSize(q.pageSize)
  if (pageSize.value !== nps) pageSize.value = nps
  const nst = typeof q.status === 'string' ? q.status : ''
  if (statusFilter.value !== nst) statusFilter.value = nst
})

watchDebounced(search, async (val) => {
  debouncedSearch.value = val
  page.value = 1
  await syncQuery()
}, { debounce: 300, maxWait: 800 })

watch(page, async () => {
  if (page.value > totalPages.value && totalPages.value > 0) page.value = totalPages.value
  await syncQuery()
})
watch(pageSize, async () => { page.value = 1; await syncQuery() })
watch(statusFilter, async () => { page.value = 1; await syncQuery() })

async function submitSearch(value: string) {
  search.value = value
  debouncedSearch.value = value
  page.value = 1
  await syncQuery()
}

// ─── Status helpers ───────────────────────────────────────────────────────────
type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const STATUS_LABEL: Record<string, string> = {
  authorized: 'Autorizada',
  processing_authorization: 'Processando',
  authorization_error: 'Erro',
  cancelled: 'Cancelada'
}

const STATUS_COLOR: Record<string, BadgeColor> = {
  authorized: 'success',
  processing_authorization: 'warning',
  authorization_error: 'error',
  cancelled: 'neutral'
}

const STATUS_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Autorizada', value: 'authorized' },
  { label: 'Processando', value: 'processing_authorization' },
  { label: 'Erro', value: 'authorization_error' },
  { label: 'Cancelada', value: 'cancelled' }
]

function statusLabel(s: string) { return STATUS_LABEL[s] ?? s }
function statusColor(s: string): BadgeColor { return STATUS_COLOR[s] ?? 'neutral' }

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('pt-BR')
}

// ─── Table columns ─────────────────────────────────────────────────────────────
const columns = [
  { accessorKey: 'provider_reference', header: 'Referência', enableSorting: false },
  { accessorKey: 'nfse_number', header: 'Número NFS-e', enableSorting: false },
  { accessorKey: 'service_order_number', header: 'OS', enableSorting: false },
  { accessorKey: 'issued_at', header: 'Emissão', enableSorting: false },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
  { id: 'actions', header: '', enableSorting: false }
]

// ─── Detail Slideover ─────────────────────────────────────────────────────────
const showDetail = ref(false)
const selectedRow = ref<NfseRow | null>(null)
const detailData = ref<NfseDetail | null>(null)
const isLoadingDetail = ref(false)

async function openDetail(row: NfseRow) {
  selectedRow.value = row
  showDetail.value = true
  detailData.value = null
  isLoadingDetail.value = true
  try {
    const res = await $fetch<{ success: boolean; data: NfseDetail }>(
      `/api/fiscal/nfse/${encodeURIComponent(row.provider_reference)}`
    )
    detailData.value = res.data
  } catch {
    toast.add({ title: 'Erro ao carregar detalhes da NFS-e', color: 'error' })
  } finally {
    isLoadingDetail.value = false
  }
}

function closeDetail() {
  showDetail.value = false
  selectedRow.value = null
  detailData.value = null
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
const showCancelModal = ref(false)
const nfsePendingCancel = ref<NfseRow | null>(null)
const cancelJustification = ref('')
const isCancelling = ref(false)

function requestCancel(row: NfseRow) {
  nfsePendingCancel.value = row
  cancelJustification.value = ''
  showCancelModal.value = true
}

async function confirmCancel() {
  if (!nfsePendingCancel.value || isCancelling.value) return
  isCancelling.value = true
  try {
    await $fetch(`/api/fiscal/nfse/${encodeURIComponent(nfsePendingCancel.value.provider_reference)}`, {
      method: 'DELETE',
      body: cancelJustification.value.trim() ? { justification: cancelJustification.value.trim() } : {}
    })
    toast.add({ title: 'NFS-e cancelada com sucesso', color: 'success' })
    showCancelModal.value = false
    nfsePendingCancel.value = null
    if (showDetail.value) closeDetail()
    await refresh()
  } catch (err: any) {
    toast.add({
      title: 'Erro ao cancelar NFS-e',
      description: err?.data?.data?.error || err?.data?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isCancelling.value = false
  }
}

// ─── Resend email ─────────────────────────────────────────────────────────────
const showEmailModal = ref(false)
const nfseForEmail = ref<NfseRow | null>(null)
const emailList = ref('')
const isSendingEmail = ref(false)

function requestEmail(row: NfseRow) {
  nfseForEmail.value = row
  emailList.value = ''
  showEmailModal.value = true
}

async function confirmSendEmail() {
  if (!nfseForEmail.value || isSendingEmail.value) return
  const emails = emailList.value.split(/[\n,;]/).map(e => e.trim()).filter(Boolean)
  if (!emails.length) {
    toast.add({ title: 'Informe ao menos um e-mail', color: 'warning' })
    return
  }
  isSendingEmail.value = true
  try {
    await $fetch(`/api/fiscal/nfse/${encodeURIComponent(nfseForEmail.value.provider_reference)}/email`, {
      method: 'POST',
      body: { emails }
    })
    toast.add({ title: 'E-mail reenviado com sucesso', color: 'success' })
    showEmailModal.value = false
    nfseForEmail.value = null
  } catch (err: any) {
    toast.add({
      title: 'Erro ao reenviar e-mail',
      description: err?.data?.data?.error || err?.data?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isSendingEmail.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Notas Fiscais de Serviço (NFS-e)" />
    </template>

    <template #body>
      <AppDataTable
        v-model:search-term="search"
        v-model:page="page"
        v-model:page-size="pageSize"
        :columns="columns"
        :data="rows"
        :loading="fetchStatus === 'pending'"
        loading-variant="row"
        :total="total"
        :page-size-options="PAGE_SIZE_OPTIONS"
        search-placeholder="Buscar por referência, número ou OS..."
        :show-search="true"
        empty-icon="i-lucide-file-text"
        empty-title="Nenhuma NFS-e encontrada"
        empty-description="Nenhuma nota fiscal de serviço corresponde aos filtros aplicados."
        @search-submit="submitSearch"
      >
        <template #toolbar-right>
          <USelect
            v-model="statusFilter"
            :options="STATUS_OPTIONS"
            value-key="value"
            label-key="label"
            size="sm"
            class="w-40"
          />
        </template>

        <template #provider_reference-cell="{ row }">
          <button
            class="font-mono text-xs text-primary hover:underline"
            @click="openDetail(row.original as NfseRow)"
          >
            {{ row.original.provider_reference }}
          </button>
        </template>

        <template #nfse_number-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.nfse_number ?? '—' }}</span>
        </template>

        <template #service_order_number-cell="{ row }">
          <span class="text-sm text-muted">{{ row.original.service_order_number ?? '—' }}</span>
        </template>

        <template #issued_at-cell="{ row }">
          <span class="text-sm">{{ formatDate(row.original.issued_at as string | null) }}</span>
        </template>

        <template #status-cell="{ row }">
          <UBadge
            :label="statusLabel(row.original.status as string)"
            :color="statusColor(row.original.status as string)"
            variant="subtle"
            size="sm"
            class="font-medium"
          />
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-1">
            <UTooltip text="Ver detalhes">
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="openDetail(row.original as NfseRow)"
              />
            </UTooltip>
            <UTooltip text="Reenviar por e-mail">
              <UButton
                icon="i-lucide-mail"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="(row.original.status as string) === 'cancelled'"
                @click="requestEmail(row.original as NfseRow)"
              />
            </UTooltip>
            <UTooltip text="Cancelar NFS-e">
              <UButton
                icon="i-lucide-x-circle"
                color="error"
                variant="ghost"
                size="xs"
                :disabled="(row.original.status as string) === 'cancelled'"
                @click="requestCancel(row.original as NfseRow)"
              />
            </UTooltip>
          </div>
        </template>
      </AppDataTable>
    </template>
  </UDashboardPanel>

  <!-- ── Detail Slideover ──────────────────────────────────────────────────── -->
  <USlideover
    :open="showDetail"
    side="right"
    :ui="{ content: 'max-w-xl' }"
    @update:open="(v) => !v && closeDetail()"
  >
    <template #header>
      <div>
        <h2 class="text-lg font-bold text-highlighted">
          Detalhes da NFS-e
        </h2>
        <p v-if="selectedRow" class="mt-0.5 font-mono text-xs text-muted">
          {{ selectedRow.provider_reference }}
        </p>
      </div>
    </template>

    <template #body>
      <div v-if="isLoadingDetail" class="space-y-4 p-4">
        <USkeleton v-for="i in 6" :key="i" class="h-8 rounded" />
      </div>

      <div v-else-if="detailData" class="space-y-6 p-4">
        <!-- Status row -->
        <div class="flex items-center justify-between gap-3">
          <UBadge
            :label="statusLabel(detailData.status)"
            :color="statusColor(detailData.status)"
            variant="subtle"
            size="md"
            class="font-semibold"
          />
          <div class="flex gap-2">
            <UButton
              v-if="detailData.status !== 'cancelled'"
              label="Reenviar e-mail"
              icon="i-lucide-mail"
              size="xs"
              color="neutral"
              variant="outline"
              @click="selectedRow && requestEmail(selectedRow)"
            />
            <UButton
              v-if="detailData.status !== 'cancelled'"
              label="Cancelar NFS-e"
              icon="i-lucide-x-circle"
              size="xs"
              color="error"
              variant="outline"
              @click="selectedRow && requestCancel(selectedRow)"
            />
          </div>
        </div>

        <!-- Info grid -->
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs font-medium text-muted">Número NFS-e</dt>
            <dd class="mt-0.5 font-semibold text-highlighted">{{ detailData.nfse_number ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted">Cód. Verificação</dt>
            <dd class="mt-0.5 font-mono text-xs text-highlighted">{{ detailData.verification_code ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted">Emissão</dt>
            <dd class="mt-0.5">{{ formatDate(detailData.issued_at) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted">Ambiente</dt>
            <dd class="mt-0.5">
              <UBadge
                :label="detailData.environment === 'production' ? 'Produção' : 'Homologação'"
                :color="detailData.environment === 'production' ? 'success' : 'warning'"
                variant="subtle"
                size="xs"
              />
            </dd>
          </div>

          <div class="col-span-2">
            <dt class="text-xs font-medium text-muted">Tomador</dt>
            <dd class="mt-0.5 font-semibold text-highlighted">{{ detailData.taker_name ?? '—' }}</dd>
            <dd v-if="detailData.taker_id" class="font-mono text-xs text-muted">{{ detailData.taker_id }}</dd>
            <dd v-if="detailData.taker_email" class="text-xs text-muted">{{ detailData.taker_email }}</dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-muted">Valor serviços</dt>
            <dd class="mt-0.5 font-semibold text-highlighted">
              {{ detailData.services_amount != null ? detailData.services_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted">ISS retido</dt>
            <dd class="mt-0.5">
              {{ detailData.iss_amount != null ? detailData.iss_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—' }}
            </dd>
          </div>

          <div v-if="detailData.services_description" class="col-span-2">
            <dt class="text-xs font-medium text-muted">Descrição dos serviços</dt>
            <dd class="mt-0.5 whitespace-pre-line text-sm">{{ detailData.services_description }}</dd>
          </div>
        </dl>

        <!-- Document link -->
        <div v-if="detailData.document_url">
          <UButton
            :to="detailData.document_url"
            target="_blank"
            rel="noopener noreferrer"
            label="Abrir documento PDF"
            icon="i-lucide-external-link"
            color="primary"
            variant="outline"
            size="sm"
            class="w-full justify-center"
          />
        </div>

        <!-- Errors -->
        <div v-if="detailData.errors?.length" class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-error">Erros</p>
          <div
            v-for="(e, i) in detailData.errors"
            :key="i"
            class="rounded-md border border-error/30 bg-error/5 p-3 text-sm"
          >
            <p class="font-semibold text-error">{{ e.code }}: {{ e.message }}</p>
            <p v-if="e.correction" class="mt-1 text-xs text-muted">{{ e.correction }}</p>
          </div>
        </div>
      </div>

      <div v-else class="flex h-32 items-center justify-center text-sm text-muted">
        Nenhum detalhe disponível.
      </div>
    </template>
  </USlideover>

  <!-- ── Cancel Modal ──────────────────────────────────────────────────────── -->
  <UModal
    :open="showCancelModal"
    title="Cancelar NFS-e"
    :ui="{ overlay: 'z-30', content: 'z-40' }"
    @update:open="(v) => !v && !isCancelling && (showCancelModal = false)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Esta ação é irreversível. A NFS-e
          <span class="font-mono font-semibold text-highlighted">{{ nfsePendingCancel?.provider_reference }}</span>
          será cancelada junto à prefeitura.
        </p>
        <UFormField label="Justificativa (opcional)" hint="15–255 caracteres se informada">
          <UTextarea
            v-model="cancelJustification"
            placeholder="Ex: Serviço não foi prestado..."
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-3">
          <UButton
            label="Voltar"
            color="neutral"
            variant="ghost"
            :disabled="isCancelling"
            @click="showCancelModal = false"
          />
          <UButton
            label="Confirmar cancelamento"
            color="error"
            :loading="isCancelling"
            @click="confirmCancel"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- ── Resend Email Modal ────────────────────────────────────────────────── -->
  <UModal
    :open="showEmailModal"
    title="Reenviar NFS-e por e-mail"
    :ui="{ overlay: 'z-30', content: 'z-40' }"
    @update:open="(v) => !v && !isSendingEmail && (showEmailModal = false)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Informe os e-mails que receberão a NFS-e
          <span class="font-mono font-semibold text-highlighted">{{ nfseForEmail?.provider_reference }}</span>.
          Separe múltiplos e-mails por vírgula ou linha.
        </p>
        <UFormField label="E-mails destinatários">
          <UTextarea
            v-model="emailList"
            placeholder="cliente@email.com, outro@email.com"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-3">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="ghost"
            :disabled="isSendingEmail"
            @click="showEmailModal = false"
          />
          <UButton
            label="Enviar"
            icon="i-lucide-send"
            :loading="isSendingEmail"
            @click="confirmSendEmail"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
