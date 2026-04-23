<script setup lang="ts">
import { formatCurrency, STATUS_COLOR, STATUS_ICON, STATUS_LABEL } from '../../utils/service-orders'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'created': []
}>()

interface SelectOption {
  label: string
  value: string
}

interface ClientItem {
  id: string
  name: string
}

interface VehicleItem {
  id: string
  brand: string | null
  model: string | null
  license_plate: string | null
  client_id?: string | null
}

interface EmployeeItem {
  id: string
  name: string
  has_commission?: boolean | null
  commission_type?: string | null
  commission_amount?: number | string | null
  commission_base?: string | null
  commission_categories?: string[] | null
}

interface ProductGroupItem {
  quantity: number
  cost_price: number
  sale_price: number
}

interface ProductCatalogItem {
  id: string
  name: string
  code: string
  type: 'unit' | 'group'
  category_id?: string | null
  unit_sale_price: number | null
  unit_cost_price: number | null
  group_items?: ProductGroupItem[] | null
}

interface TaxItem {
  id: string
  name: string
  type: string
  rate: number
}

interface MasterProductItem {
  id: string
  name: string
  description: string | null
  notes: string | null
}

interface ServiceOrderDraftItem {
  id: string
  name: string
  description: string
  quantity: number
  unit_price: number | string
  cost_price: number | string
  source: 'manual' | 'catalog'
  product_id?: string | null
  category_id?: string | null
}

interface MasterProductEditor {
  id: string
  name: string
  description: string
  notes: string
}

interface FormData {
  number: string
  status: string
  client_id: string
  vehicle_id: string
  master_product_id: string
  responsible_employees: string[]
  entry_date: string | undefined
  expected_date: string | undefined
  reported_defect: string
  diagnosis: string
  notes: string
  items: ServiceOrderDraftItem[]
  discount: number | string
  apply_taxes: boolean
  selected_tax_ids: string[]
  create_appointment: boolean
  appointment_date: string | undefined
  appointment_time: string
  appointment_priority: string
  appointment_notes: string
}

type CommissionResult = {
  value: number
  hasMatchingItems: boolean
}

const APPOINTMENT_NO_PRIORITY = 'none'

const statusOptions = [
  { label: 'Orçamento', value: 'estimate' },
  { label: 'Aberta', value: 'open' },
  { label: 'Em andamento', value: 'in_progress' }
]

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

const toast = useToast()

const clientOptions = ref<SelectOption[]>([])
const vehicleCatalog = ref<VehicleItem[]>([])
const employeeCatalog = ref<EmployeeItem[]>([])
const productCatalog = ref<ProductCatalogItem[]>([])
const masterProducts = ref<MasterProductItem[]>([])
const taxesCatalog = ref<TaxItem[]>([])

const selectedProductId = ref('')
const isLoadingOptions = ref(false)
const isLoadingNextNumber = ref(false)
const optionsLoaded = ref(false)
const itemCounter = ref(0)
let nextNumberRequestId = 0

const showMasterProductEditor = ref(false)
const showMasterProductManager = ref(false)
const masterProductMode = ref<'create' | 'edit'>('create')
const masterProductSearch = ref('')
const isSavingMasterProduct = ref(false)
const isDeletingMasterProduct = ref(false)
const masterProductPendingDelete = ref<MasterProductItem | null>(null)

const masterProductEditor = reactive<MasterProductEditor>({
  id: '',
  name: '',
  description: '',
  notes: ''
})

const form = reactive<FormData>({
  number: '',
  status: 'estimate',
  client_id: '',
  vehicle_id: '',
  master_product_id: '',
  responsible_employees: [],
  entry_date: new Date().toISOString().substring(0, 10),
  expected_date: '',
  reported_defect: '',
  diagnosis: '',
  notes: '',
  items: [],
  discount: '',
  apply_taxes: false,
  selected_tax_ids: [],
  create_appointment: false,
  appointment_date: '',
  appointment_time: '08:00',
  appointment_priority: APPOINTMENT_NO_PRIORITY,
  appointment_notes: ''
})

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nextItemId() {
  itemCounter.value += 1
  return `draft-item-${itemCounter.value}`
}

function createDraftItem(overrides: Partial<ServiceOrderDraftItem> = {}): ServiceOrderDraftItem {
  return {
    id: nextItemId(),
    name: '',
    description: '',
    quantity: 1,
    unit_price: '',
    cost_price: '',
    source: 'manual',
    product_id: null,
    category_id: null,
    ...overrides
  }
}

function getProductUnitSale(product: ProductCatalogItem) {
  if (product.type === 'group') {
    return (product.group_items ?? []).reduce(
      (total, item) => total + toNumber(item.sale_price) * toNumber(item.quantity),
      0
    )
  }

  return toNumber(product.unit_sale_price)
}

function getProductUnitCost(product: ProductCatalogItem) {
  if (product.type === 'group') {
    return (product.group_items ?? []).reduce(
      (total, item) => total + toNumber(item.cost_price) * toNumber(item.quantity),
      0
    )
  }

  return toNumber(product.unit_cost_price)
}

function getEmployeeById(employeeId: string) {
  return employeeCatalog.value.find(employee => employee.id === employeeId) ?? null
}

async function loadMasterProducts(force = false) {
  if (masterProducts.value.length && !force) return

  const res = await $fetch<{ items: MasterProductItem[] }>('/api/master-products', {
    query: { page_size: 500 }
  })

  masterProducts.value = res.items ?? []
}

async function loadNextNumber() {
  const requestId = ++nextNumberRequestId
  isLoadingNextNumber.value = true

  try {
    const res = await $fetch<{ number: string }>('/api/service-orders/next-number')

    if (requestId !== nextNumberRequestId || !props.open) return
    if (!form.number.trim()) {
      form.number = res.number ?? ''
    }
  } catch {
    if (requestId === nextNumberRequestId && props.open) {
      toast.add({
        title: 'Não foi possível sugerir o número da OS',
        color: 'warning'
      })
    }
  } finally {
    if (requestId === nextNumberRequestId) {
      isLoadingNextNumber.value = false
    }
  }
}

async function loadOptions() {
  if (optionsLoaded.value || isLoadingOptions.value) return
  isLoadingOptions.value = true

  try {
    const [clientsRes, vehiclesRes, employeesRes, productsRes, masterProductsRes, taxesRes] = await Promise.all([
      $fetch<{ items: ClientItem[] }>('/api/clients', { query: { page_size: 500 } }),
      $fetch<{ items: VehicleItem[] }>('/api/vehicles', { query: { page_size: 500 } }),
      $fetch<{ items: EmployeeItem[] }>('/api/employees'),
      $fetch<{ items: ProductCatalogItem[] }>('/api/products', {
        query: { page_size: 500, sort_by: 'name', sort_order: 'asc' }
      }),
      $fetch<{ items: MasterProductItem[] }>('/api/master-products', { query: { page_size: 500 } }),
      $fetch<{ items: TaxItem[] }>('/api/taxes', {
        query: { page_size: 500, sort_by: 'name', sort_order: 'asc' }
      })
    ])

    clientOptions.value = (clientsRes.items ?? []).map(client => ({
      label: client.name,
      value: client.id
    }))
    vehicleCatalog.value = vehiclesRes.items ?? []
    employeeCatalog.value = employeesRes.items ?? []
    productCatalog.value = productsRes.items ?? []
    masterProducts.value = masterProductsRes.items ?? []
    taxesCatalog.value = taxesRes.items ?? []
    optionsLoaded.value = true
  } catch {
    toast.add({ title: 'Erro ao carregar opções', color: 'error' })
  } finally {
    isLoadingOptions.value = false
  }
}

const vehicleOptions = computed<SelectOption[]>(() => {
  const filtered = form.client_id
    ? vehicleCatalog.value.filter(vehicle => !vehicle.client_id || vehicle.client_id === form.client_id)
    : vehicleCatalog.value

  return filtered.map(vehicle => ({
    label: [vehicle.brand, vehicle.model, vehicle.license_plate].filter(Boolean).join(' - ') || '—',
    value: vehicle.id
  }))
})

const employeeSelectOptions = computed<SelectOption[]>(() =>
  employeeCatalog.value.map(employee => ({ label: employee.name, value: employee.id }))
)

const productSelectOptions = computed<SelectOption[]>(() =>
  productCatalog.value.map(product => ({
    label: `${product.name}${product.code ? ` • ${product.code}` : ''} • ${formatCurrency(getProductUnitSale(product))}`,
    value: product.id
  }))
)

const masterProductSelectOptions = computed<SelectOption[]>(() =>
  masterProducts.value.map(product => ({ label: product.name, value: product.id }))
)

const selectedMasterProduct = computed(
  () => masterProducts.value.find(product => product.id === form.master_product_id) ?? null
)

const normalizedItems = computed(() =>
  form.items
    .map((item) => {
      const quantity = Math.max(toNumber(item.quantity), 0)
      const unitPrice = Math.max(toNumber(item.unit_price), 0)
      const costPrice = Math.max(toNumber(item.cost_price), 0)
      const description = item.description.trim() || item.name.trim()
      const name = item.name.trim() || description

      return {
        name,
        description,
        quantity,
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
        cost_price: costPrice,
        product_id: item.product_id || null,
        category_id: item.category_id || null
      }
    })
    .filter(item => item.description && item.quantity > 0)
)

const subtotal = computed(() =>
  normalizedItems.value.reduce((total, item) => total + item.total_price, 0)
)

const totalCost = computed(() =>
  normalizedItems.value.reduce((total, item) => total + item.cost_price * item.quantity, 0)
)

const discountValue = computed(() => Math.max(toNumber(form.discount), 0))

const totalAmount = computed(() => Math.max(subtotal.value - discountValue.value, 0))

const selectedTaxes = computed(() => {
  if (!form.apply_taxes) return []

  return taxesCatalog.value
    .filter(tax => form.selected_tax_ids.includes(tax.id))
    .map(tax => ({
      tax_id: tax.id,
      name: tax.name,
      type: tax.type,
      rate: toNumber(tax.rate),
      calculated_amount: (totalAmount.value * toNumber(tax.rate)) / 100
    }))
})

const totalTaxesAmount = computed(() =>
  selectedTaxes.value.reduce((total, tax) => total + tax.calculated_amount, 0)
)

function computeResponsibleCommission(employee: EmployeeItem | null): CommissionResult {
  if (!employee?.has_commission) {
    return { value: 0, hasMatchingItems: true }
  }

  const commissionCategories = employee.commission_categories ?? []
  let baseAmount = totalAmount.value
  let costAmount = totalCost.value
  let hasMatchingItems = true

  if (commissionCategories.length > 0) {
    let matchingSale = 0
    let matchingCost = 0

    normalizedItems.value.forEach((item) => {
      if (item.category_id && commissionCategories.includes(item.category_id)) {
        matchingSale += item.total_price
        matchingCost += item.cost_price * item.quantity
      }
    })

    const ratio = subtotal.value > 0 ? matchingSale / subtotal.value : 0
    const proportionalDiscount = discountValue.value * ratio
    const proportionalTaxes = totalTaxesAmount.value * ratio

    baseAmount = Math.max(matchingSale - proportionalDiscount, 0)
    costAmount = matchingCost + proportionalTaxes
    hasMatchingItems = matchingSale > 0
  } else {
    costAmount = totalCost.value + totalTaxesAmount.value
  }

  if (employee.commission_base === 'profit') {
    baseAmount = Math.max(baseAmount - costAmount, 0)
  }

  const commissionAmount = toNumber(employee.commission_amount)
  let value = 0

  if (employee.commission_type === 'percentage') {
    value = (baseAmount * commissionAmount) / 100
  } else {
    value = commissionCategories.length > 0 && !hasMatchingItems ? 0 : commissionAmount
  }

  return {
    value: Number(value.toFixed(2)),
    hasMatchingItems
  }
}

const totalCommissionAmount = computed(() =>
  form.responsible_employees.reduce((total, employeeId) => {
    const employee = getEmployeeById(employeeId)
    return total + computeResponsibleCommission(employee).value
  }, 0)
)

const estimatedProfit = computed(() =>
  totalAmount.value - totalCost.value - totalTaxesAmount.value - totalCommissionAmount.value
)

const appointmentPriorityBadge = computed(() =>
  appointmentPriorityMeta[form.appointment_priority] ?? appointmentPriorityMeta[APPOINTMENT_NO_PRIORITY]
)

const filteredMasterProducts = computed(() => {
  const term = masterProductSearch.value.trim().toLowerCase()
  if (!term) return masterProducts.value

  return masterProducts.value.filter(product =>
    [product.name, product.description ?? '', product.notes ?? '']
      .join(' ')
      .toLowerCase()
      .includes(term)
  )
})

const isMasterProductDeleteModalOpen = computed({
  get: () => !!masterProductPendingDelete.value,
  set: (value: boolean) => {
    if (!value && !isDeletingMasterProduct.value) {
      masterProductPendingDelete.value = null
    }
  }
})

function getItemTotal(item: ServiceOrderDraftItem) {
  return Math.max(toNumber(item.quantity), 0) * Math.max(toNumber(item.unit_price), 0)
}

function setItemQuantity(item: ServiceOrderDraftItem, value: string | number) {
  const nextValue = Number(value)
  item.quantity = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0
}

function addManualItem() {
  form.items.push(createDraftItem())
}

function addProductItem() {
  const product = productCatalog.value.find(option => option.id === selectedProductId.value)
  if (!product) return

  form.items.push(
    createDraftItem({
      name: product.name,
      description: product.name,
      quantity: 1,
      unit_price: getProductUnitSale(product),
      cost_price: getProductUnitCost(product),
      source: 'catalog',
      product_id: product.id,
      category_id: product.category_id ?? null
    })
  )

  selectedProductId.value = ''
}

function removeItem(itemId: string) {
  form.items = form.items.filter(item => item.id !== itemId)
}

function addResponsible() {
  form.responsible_employees.push('')
}

function updateResponsible(index: number, employeeId: string) {
  form.responsible_employees[index] = employeeId
}

function removeResponsible(index: number) {
  form.responsible_employees.splice(index, 1)
}

function toggleTax(taxId: string) {
  if (form.selected_tax_ids.includes(taxId)) {
    form.selected_tax_ids = form.selected_tax_ids.filter(id => id !== taxId)
    return
  }

  form.selected_tax_ids.push(taxId)
}

function resetMasterProductEditor(product?: MasterProductItem | null) {
  masterProductEditor.id = product?.id ?? ''
  masterProductEditor.name = product?.name ?? ''
  masterProductEditor.description = product?.description ?? ''
  masterProductEditor.notes = product?.notes ?? ''
}

function openCreateMasterProduct() {
  masterProductMode.value = 'create'
  resetMasterProductEditor(null)
  showMasterProductEditor.value = true
}

function openEditMasterProduct(product: MasterProductItem) {
  masterProductMode.value = 'edit'
  resetMasterProductEditor(product)
  showMasterProductEditor.value = true
}

async function saveMasterProduct() {
  if (isSavingMasterProduct.value) return
  if (!masterProductEditor.name.trim()) {
    toast.add({ title: 'Nome do produto master é obrigatório', color: 'warning' })
    return
  }

  isSavingMasterProduct.value = true
  try {
    const body = {
      name: masterProductEditor.name.trim(),
      description: masterProductEditor.description.trim() || null,
      notes: masterProductEditor.notes.trim() || null
    }

    const response = masterProductMode.value === 'create'
      ? await $fetch<{ item: MasterProductItem }>('/api/master-products', { method: 'POST', body })
      : await $fetch<{ item: MasterProductItem }>(`/api/master-products/${masterProductEditor.id}`, {
          method: 'PUT',
          body
        })

    await loadMasterProducts(true)
    form.master_product_id = response.item.id
    showMasterProductEditor.value = false
    toast.add({
      title: masterProductMode.value === 'create' ? 'Produto master criado' : 'Produto master atualizado',
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao salvar produto master',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isSavingMasterProduct.value = false
  }
}

async function confirmDeleteMasterProduct() {
  if (!masterProductPendingDelete.value || isDeletingMasterProduct.value) return
  isDeletingMasterProduct.value = true

  try {
    await $fetch(`/api/master-products/${masterProductPendingDelete.value.id}`, { method: 'DELETE' })
    if (form.master_product_id === masterProductPendingDelete.value.id) {
      form.master_product_id = ''
    }
    await loadMasterProducts(true)
    toast.add({ title: 'Produto master removido', color: 'success' })
    masterProductPendingDelete.value = null
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao remover produto master',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isDeletingMasterProduct.value = false
  }
}

function resetForm() {
  itemCounter.value = 0
  selectedProductId.value = ''
  masterProductSearch.value = ''
  form.number = ''
  form.status = 'estimate'
  form.client_id = ''
  form.vehicle_id = ''
  form.master_product_id = ''
  form.responsible_employees = []
  form.entry_date = new Date().toISOString().substring(0, 10)
  form.expected_date = ''
  form.reported_defect = ''
  form.diagnosis = ''
  form.notes = ''
  form.items = []
  form.discount = ''
  form.apply_taxes = false
  form.selected_tax_ids = []
  form.create_appointment = false
  form.appointment_date = ''
  form.appointment_time = '08:00'
  form.appointment_priority = APPOINTMENT_NO_PRIORITY
  form.appointment_notes = ''
}

watch(
  () => props.open,
  (opened) => {
    if (opened) {
      resetForm()
      loadOptions()
      loadNextNumber()
    } else {
      nextNumberRequestId += 1
      isLoadingNextNumber.value = false
    }
  }
)

watch(
  () => form.client_id,
  (clientId) => {
    if (!form.vehicle_id) return
    const matchesVehicle = vehicleCatalog.value.some(vehicle =>
      vehicle.id === form.vehicle_id && (!clientId || !vehicle.client_id || vehicle.client_id === clientId)
    )

    if (!matchesVehicle) {
      form.vehicle_id = ''
    }
  }
)

watch(
  () => form.create_appointment,
  (enabled) => {
    if (!enabled) return
    if (!form.appointment_date) form.appointment_date = form.entry_date
    if (!form.appointment_time) form.appointment_time = '08:00'
  }
)

const isSaving = ref(false)

async function submit() {
  if (isSaving.value) return

  if (form.create_appointment) {
    if (!form.client_id) {
      toast.add({ title: 'Selecione um cliente para agendar', color: 'warning' })
      return
    }
    if (!form.vehicle_id) {
      toast.add({ title: 'Selecione um veículo para agendar', color: 'warning' })
      return
    }
    if (!form.appointment_date) {
      toast.add({ title: 'Data do agendamento é obrigatória', color: 'warning' })
      return
    }
    if (!form.appointment_time) {
      toast.add({ title: 'Horário do agendamento é obrigatório', color: 'warning' })
      return
    }
  }

  isSaving.value = true

  try {
    interface CreateResponse {
      duplicateNumber?: boolean
      suggestedNumber?: string
    }

    const res = await $fetch<CreateResponse>('/api/service-orders', {
      method: 'POST',
      body: {
        orderData: {
          number: form.number || undefined,
          status: form.status,
          payment_status: 'pending',
          client_id: form.client_id || null,
          vehicle_id: form.vehicle_id || null,
          master_product_id: form.master_product_id || null,
          responsible_employees: form.responsible_employees.filter(Boolean).map(id => ({ employee_id: id })),
          entry_date: form.entry_date || new Date().toISOString().substring(0, 10),
          expected_date: form.expected_date || null,
          reported_defect: form.reported_defect || null,
          diagnosis: form.diagnosis || null,
          notes: form.notes || null,
          items: normalizedItems.value,
          apply_taxes: form.apply_taxes,
          selected_taxes: selectedTaxes.value,
          total_taxes_amount: totalTaxesAmount.value,
          total_amount: totalAmount.value,
          total_cost_amount: totalCost.value,
          discount: discountValue.value,
          commission_amount: totalCommissionAmount.value
        },
        appointmentData: form.create_appointment
          ? {
              appointment_date: form.appointment_date,
              time: form.appointment_time,
              service_type: form.reported_defect || 'Serviço da OS',
              priority: form.appointment_priority !== APPOINTMENT_NO_PRIORITY
                ? form.appointment_priority
                : null,
              notes: form.appointment_notes || null
            }
          : null
      }
    })

    if (res?.duplicateNumber) {
      toast.add({
        title: 'Número já existe',
        description: `Sugestão: ${res.suggestedNumber}`,
        color: 'warning'
      })
      form.number = res.suggestedNumber ?? ''
      return
    }

    toast.add({ title: 'OS criada com sucesso', color: 'success' })
    emit('update:open', false)
    emit('created')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao criar OS',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{
      overlay: 'bg-default/90 backdrop-blur-sm',
      content: 'max-w-none w-screen h-dvh rounded-none flex flex-col overflow-hidden',
      header: 'p-0 shrink-0 border-b border-default',
      body: 'flex-1 min-h-0 overflow-y-auto p-0',
      footer: 'p-0 shrink-0 border-t border-default bg-default/95 backdrop-blur'
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-start gap-4 p-4 lg:px-6 lg:py-5">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          square
          @click="emit('update:open', false)"
        />

        <div class="min-w-0 flex-1 space-y-4">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div class="space-y-1.5">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
                Nova Ordem de Serviço
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :label="STATUS_LABEL[form.status] ?? 'Status'"
                :leading-icon="STATUS_ICON[form.status] ?? 'i-lucide-circle-dot'"
                :color="STATUS_COLOR[form.status] ?? 'neutral'"
                variant="subtle"
                class="px-3 py-1"
              />
              <UBadge
                color="neutral"
                variant="outline"
                leading-icon="i-lucide-credit-card"
                label="Pagamento pendente"
                class="px-3 py-1"
              />
              <UBadge
                v-if="form.apply_taxes && selectedTaxes.length"
                color="warning"
                variant="outline"
                leading-icon="i-lucide-percent"
                :label="`${selectedTaxes.length} imposto${selectedTaxes.length > 1 ? 's' : ''}`"
                class="px-3 py-1"
              />
              <UBadge
                v-if="form.create_appointment"
                :color="appointmentPriorityBadge.color"
                variant="outline"
                :leading-icon="appointmentPriorityBadge.icon"
                label="Agendamento ativo"
                class="px-3 py-1"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="isLoadingOptions" class="space-y-6 p-4 lg:p-6">
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <USkeleton class="h-80 w-full rounded-2xl" />
          <USkeleton class="h-80 w-full rounded-2xl" />
          <USkeleton class="h-72 w-full rounded-2xl" />
          <USkeleton class="h-72 w-full rounded-2xl" />
        </div>
        <USkeleton class="h-[26rem] w-full rounded-2xl" />
      </div>

      <form v-else class="space-y-6 p-4 lg:p-6" @submit.prevent="submit">
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div class="space-y-6">
            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-clipboard-list" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Informações básicas
                  </h3>
                </div>
              </template>

              <div class="space-y-4">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <UFormField label="Número da OS">
                    <UInput
                      v-model="form.number"
                      :placeholder="isLoadingNextNumber ? 'Gerando número...' : 'Auto (ex: OS4001)'"
                      class="w-full"
                    />
                    <p v-if="isLoadingNextNumber" class="mt-2 text-xs text-muted">
                      Buscando o próximo número disponível...
                    </p>
                  </UFormField>

                  <UFormField label="Status inicial">
                    <USelectMenu
                      v-model="form.status"
                      :items="statusOptions"
                      value-key="value"
                      class="w-full"
                      :search-input="false"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <UFormField label="Data de entrada">
                    <UiDatePicker
                      v-model="form.entry_date"
                      placeholder="Selecione a data"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Data prevista">
                    <UiDatePicker
                      v-model="form.expected_date"
                      placeholder="Selecione a data"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </UCard>

            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-users" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Cliente, veículo e produto master
                  </h3>
                </div>
              </template>

              <div class="space-y-4">
                <UFormField label="Cliente">
                  <USelectMenu
                    v-model="form.client_id"
                    :items="[{ label: 'Sem cliente', value: '' }, ...clientOptions]"
                    value-key="value"
                    class="w-full"
                    searchable
                  />
                </UFormField>

                <UFormField label="Veículo">
                  <USelectMenu
                    v-model="form.vehicle_id"
                    :items="[{ label: 'Sem veículo', value: '' }, ...vehicleOptions]"
                    value-key="value"
                    class="w-full"
                    searchable
                    :disabled="!!form.client_id && !vehicleOptions.length"
                  />
                </UFormField>

                <UFormField label="Produto master">
                  <div class="space-y-3">
                    <USelectMenu
                      v-model="form.master_product_id"
                      :items="[{ label: 'Sem produto master', value: '' }, ...masterProductSelectOptions]"
                      value-key="value"
                      class="w-full"
                      searchable
                    />

                    <div class="flex flex-wrap gap-2">
                      <UButton
                        label="Novo produto master"
                        icon="i-lucide-plus"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        @click="openCreateMasterProduct"
                      />
                      <UButton
                        label="Gerenciar"
                        icon="i-lucide-settings-2"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        @click="showMasterProductManager = true"
                      />
                      <UButton
                        v-if="selectedMasterProduct"
                        label="Editar selecionado"
                        icon="i-lucide-pencil"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="openEditMasterProduct(selectedMasterProduct)"
                      />
                    </div>

                    <div v-if="selectedMasterProduct" class="rounded-xl border border-default bg-elevated/50 p-3">
                      <div class="flex items-start gap-3">
                        <UIcon name="i-lucide-box" class="mt-0.5 size-4 text-primary" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-semibold text-highlighted">
                            {{ selectedMasterProduct.name }}
                          </p>
                          <p v-if="selectedMasterProduct.description" class="mt-1 text-sm text-muted">
                            {{ selectedMasterProduct.description }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </UFormField>
              </div>
            </UCard>

            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-user-round-cog" class="size-4 text-primary" />
                    <h3 class="font-semibold text-highlighted">
                      Responsáveis e comissão
                    </h3>
                  </div>

                  <UButton
                    label="Adicionar responsável"
                    icon="i-lucide-user-plus"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="addResponsible"
                  />
                </div>
              </template>

              <div class="space-y-4">
                <div v-if="!form.responsible_employees.length" class="rounded-xl border border-dashed border-default bg-elevated/40 px-4 py-8 text-center">
                  <UIcon name="i-lucide-users-round" class="mx-auto size-8 text-dimmed" />
                  <p class="mt-3 text-sm font-medium text-highlighted">
                    Nenhum responsável adicionado
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    Adicione responsáveis para já visualizar a previsão de comissão da OS.
                  </p>
                </div>

                <div v-for="(employeeId, index) in form.responsible_employees" :key="`${index}-${employeeId}`" class="rounded-xl border border-default bg-default p-4 shadow-xs">
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div class="min-w-0 flex-1 space-y-3">
                      <UFormField :label="`Responsável ${index + 1}`">
                        <USelectMenu
                          :model-value="employeeId"
                          :items="employeeSelectOptions"
                          value-key="value"
                          class="w-full"
                          searchable
                          placeholder="Selecione o funcionário"
                          @update:model-value="value => updateResponsible(index, String(value || ''))"
                        />
                      </UFormField>

                      <div v-if="getEmployeeById(employeeId)" class="rounded-xl bg-elevated/60 p-3 text-sm">
                        <div class="flex flex-wrap items-center gap-2">
                          <UBadge
                            v-if="getEmployeeById(employeeId)?.has_commission"
                            color="success"
                            variant="subtle"
                            leading-icon="i-lucide-badge-percent"
                            :label="getEmployeeById(employeeId)?.commission_type === 'percentage'
                              ? `${toNumber(getEmployeeById(employeeId)?.commission_amount)}%`
                              : formatCurrency(getEmployeeById(employeeId)?.commission_amount)"
                          />
                          <UBadge
                            color="neutral"
                            variant="outline"
                            leading-icon="i-lucide-scale"
                            :label="getEmployeeById(employeeId)?.commission_base === 'profit' ? 'Base: lucro' : 'Base: faturamento'"
                          />
                        </div>

                        <p class="mt-3 text-xs uppercase tracking-wide text-muted">
                          Comissão estimada
                        </p>
                        <p class="mt-1 text-base font-semibold text-highlighted">
                          {{ formatCurrency(computeResponsibleCommission(getEmployeeById(employeeId)).value) }}
                        </p>
                        <p
                          v-if="getEmployeeById(employeeId)?.commission_categories?.length && !computeResponsibleCommission(getEmployeeById(employeeId)).hasMatchingItems"
                          class="mt-2 text-xs text-warning"
                        >
                          Nenhum item desta OS corresponde às categorias de comissão desse responsável.
                        </p>
                        <p v-else-if="!getEmployeeById(employeeId)?.has_commission" class="mt-2 text-xs text-muted">
                          Funcionário sem comissão configurada.
                        </p>
                      </div>
                    </div>

                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      square
                      @click="removeResponsible(index)"
                    />
                  </div>
                </div>

                <div v-if="form.responsible_employees.length" class="rounded-xl border border-success/20 bg-success/10 p-4">
                  <p class="text-xs uppercase tracking-wide text-success/80">
                    Total de comissão estimada
                  </p>
                  <p class="mt-1 text-lg font-semibold text-success">
                    {{ formatCurrency(totalCommissionAmount) }}
                  </p>
                </div>
              </div>
            </UCard>
          </div>

          <div class="space-y-6">
            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-wrench" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Atendimento inicial
                  </h3>
                </div>
              </template>

              <div class="space-y-4">
                <UFormField label="Defeito relatado">
                  <UTextarea
                    v-model="form.reported_defect"
                    placeholder="Descreva o defeito relatado pelo cliente..."
                    :rows="5"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Diagnóstico">
                  <UTextarea
                    v-model="form.diagnosis"
                    placeholder="Diagnóstico técnico inicial..."
                    :rows="5"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Observações internas">
                  <UTextarea
                    v-model="form.notes"
                    placeholder="Informações adicionais para a equipe..."
                    :rows="4"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </UCard>

            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-percent" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Impostos
                  </h3>
                </div>
              </template>

              <div class="space-y-4">
                <div class="flex items-center justify-between gap-4 rounded-xl border border-default bg-elevated/50 p-4">
                  <div>
                    <p class="text-sm font-medium text-highlighted">
                      Aplicar impostos nesta OS
                    </p>
                    <p class="text-xs text-muted">
                      Os impostos entram como custo interno, sem aumentar o valor cobrado do cliente.
                    </p>
                  </div>
                  <USwitch v-model="form.apply_taxes" />
                </div>

                <div v-if="form.apply_taxes" class="space-y-3">
                  <div v-if="!taxesCatalog.length" class="rounded-xl border border-dashed border-default bg-elevated/40 px-4 py-8 text-center">
                    <UIcon name="i-lucide-percent-diamond" class="mx-auto size-8 text-dimmed" />
                    <p class="mt-3 text-sm font-medium text-highlighted">
                      Nenhum imposto cadastrado
                    </p>
                    <p class="mt-1 text-sm text-muted">
                      Cadastre impostos no módulo financeiro para utilizá-los aqui.
                    </p>
                  </div>

                  <button
                    v-for="tax in taxesCatalog"
                    :key="tax.id"
                    type="button"
                    class="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition"
                    :class="form.selected_tax_ids.includes(tax.id)
                      ? 'border-primary/40 bg-primary/8'
                      : 'border-default bg-default hover:bg-elevated/50'"
                    @click="toggleTax(tax.id)"
                  >
                    <div class="flex items-start gap-3">
                      <input
                        type="checkbox"
                        class="mt-1 size-4"
                        :checked="form.selected_tax_ids.includes(tax.id)"
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
                      <p v-if="form.selected_tax_ids.includes(tax.id)" class="text-xs text-warning">
                        {{ formatCurrency(selectedTaxes.find(item => item.tax_id === tax.id)?.calculated_amount) }}
                      </p>
                    </div>
                  </button>

                  <div class="rounded-xl border border-warning/20 bg-warning/10 p-4">
                    <p class="text-xs uppercase tracking-wide text-warning/80">
                      Total de impostos
                    </p>
                    <p class="mt-1 text-lg font-semibold text-warning">
                      {{ formatCurrency(totalTaxesAmount) }}
                    </p>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calendar-clock" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Agendamento
                  </h3>
                </div>
              </template>

              <div class="space-y-4">
                <div class="flex items-center justify-between gap-4 rounded-xl border border-default bg-elevated/50 p-4">
                  <div>
                    <p class="text-sm font-medium text-highlighted">
                      Criar agendamento automaticamente
                    </p>
                    <p class="text-xs text-muted">
                      Ao salvar a OS, um agendamento será criado com cliente, veículo e prioridade definidos abaixo.
                    </p>
                  </div>
                  <USwitch v-model="form.create_appointment" />
                </div>

                <div v-if="form.create_appointment" class="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <UFormField label="Data do agendamento" required>
                      <UiDatePicker
                        v-model="form.appointment_date"
                        placeholder="Selecione a data"
                        class="w-full"
                      />
                    </UFormField>

                    <UFormField label="Horário" required>
                      <UInput
                        v-model="form.appointment_time"
                        type="time"
                        class="w-full"
                      />
                    </UFormField>
                  </div>

                  <UFormField label="Prioridade">
                    <USelectMenu
                      v-model="form.appointment_priority"
                      :items="appointmentPriorityOptions"
                      value-key="value"
                      class="w-full"
                      :search-input="false"
                    />
                  </UFormField>

                  <div class="rounded-xl border border-default bg-default p-3">
                    <div class="flex items-center gap-2">
                      <UBadge
                        :color="appointmentPriorityBadge.color"
                        variant="subtle"
                        :leading-icon="appointmentPriorityBadge.icon"
                        :label="appointmentPriorityBadge.label"
                      />
                      <span class="text-xs text-muted">
                        Serviço será preenchido com o defeito relatado da OS.
                      </span>
                    </div>
                  </div>

                  <UFormField label="Observações do agendamento">
                    <UTextarea
                      v-model="form.appointment_notes"
                      :rows="3"
                      placeholder="Detalhes adicionais para a agenda..."
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <UCard variant="subtle">
            <template #header>
              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-package" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Itens da ordem de serviço
                  </h3>
                </div>

                <div class="flex items-center gap-2">
                  <UButton
                    label="Adicionar manual"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-square-pen"
                    @click="addManualItem"
                  />
                </div>
              </div>
            </template>

            <div class="space-y-5">
              <div class="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/10 via-elevated to-info/5 p-4">
                <div class="flex flex-col gap-4 xl:flex-row xl:items-end">
                  <UFormField label="Adicionar produto ou serviço do catálogo" class="flex-1">
                    <USelectMenu
                      v-model="selectedProductId"
                      :items="productSelectOptions"
                      value-key="value"
                      class="w-full"
                      searchable
                      placeholder="Busque pelo nome, código ou valor"
                    />
                  </UFormField>

                  <UButton
                    label="Trazer para a OS"
                    icon="i-lucide-plus"
                    size="sm"
                    :disabled="!selectedProductId"
                    @click="addProductItem"
                  />
                </div>

                <p class="mt-3 text-sm text-muted">
                  Produtos de catálogo herdam venda, custo e categoria para refletir comissão e margem já na criação.
                </p>
              </div>

              <div v-if="!form.items.length" class="rounded-2xl border border-default bg-elevated/40 px-6 py-10 text-center">
                <UIcon name="i-lucide-package-search" class="mx-auto size-10 text-dimmed" />
                <p class="mt-4 text-sm font-medium text-highlighted">
                  Nenhum item adicionado ainda
                </p>
                <p class="mt-1 text-sm text-muted">
                  Comece por um produto do catálogo ou crie um item manual para já sair com o valor previsto da OS.
                </p>
              </div>

              <div v-else class="space-y-4">
                <div class="hidden overflow-x-auto lg:block">
                  <table class="min-w-full divide-y divide-default overflow-hidden rounded-2xl border border-default bg-default text-sm">
                    <thead class="bg-elevated/70 text-left text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th class="px-4 py-3 font-medium">
                          Descrição
                        </th>
                        <th class="px-4 py-3 font-medium w-28">
                          Qtd
                        </th>
                        <th class="px-4 py-3 font-medium w-40">
                          Venda
                        </th>
                        <th class="px-4 py-3 font-medium w-40">
                          Custo
                        </th>
                        <th class="px-4 py-3 font-medium w-36 text-right">
                          Total
                        </th>
                        <th class="px-4 py-3 font-medium w-24 text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-default">
                      <tr v-for="item in form.items" :key="item.id" class="align-top">
                        <td class="px-4 py-4">
                          <div class="space-y-3">
                            <div class="flex items-center gap-2">
                              <UBadge
                                :label="item.source === 'catalog' ? 'Catálogo' : 'Manual'"
                                :color="item.source === 'catalog' ? 'primary' : 'neutral'"
                                :leading-icon="item.source === 'catalog' ? 'i-lucide-package-check' : 'i-lucide-pencil-ruler'"
                                variant="subtle"
                                size="sm"
                              />
                              <span v-if="item.name" class="text-xs text-muted">
                                {{ item.name }}
                              </span>
                            </div>

                            <UInput
                              v-model="item.description"
                              placeholder="Descrição do item"
                              class="w-full"
                            />
                          </div>
                        </td>
                        <td class="px-4 py-4">
                          <UInput
                            :model-value="String(item.quantity)"
                            type="number"
                            min="0"
                            step="0.01"
                            class="w-full"
                            @update:model-value="value => setItemQuantity(item, value)"
                          />
                        </td>
                        <td class="px-4 py-4">
                          <UiCurrencyInput v-model="item.unit_price" />
                        </td>
                        <td class="px-4 py-4">
                          <UiCurrencyInput v-model="item.cost_price" />
                        </td>
                        <td class="px-4 py-4 text-right font-semibold text-highlighted">
                          {{ formatCurrency(getItemTotal(item)) }}
                        </td>
                        <td class="px-4 py-4 text-right">
                          <UButton
                            icon="i-lucide-trash-2"
                            color="error"
                            variant="ghost"
                            square
                            @click="removeItem(item.id)"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="space-y-3 lg:hidden">
                  <div v-for="item in form.items" :key="item.id" class="rounded-2xl border border-default bg-default p-4 shadow-xs">
                    <div class="flex items-start justify-between gap-3">
                      <UBadge
                        :label="item.source === 'catalog' ? 'Catálogo' : 'Manual'"
                        :color="item.source === 'catalog' ? 'primary' : 'neutral'"
                        :leading-icon="item.source === 'catalog' ? 'i-lucide-package-check' : 'i-lucide-pencil-ruler'"
                        variant="subtle"
                        size="sm"
                      />
                      <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        square
                        @click="removeItem(item.id)"
                      />
                    </div>

                    <div class="mt-4 space-y-4">
                      <UFormField label="Descrição">
                        <UInput v-model="item.description" placeholder="Descrição do item" class="w-full" />
                      </UFormField>

                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <UFormField label="Quantidade">
                          <UInput
                            :model-value="String(item.quantity)"
                            type="number"
                            min="0"
                            step="0.01"
                            class="w-full"
                            @update:model-value="value => setItemQuantity(item, value)"
                          />
                        </UFormField>

                        <UFormField label="Venda">
                          <UiCurrencyInput v-model="item.unit_price" />
                        </UFormField>

                        <UFormField label="Custo">
                          <UiCurrencyInput v-model="item.cost_price" />
                        </UFormField>
                      </div>

                      <div class="rounded-xl bg-elevated/60 px-4 py-3 text-sm">
                        <span class="text-muted">Total do item</span>
                        <p class="mt-1 font-semibold text-highlighted">
                          {{ formatCurrency(getItemTotal(item)) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <div class="space-y-6">
            <UCard variant="subtle">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calculator" class="size-4 text-primary" />
                  <h3 class="font-semibold text-highlighted">
                    Resumo financeiro
                  </h3>
                </div>
              </template>

              <div class="space-y-4">
                <div class="rounded-2xl bg-primary/8 p-4 text-center">
                  <p class="text-sm text-muted">
                    Valor previsto para o cliente
                  </p>
                  <p class="mt-1 text-3xl font-bold text-highlighted">
                    {{ formatCurrency(totalAmount) }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    Baseado nos itens adicionados durante a criação
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-3 text-center">
                  <div class="rounded-xl bg-elevated/70 p-3">
                    <p class="text-xs uppercase tracking-wide text-muted">
                      Subtotal
                    </p>
                    <p class="mt-1 font-semibold text-highlighted">
                      {{ formatCurrency(subtotal) }}
                    </p>
                  </div>
                  <div class="rounded-xl bg-elevated/70 p-3">
                    <p class="text-xs uppercase tracking-wide text-muted">
                      Custo
                    </p>
                    <p class="mt-1 font-semibold text-error">
                      {{ formatCurrency(totalCost) }}
                    </p>
                  </div>
                  <div class="rounded-xl bg-elevated/70 p-3">
                    <p class="text-xs uppercase tracking-wide text-muted">
                      Impostos
                    </p>
                    <p class="mt-1 font-semibold text-warning">
                      {{ formatCurrency(totalTaxesAmount) }}
                    </p>
                  </div>
                  <div class="rounded-xl bg-elevated/70 p-3">
                    <p class="text-xs uppercase tracking-wide text-muted">
                      Comissão
                    </p>
                    <p class="mt-1 font-semibold text-info">
                      {{ formatCurrency(totalCommissionAmount) }}
                    </p>
                  </div>
                </div>

                <UFormField label="Desconto aplicado na OS">
                  <UiCurrencyInput v-model="form.discount" />
                </UFormField>

                <div class="rounded-xl border border-default bg-elevated/40 p-4">
                  <p class="text-xs uppercase tracking-wide text-muted">
                    Margem estimada
                  </p>
                  <p class="mt-1 text-lg font-semibold" :class="estimatedProfit >= 0 ? 'text-success' : 'text-error'">
                    {{ formatCurrency(estimatedProfit) }}
                  </p>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-end lg:px-6">
        <div class="flex items-center justify-end gap-3">
          <UButton
            label="Cancelar"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            @click="emit('update:open', false)"
          />
          <UButton
            label="Criar OS"
            icon="i-lucide-plus"
            :loading="isSaving"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </UModal>

  <UModal
    :open="showMasterProductEditor"
    :title="masterProductMode === 'create' ? 'Novo produto master' : 'Editar produto master'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
    @update:open="showMasterProductEditor = $event"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required>
          <UInput v-model="masterProductEditor.name" class="w-full" />
        </UFormField>

        <UFormField label="Descrição">
          <UTextarea v-model="masterProductEditor.description" :rows="3" class="w-full" />
        </UFormField>

        <UFormField label="Observações">
          <UTextarea v-model="masterProductEditor.notes" :rows="3" class="w-full" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          @click="showMasterProductEditor = false"
        />
        <UButton
          :label="masterProductMode === 'create' ? 'Criar' : 'Salvar'"
          icon="i-lucide-save"
          :loading="isSavingMasterProduct"
          @click="saveMasterProduct"
        />
      </div>
    </template>
  </UModal>

  <UModal
    :open="showMasterProductManager"
    title="Gerenciar produtos master"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
    @update:open="showMasterProductManager = $event"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row">
          <UInput
            v-model="masterProductSearch"
            icon="i-lucide-search"
            placeholder="Buscar produto master..."
            class="w-full"
          />
          <UButton
            label="Novo"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            @click="openCreateMasterProduct"
          />
        </div>

        <div v-if="!filteredMasterProducts.length" class="rounded-xl border border-dashed border-default bg-elevated/40 px-4 py-8 text-center">
          <UIcon name="i-lucide-box" class="mx-auto size-8 text-dimmed" />
          <p class="mt-3 text-sm font-medium text-highlighted">
            Nenhum produto master encontrado
          </p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="product in filteredMasterProducts" :key="product.id" class="rounded-xl border border-default bg-default p-4 shadow-xs">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-highlighted">
                  {{ product.name }}
                </p>
                <p v-if="product.description" class="mt-1 text-sm text-muted">
                  {{ product.description }}
                </p>
                <p v-if="product.notes" class="mt-2 text-xs text-dimmed">
                  {{ product.notes }}
                </p>
              </div>

              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-check"
                  color="success"
                  variant="ghost"
                  square
                  @click="form.master_product_id = product.id; showMasterProductManager = false"
                />
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  square
                  @click="openEditMasterProduct(product)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  square
                  @click="masterProductPendingDelete = product"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Fechar"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          @click="showMasterProductManager = false"
        />
      </div>
    </template>
  </UModal>

  <AppConfirmModal
    v-model:open="isMasterProductDeleteModalOpen"
    title="Excluir produto master"
    confirm-label="Excluir"
    confirm-color="error"
    :loading="isDeletingMasterProduct"
    @confirm="confirmDeleteMasterProduct"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir o produto master
        <strong class="text-highlighted">{{ masterProductPendingDelete?.name ?? '' }}</strong>?
      </p>
    </template>
  </AppConfirmModal>
</template>
