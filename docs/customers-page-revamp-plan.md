# Plano: Revisão da Página /app/customers

## Problemas Identificados

1. **Header com padrão incorreto** — falta `<template #leading><AppSidebarCollapse /></template>` no `UDashboardNavbar`, presente em todas as outras páginas (dashboard, appointments, etc.)
2. **Layout diverge do sistema antigo** — atual usa `UTable` com colunas simples; antigo usa lista estilo card com mais informações por linha
3. **Funcionalidades ausentes** — Importar CSV, Exportar CSV, Modal de Veículos por cliente, Modal de Histórico Financeiro por cliente
4. **Filtros incompletos** — atual tem busca + tipo de pessoa; antigo tem busca + CPF/CNPJ + tipo de pessoa + responsável + veículo, com toggle expandir/recolher e contador de resultados
5. **Bug silencioso** — form atual tem campos `mobile_phone` e `birth_date`, mas a tabela `clients` **não tem essas colunas** na migration. Esses campos nunca são salvos no banco

---

## Comparativo Detalhado

### Header

| Elemento | Sistema Antigo | Atual | Ação |
|----------|---------------|-------|------|
| Sidebar collapse | — (React, sem sidebar) | **Ausente** (bug) | Adicionar `#leading` |
| Botão "Scores IA" | Sim (purple, Sparkles) | Não | Adicionar (fase 2) |
| Botão "Importar" | Sim (blue, Upload) | Não | Adicionar |
| Botão "Exportar" | Sim (green, FileDown) | Não | Adicionar |
| Botão "Novo Cliente" | Sim | Sim | OK |

### Layout da lista

| Aspecto | Sistema Antigo | Atual |
|---------|---------------|-------|
| Formato | Lista estilo card, um item por linha | `UTable` com colunas |
| Avatar | Ícone com fundo colorido | Ausente |
| Colunas/dados | Nome + badge tipo + badge score, telefone + email + responsável (linha 2), contadores veículos + OS | Nome, Tipo, CPF/CNPJ, Telefone, Email |
| Ações por item | Editar, Ver Veículos, Histórico Financeiro, Excluir | Editar, Excluir |

### Filtros

| Filtro | Sistema Antigo | Atual |
|--------|---------------|-------|
| Busca por nome | Sim (sempre visível) | Sim (busca nome/email/cpf) |
| CPF/CNPJ | Sim (expandido) | Não (está na busca geral) |
| Tipo de pessoa | Sim (expandido) | Sim |
| Responsável | Sim (expandido) | Não |
| Veículo | Sim (expandido) | Não |
| Toggle expandir | Sim | Não |
| Botão limpar filtros | Sim | Não |
| Contador de resultados | "Mostrando X de Y clientes" | Não |

---

## Parte 1: Correção Imediata — Header

**Arquivo**: [app/pages/app/customers.vue](app/pages/app/customers.vue)

```html
<!-- Antes (linha 194): -->
<UDashboardNavbar title="Clientes">
  <template #right>
    ...
  </template>
</UDashboardNavbar>

<!-- Depois: -->
<UDashboardNavbar title="Clientes">
  <template #leading>
    <AppSidebarCollapse />
  </template>
  <template #right>
    ...
  </template>
</UDashboardNavbar>
```

---

## Parte 2: Migration — Colunas Ausentes em `clients`

Os campos `mobile_phone` e `birth_date` existem no form atual mas não têm coluna no banco. Precisam de migration.

```sql
-- supabase/migrations/NEW_add_missing_fields_to_clients.sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS mobile_phone  varchar(20),
  ADD COLUMN IF NOT EXISTS birth_date    date;

COMMENT ON COLUMN public.clients.mobile_phone IS 'Número de celular (distinto do telefone fixo/comercial).';
COMMENT ON COLUMN public.clients.birth_date   IS 'Data de nascimento — aplicável a clientes PF.';
```

> Sem essa migration, qualquer valor inserido em `mobile_phone` e `birth_date` é descartado silenciosamente.

---

## Parte 3: Layout da Lista — Estilo Card

Substituir `UTable` por uma lista vertical de cards, seguindo o padrão do sistema antigo.

### Estrutura de cada item

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Avatar]  Nome do Cliente           [PF|PJ]   [Score badge]        │
│            📞 (51) 99999-9999  ✉ email@...  👤 Responsável         │
│                                           🚗 2  |  📋 5 OS          │
│                                      [Editar] [🚗] [💰] [Excluir]  │
└─────────────────────────────────────────────────────────────────────┘
```

### Dados exibidos por item

| Dado | Fonte | Observação |
|------|-------|-----------|
| Avatar com inicial | `client.name[0]` | Fundo colorido |
| Nome | `client.name` | Negrito |
| Badge tipo | `client.person_type` | "PF" ou "PJ" |
| Telefone | `client.phone` | Com ícone |
| E-mail | `client.email` | Com ícone, truncado |
| Responsável | `client.responsible_employees` (JSONB) | Join com employees |
| Qtd veículos | COUNT de vehicles do cliente | Busca separada ou inline |
| Qtd OS | COUNT de service_orders do cliente | Busca separada ou inline |
| Score IA | `clientScores[client.id]` | Opcional, calculado sob demanda |

### Template da lista (estrutura Vue)

```html
<div class="divide-y divide-default">
  <div
    v-for="client in data?.items"
    :key="client.id"
    class="flex items-center gap-4 p-4 hover:bg-elevated transition-colors"
  >
    <!-- Avatar -->
    <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
      <span class="text-white font-semibold text-sm">{{ client.name[0].toUpperCase() }}</span>
    </div>

    <!-- Info principal -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-0.5">
        <span class="font-semibold truncate">{{ client.name }}</span>
        <UBadge :label="client.person_type.toUpperCase()" color="neutral" variant="subtle" size="xs" />
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted">
        <span v-if="client.phone" class="flex items-center gap-1">
          <UIcon name="i-lucide-phone" class="w-3 h-3" />
          {{ client.phone }}
        </span>
        <span v-if="client.email" class="flex items-center gap-1 truncate">
          <UIcon name="i-lucide-mail" class="w-3 h-3" />
          {{ client.email }}
        </span>
      </div>
    </div>

    <!-- Contadores -->
    <div class="hidden sm:flex items-center gap-4 text-xs text-muted">
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-car" class="w-3 h-3" />
        {{ client._vehicleCount ?? 0 }}
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-wrench" class="w-3 h-3" />
        {{ client._orderCount ?? 0 }} OS
      </span>
    </div>

    <!-- Ações -->
    <div class="flex items-center gap-1 shrink-0">
      <UButton v-if="canUpdate" icon="i-lucide-pencil" variant="ghost" color="neutral" size="xs" @click="openEdit(client)" />
      <UButton icon="i-lucide-car" variant="ghost" color="neutral" size="xs" @click="openVehiclesModal(client)" title="Veículos" />
      <UButton icon="i-lucide-dollar-sign" variant="ghost" color="neutral" size="xs" @click="openHistoryModal(client)" title="Histórico" />
      <UButton v-if="canDelete" icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="remove(client)" />
    </div>
  </div>
</div>
```

---

## Parte 4: Filtros Avançados

### Seção de filtros com toggle expand/collapse

```html
<!-- Filtro principal (sempre visível) -->
<div class="flex flex-wrap items-center gap-3 p-4 border-b border-default">
  <UInput
    v-model="search"
    placeholder="Buscar por nome..."
    icon="i-lucide-search"
    class="w-72"
  />

  <!-- Botão expandir mais filtros -->
  <UButton
    :label="filtersExpanded ? 'Recolher filtros' : 'Mais filtros'"
    icon="i-lucide-filter"
    variant="outline"
    color="neutral"
    size="sm"
    @click="filtersExpanded = !filtersExpanded"
  />

  <!-- Limpar filtros (condicional — aparece quando há filtro ativo) -->
  <UButton
    v-if="hasActiveFilters"
    label="Limpar"
    icon="i-lucide-x"
    variant="ghost"
    color="neutral"
    size="sm"
    @click="clearFilters"
  />

  <!-- Contador de resultados -->
  <span class="text-xs text-muted ml-auto">
    Mostrando <strong>{{ data?.items?.length ?? 0 }}</strong>
    de <strong>{{ data?.total ?? 0 }}</strong> clientes
    <span v-if="hasActiveFilters" class="text-primary font-medium ml-1">· Filtros ativos</span>
  </span>
</div>

<!-- Filtros expandidos -->
<div v-if="filtersExpanded" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-default bg-elevated">
  <UFormField label="CPF / CNPJ">
    <UInput v-model="taxIdFilter" placeholder="000.000.000-00" class="w-full" @update:model-value="page = 1" />
  </UFormField>

  <UFormField label="Tipo de pessoa">
    <USelectMenu v-model="personTypeFilter" :items="personTypeFilterOptions" value-key="value" class="w-full" @update:model-value="page = 1" />
  </UFormField>

  <UFormField label="Responsável">
    <USelectMenu v-model="employeeFilter" :items="employeeOptions" value-key="value" class="w-full" placeholder="Todos" @update:model-value="page = 1" />
  </UFormField>
</div>
```

### Estado dos filtros

```typescript
const filtersExpanded = ref(false)
const search = ref('')
const taxIdFilter = ref('')
const personTypeFilter = ref('')
const employeeFilter = ref('')

const hasActiveFilters = computed(() =>
  search.value !== '' ||
  taxIdFilter.value !== '' ||
  personTypeFilter.value !== '' ||
  employeeFilter.value !== ''
)

function clearFilters() {
  search.value = ''
  taxIdFilter.value = ''
  personTypeFilter.value = ''
  employeeFilter.value = ''
  page.value = 1
}
```

---

## Parte 5: Modal de Veículos do Cliente

**Quando abrir**: ao clicar no botão `i-lucide-car` na linha do cliente.

**Funcionalidades**:
- Listar veículos do cliente
- Criar novo veículo pré-vinculado ao cliente (sem precisar ir à página de veículos)
- Editar veículo existente
- Excluir veículo

**API disponível**: `GET /api/vehicles?client_id={id}` já existe e filtra por cliente.

### Estado no `<script setup>`

```typescript
type Vehicle = {
  id: string
  client_id: string
  license_plate: string | null
  brand: string | null
  model: string | null
  year: number | null
  color: string | null
  engine: string | null
  fuel_type: string | null
  mileage: number | null
  notes: string | null
}

// ─── Modal veículos ───────────────────────────────
const showVehiclesModal = ref(false)
const vehiclesClient = ref<Client | null>(null)
const vehiclesList = ref<Vehicle[]>([])
const isLoadingVehicles = ref(false)

// ─── Form de veículo (dentro do modal) ───────────
const showVehicleForm = ref(false)
const isEditingVehicle = ref(false)
const isSavingVehicle = ref(false)
const isDeletingVehicle = ref(false)
const editingVehicleId = ref<string | null>(null)

const emptyVehicleForm = () => ({
  license_plate: '',
  brand: '',
  model: '',
  year: '' as string | number,
  color: '',
  engine: '',
  fuel_type: '' as string,
  mileage: '' as string | number,
  notes: '',
})
const vehicleForm = reactive(emptyVehicleForm())

const fuelTypeOptions = [
  { label: 'Gasolina',  value: 'gasoline' },
  { label: 'Etanol',    value: 'ethanol' },
  { label: 'Flex',      value: 'flex' },
  { label: 'Diesel',    value: 'diesel' },
  { label: 'GNV',       value: 'cng' },     // valor correto no banco é 'cng'
  { label: 'Elétrico',  value: 'electric' },
  { label: 'Híbrido',   value: 'hybrid' },
]

async function openVehiclesModal(client: Client) {
  vehiclesClient.value = client
  showVehiclesModal.value = true
  showVehicleForm.value = false
  await loadVehicles(client.id)
}

async function loadVehicles(clientId: string) {
  isLoadingVehicles.value = true
  try {
    const result = await $fetch<{ items: Vehicle[] }>('/api/vehicles', {
      query: { client_id: clientId, page_size: 100 }
    })
    vehiclesList.value = result.items ?? []
  } catch {
    toast.add({ title: 'Erro ao carregar veículos', color: 'error' })
  } finally {
    isLoadingVehicles.value = false
  }
}

function openNewVehicle() {
  Object.assign(vehicleForm, emptyVehicleForm())
  isEditingVehicle.value = false
  editingVehicleId.value = null
  showVehicleForm.value = true
}

function openEditVehicle(v: Vehicle) {
  Object.assign(vehicleForm, {
    license_plate: v.license_plate ?? '',
    brand: v.brand ?? '',
    model: v.model ?? '',
    year: v.year ?? '',
    color: v.color ?? '',
    engine: v.engine ?? '',
    fuel_type: v.fuel_type ?? '',
    mileage: v.mileage ?? '',
    notes: v.notes ?? '',
  })
  isEditingVehicle.value = true
  editingVehicleId.value = v.id
  showVehicleForm.value = true
}

async function saveVehicle() {
  if (isSavingVehicle.value) return
  isSavingVehicle.value = true
  try {
    const body = {
      client_id: vehiclesClient.value!.id,
      license_plate: vehicleForm.license_plate || null,
      brand: vehicleForm.brand || null,
      model: vehicleForm.model || null,
      year: vehicleForm.year !== '' ? Number(vehicleForm.year) : null,
      color: vehicleForm.color || null,
      engine: vehicleForm.engine || null,          // campo correto: engine (não chassis)
      fuel_type: vehicleForm.fuel_type || null,
      mileage: vehicleForm.mileage !== '' ? Number(vehicleForm.mileage) : null,
      notes: vehicleForm.notes || null,
    }
    if (isEditingVehicle.value && editingVehicleId.value) {
      await $fetch(`/api/vehicles/${editingVehicleId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Veículo atualizado', color: 'success' })
    } else {
      await $fetch('/api/vehicles', { method: 'POST', body })
      toast.add({ title: 'Veículo cadastrado', color: 'success' })
    }
    showVehicleForm.value = false
    await loadVehicles(vehiclesClient.value!.id)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSavingVehicle.value = false
  }
}

async function deleteVehicle(v: Vehicle) {
  if (isDeletingVehicle.value) return
  isDeletingVehicle.value = true
  try {
    await $fetch(`/api/vehicles/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Veículo removido', color: 'success' })
    await loadVehicles(vehiclesClient.value!.id)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeletingVehicle.value = false
  }
}

function vehicleLabel(v: Vehicle): string {
  return [v.brand, v.model].filter(Boolean).join(' ') || 'Veículo sem nome'
}

const fuelLabelMap: Record<string, string> = {
  gasoline: 'Gasolina', ethanol: 'Etanol', flex: 'Flex',
  diesel: 'Diesel', cng: 'GNV', electric: 'Elétrico', hybrid: 'Híbrido',
}
```

### Template do modal de veículos

```vue
<UModal
  v-model:open="showVehiclesModal"
  :title="showVehicleForm
    ? (isEditingVehicle ? 'Editar veículo' : 'Novo veículo')
    : `Veículos de ${vehiclesClient?.name ?? ''}`"
  :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
>
  <template #body>
    <!-- ── Lista de veículos ── -->
    <template v-if="!showVehicleForm">
      <div v-if="isLoadingVehicles" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-lg" />
      </div>

      <div v-else-if="vehiclesList.length > 0" class="space-y-2">
        <div
          v-for="v in vehiclesList"
          :key="v.id"
          class="flex items-center justify-between gap-4 rounded-lg border border-default p-3 hover:bg-elevated transition-colors"
        >
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted truncate">
              {{ vehicleLabel(v) }}
              <span v-if="v.year" class="text-muted font-normal text-sm ml-1">· {{ v.year }}</span>
            </p>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted mt-0.5">
              <span v-if="v.license_plate">Placa: <strong>{{ v.license_plate }}</strong></span>
              <span v-if="v.color">Cor: {{ v.color }}</span>
              <span v-if="v.fuel_type">{{ fuelLabelMap[v.fuel_type] ?? v.fuel_type }}</span>
              <span v-if="v.mileage">{{ v.mileage.toLocaleString('pt-BR') }} km</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openEditVehicle(v)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :loading="isDeletingVehicle"
              @click="deleteVehicle(v)"
            />
          </div>
        </div>
      </div>

      <div v-else class="py-10 text-center text-muted space-y-3">
        <UIcon name="i-lucide-car" class="size-12 mx-auto opacity-30" />
        <p class="text-sm">Nenhum veículo cadastrado para este cliente</p>
      </div>
    </template>

    <!-- ── Formulário de veículo ── -->
    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Placa">
          <UInput v-model="vehicleForm.license_plate" class="w-full uppercase" placeholder="ABC1D23" />
        </UFormField>
        <UFormField label="Combustível">
          <USelectMenu
            v-model="vehicleForm.fuel_type"
            :items="fuelTypeOptions"
            value-key="value"
            class="w-full"
            placeholder="Selecionar..."
          />
        </UFormField>
        <UFormField label="Marca">
          <UInput v-model="vehicleForm.brand" class="w-full" />
        </UFormField>
        <UFormField label="Modelo">
          <UInput v-model="vehicleForm.model" class="w-full" />
        </UFormField>
        <UFormField label="Ano">
          <UInput v-model="vehicleForm.year" type="number" min="1900" max="2100" class="w-full" />
        </UFormField>
        <UFormField label="Cor">
          <UInput v-model="vehicleForm.color" class="w-full" />
        </UFormField>
        <UFormField label="Quilometragem">
          <UInput v-model="vehicleForm.mileage" type="number" min="0" class="w-full" />
        </UFormField>
        <UFormField label="Motor">
          <!-- campo correto no banco é 'engine', não 'chassis' -->
          <UInput v-model="vehicleForm.engine" class="w-full" placeholder="Ex: 1.0 Turbo" />
        </UFormField>
        <UFormField label="Observações" class="sm:col-span-2">
          <UTextarea v-model="vehicleForm.notes" class="w-full" :rows="2" />
        </UFormField>
      </div>
    </template>
  </template>

  <template #footer>
    <!-- Footer: lista -->
    <div v-if="!showVehicleForm" class="flex justify-between items-center w-full">
      <span class="text-xs text-muted">{{ vehiclesList.length }} veículo(s)</span>
      <UButton
        label="Adicionar veículo"
        icon="i-lucide-plus"
        color="neutral"
        @click="openNewVehicle"
      />
    </div>
    <!-- Footer: formulário -->
    <div v-else class="flex justify-end gap-2 w-full">
      <UButton label="Cancelar" color="neutral" variant="ghost" @click="showVehicleForm = false" />
      <UButton
        label="Salvar"
        color="neutral"
        :loading="isSavingVehicle"
        :disabled="isSavingVehicle"
        @click="saveVehicle"
      />
    </div>
  </template>
</UModal>
```

> **Nota sobre campos**: O banco de dados usa `license_plate` (não `plate`) e `engine` (não `chassis`). O form de `/app/vehicles` tem esses nomes errados — ao implementar aqui, usar os nomes corretos da API.

---

## Parte 6: Modal de Histórico Financeiro

**Quando abrir**: ao clicar no botão `i-lucide-dollar-sign` na linha do cliente.

**Layout** (conforme o sistema antigo):
```
Histórico Financeiro — MARCELO TC
─────────────────────────────────
  Total de OS     Total Faturado    Ticket Médio
     12              R$ 4.800,00      R$ 400,00
─────────────────────────────────
Ordens de Serviço
  OS #OS4462  15/04/2026  R$ 5.845,00  [orcamento]
  OS #OS4439  01/03/2026  R$ 980,00    [concluída]
  ...
```

**API**: `GET /api/service-orders?clientId={id}&limit=50`

> A resposta da API service-orders é encapsulada: `{ data: { items, totalFiltered, ... } }`. Usar `result.data.items`.

### Estado no `<script setup>`

```typescript
type HistoryOrder = {
  id: string
  number: string
  status: string
  payment_status: string | null
  entry_date: string
  total_amount: number | null
  reported_defect: string | null
}

// ─── Modal histórico ──────────────────────────────
const showHistoryModal = ref(false)
const historyClient = ref<Client | null>(null)
const historyOrders = ref<HistoryOrder[]>([])
const isLoadingHistory = ref(false)

async function openHistoryModal(client: Client) {
  historyClient.value = client
  showHistoryModal.value = true
  historyOrders.value = []
  isLoadingHistory.value = true
  try {
    const result = await $fetch<{ data: { items: HistoryOrder[] } }>('/api/service-orders', {
      query: { clientId: client.id, limit: 50 }
    })
    historyOrders.value = result.data?.items ?? []
  } catch {
    toast.add({ title: 'Erro ao carregar histórico', color: 'error' })
  } finally {
    isLoadingHistory.value = false
  }
}

// ─── Estatísticas calculadas ─────────────────────
const historyStats = computed(() => {
  const orders = historyOrders.value
  const billed = orders.filter(o => ['completed', 'delivered'].includes(o.status))
  const totalRevenue = billed.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  return {
    totalOrders: orders.length,
    totalRevenue,
    avgTicket: billed.length > 0 ? totalRevenue / billed.length : 0,
  }
})

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string) {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
```

### Template do modal de histórico

```vue
<UModal
  v-model:open="showHistoryModal"
  :title="`Histórico Financeiro — ${historyClient?.name ?? ''}`"
  :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
>
  <template #body>
    <div v-if="isLoadingHistory" class="space-y-3">
      <div class="grid grid-cols-3 gap-3">
        <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-xl" />
      </div>
      <USkeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>

    <template v-else>
      <!-- ── Cards de resumo ── -->
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="rounded-xl border border-info-200 bg-info-50 p-4">
          <p class="text-xs font-medium text-info-600 mb-1">Total de OS</p>
          <p class="text-2xl font-bold text-info-900">{{ historyStats.totalOrders }}</p>
        </div>
        <div class="rounded-xl border border-success-200 bg-success-50 p-4">
          <p class="text-xs font-medium text-success-600 mb-1">Total Faturado</p>
          <p class="text-2xl font-bold text-success-900">{{ formatCurrency(historyStats.totalRevenue) }}</p>
        </div>
        <div class="rounded-xl border border-primary-200 bg-primary-50 p-4">
          <p class="text-xs font-medium text-primary-600 mb-1">Ticket Médio</p>
          <p class="text-2xl font-bold text-primary-900">{{ formatCurrency(historyStats.avgTicket) }}</p>
        </div>
      </div>

      <!-- ── Lista de OS ── -->
      <h4 class="text-sm font-semibold text-highlighted mb-2">Ordens de Serviço</h4>

      <div v-if="historyOrders.length > 0" class="space-y-2">
        <div
          v-for="order in historyOrders"
          :key="order.id"
          class="flex items-start justify-between gap-4 rounded-lg border border-default p-3 hover:bg-elevated transition-colors cursor-pointer"
          @click="navigateTo(`/app/service-orders?id=${order.id}`)"
        >
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted text-sm">OS #{{ order.number }}</p>
            <p v-if="order.reported_defect" class="text-xs text-muted truncate mt-0.5">
              {{ order.reported_defect }}
            </p>
            <p class="text-xs text-muted mt-0.5">{{ formatDate(order.entry_date) }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-bold text-success-600 text-sm">{{ formatCurrency(order.total_amount ?? 0) }}</p>
            <UBadge
              :color="statusColorMap[order.status] ?? 'neutral'"
              variant="subtle"
              :label="statusLabelMap[order.status] ?? order.status"
              size="xs"
              class="mt-1"
            />
          </div>
        </div>
      </div>

      <div v-else class="py-10 text-center text-muted space-y-2">
        <UIcon name="i-lucide-history" class="size-12 mx-auto opacity-30" />
        <p class="text-sm">Nenhuma ordem de serviço encontrada</p>
      </div>
    </template>
  </template>

  <template #footer>
    <div class="flex justify-between items-center w-full">
      <span class="text-xs text-muted">
        {{ historyOrders.length }} OS encontrada(s)
      </span>
      <UButton
        label="Ver todas as OSs"
        icon="i-lucide-external-link"
        color="neutral"
        variant="ghost"
        size="sm"
        :to="`/app/service-orders?clientId=${historyClient?.id}`"
      />
    </div>
  </template>
</UModal>
```

> Os `statusColorMap` e `statusLabelMap` são os mesmos da página de service-orders:
> ```typescript
> const statusColorMap = { estimate: 'neutral', open: 'info', in_progress: 'warning', waiting_for_part: 'orange', completed: 'success', delivered: 'success', cancelled: 'error' }
> const statusLabelMap = { estimate: 'Orçamento', open: 'Aberta', in_progress: 'Em andamento', waiting_for_part: 'Aguard. peça', completed: 'Concluída', delivered: 'Entregue', cancelled: 'Cancelada' }
> ```

---

## Parte 7: Importar / Exportar CSV

### Exportar (client-side, sem novo endpoint)

```typescript
function exportToCSV() {
  const clients = data.value?.items ?? []
  const headers = ['Nome', 'Tipo', 'CPF/CNPJ', 'Telefone', 'E-mail', 'CEP', 'Cidade', 'UF']
  const rows = clients.map(c => [
    c.name, c.person_type === 'pf' ? 'PF' : 'PJ',
    c.tax_id ?? '', c.phone ?? '', c.email ?? '',
    c.zip_code ?? '', c.city ?? '', c.state ?? ''
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

> O BOM (`\uFEFF`) garante que o Excel abre corretamente em PT-BR.

### Importar CSV (novo endpoint necessário)

**Arquivo a criar**: `server/api/clients/import.post.ts`

**Formato esperado do CSV** (mesma estrutura do export):
```
Nome,Tipo,CPF/CNPJ,Telefone,E-mail,CEP,Cidade,UF
João Silva,PF,123.456.789-00,(51) 99999-9999,joao@...,...,...,SP
```

**Lógica do endpoint**:
1. Receber `multipart/form-data` com campo `file` (CSV)
2. Parsear linhas (pular header)
3. Validar cada linha: nome e telefone obrigatórios
4. Upsert em lote: `INSERT ... ON CONFLICT (organization_id, tax_id) DO UPDATE` para evitar duplicatas por CPF/CNPJ
5. Retornar `{ imported: N, skipped: M, errors: [...] }`

**Modal de importação (novo componente)**: `app/components/customers/ImportModal.vue`

```
Importar Clientes
─────────────────────
Baixar modelo CSV        [⬇ Baixar modelo]

Selecionar arquivo CSV   [Escolher arquivo]

Resultado: 45 importados · 3 ignorados (já existiam)
             Erros: linha 7 — telefone inválido

                           [Cancelar] [Importar]
```

---

## Parte 8: Atualizar Endpoint `GET /api/clients`

### Adicionar filtro por `tax_id` e `employee_id`

**Arquivo**: `server/api/clients/index.get.ts`

```typescript
// Parâmetros a adicionar ao schema de query:
const query = getQuery(event)

// Já existem: search, person_type, page, page_size
// Adicionar:
const taxId    = query.tax_id    ? String(query.tax_id) : null
const employeeId = query.employee_id ? String(query.employee_id) : null

// Filtro por tax_id (busca parcial por dígitos)
if (taxId) {
  supabaseQuery = supabaseQuery.ilike('tax_id', `%${taxId.replace(/\D/g, '')}%`)
}

// Filtro por responsável (dentro do JSONB responsible_employees)
if (employeeId) {
  supabaseQuery = supabaseQuery.contains('responsible_employees', [{ employee_id: employeeId }])
}
```

### Incluir contadores de veículos e OS na listagem

Para mostrar `_vehicleCount` e `_orderCount` na lista, há duas abordagens:

**Opção A (recomendada)**: Incluir no retorno do endpoint via subquery Supabase
```typescript
// Usar select com count de tabelas relacionadas
.select(`
  *,
  _vehicleCount:vehicles(count),
  _orderCount:service_orders(count)
`)
```

**Opção B**: Buscar separadamente no frontend (mais simples mas mais requests)

---

## Parte 9: Buscar Employees para o Filtro de Responsável

O select de "Responsável" nos filtros precisa da lista de funcionários:

```typescript
// Buscar employees para popular o select de filtro
const { data: employees } = await useAsyncData('customers-employees', () =>
  requestFetch<{ items: Employee[] }>('/api/employees', {
    headers: requestHeaders,
    query: { page_size: 100 }
  })
)

const employeeOptions = computed(() => [
  { label: 'Todos os responsáveis', value: '' },
  ...(employees.value?.items ?? []).map(e => ({ label: e.name, value: e.id }))
])
```

---

## Parte 10: Checklist de Implementação

### Correções imediatas (sem novas features)
- [ ] Adicionar `<template #leading><AppSidebarCollapse /></template>` no `UDashboardNavbar` de `customers.vue`
- [ ] Criar migration `NEW_add_missing_fields_to_clients.sql` com `mobile_phone` e `birth_date`

### Layout
- [ ] Substituir `UTable` por lista estilo card com avatar, contadores e todas as ações
- [ ] Adicionar botões de ação: editar, veículos, histórico, excluir

### Filtros
- [ ] Adicionar toggle "Mais filtros" / "Recolher filtros"
- [ ] Adicionar filtro por CPF/CNPJ
- [ ] Adicionar filtro por responsável (requer busca de employees)
- [ ] Adicionar botão "Limpar filtros" (condicional)
- [ ] Adicionar contador "Mostrando X de Y clientes"

### Funcionalidades
- [ ] Implementar exportação CSV (client-side)
- [ ] Criar endpoint `POST /api/clients/import` para importação em lote
- [ ] Criar componente `ImportModal.vue` com preview de resultado
- [ ] Adicionar botões "Importar" e "Exportar" no header

#### Modal de Veículos (Parte 5)
- [ ] Adicionar botão `i-lucide-car` nas ações de cada cliente (tabela e card)
- [ ] Implementar `openVehiclesModal()`, `loadVehicles()`, `openNewVehicle()`, `openEditVehicle()`, `saveVehicle()`, `deleteVehicle()`
- [ ] Criar formulário inline com campos corretos: `license_plate`, `brand`, `model`, `year`, `color`, `engine`, `fuel_type`, `mileage`, `notes`
- [ ] Usar `value: 'cng'` para GNV (não `'gnv'`) — verificar `VALID_FUEL_TYPES` na API
- [ ] Usar `engine` como nome do campo (não `chassis`) — bug existente na página de veículos
- [ ] Modo dual no footer: lista → botão "Adicionar veículo"; form → botões Cancelar/Salvar

#### Modal de Histórico Financeiro (Parte 6)
- [ ] Adicionar botão `i-lucide-dollar-sign` nas ações de cada cliente (tabela e card)
- [ ] Implementar `openHistoryModal()` com fetch para `GET /api/service-orders?clientId={id}&limit=50`
- [ ] Usar `result.data.items` (resposta encapsulada em `data.data`)
- [ ] Cards de resumo: Total de OS, Total Faturado (apenas concluídas/entregues), Ticket Médio
- [ ] Lista de OS: número, data entrada, defeito relatado, valor, badge de status
- [ ] Botão "Ver todas as OSs" no footer → link para `/app/service-orders?clientId={id}`

### API
- [ ] Adicionar filtros `tax_id` e `employee_id` em `GET /api/clients`
- [ ] Incluir contadores `_vehicleCount` e `_orderCount` no retorno da lista
- [ ] Verificar se `GET /api/vehicles?client_id=` existe; criar se necessário

---

## Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `app/pages/app/customers.vue` | Modificar — header, layout lista, filtros, modais |
| `supabase/migrations/NEW_add_missing_fields_to_clients.sql` | Criar — `mobile_phone`, `birth_date` |
| `server/api/clients/index.get.ts` | Modificar — filtros `tax_id`, `employee_id`, contadores |
| `server/api/clients/import.post.ts` | Criar — importação CSV em lote |
| `app/components/customers/ImportModal.vue` | Criar — modal de importação com feedback |
