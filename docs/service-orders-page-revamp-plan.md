# Service Orders Page Revamp Plan

## Objetivo

Alinhar `/app/service-orders` com a lógica completa do sistema antigo: formulário de criação/edição, avanço de status inline, processamento de pagamento, comissões, parcelas e visualização detalhada rica.

---

## Estado Atual (`app/pages/app/service-orders.vue`)

| Funcionalidade | Estado |
|---|---|
| Listagem em tabela (UTable) | ✅ Presente |
| Filtros: busca + status | ✅ Presente |
| Paginação por cursor | ✅ Presente |
| Detalhes em USlideover | ✅ Presente (somente leitura) |
| Cancelar OS | ✅ Presente |
| Deletar OS | ✅ Presente |
| **Criar/Editar OS** | ❌ Ausente |
| **Botão "Nova OS"** | ❌ Ausente |
| **Avanço de status inline** | ❌ Ausente |
| **Processamento de pagamento** | ❌ Ausente |
| **Parcelas na tela de detalhes** | ❌ Ausente |
| **Comissões na tela de detalhes** | ❌ Ausente |
| **Responsáveis na tela de detalhes** | ❌ Ausente |
| **Filtros avançados** | ❌ Ausente |
| **Duplicar OS** | ❌ Ausente |
| **Layout em cards** | ❌ (tabela atual) |

---

## Bugs Encontrados

### Bug 1 — `_clientName` / `_vehicleLabel` não existem na resposta da API

**Arquivo:** [app/pages/app/service-orders.vue](../app/pages/app/service-orders.vue) — linhas 216–219

A API retorna `client_name` e `vehicle_label`, mas o template acessa `_clientName` e `_vehicleLabel` (com prefixo `_`). Resultado: cliente e veículo sempre exibem `—` na tabela.

```vue
<!-- ATUAL (quebrado) -->
<template #client-cell="{ row }">
  {{ row.original._clientName ?? '—' }}
</template>
<template #vehicle-cell="{ row }">
  {{ row.original._vehicleLabel ?? '—' }}
</template>

<!-- CORRETO -->
<template #client-cell="{ row }">
  {{ row.original.client_name ?? '—' }}
</template>
<template #vehicle-cell="{ row }">
  {{ row.original.vehicle_label ?? '—' }}
</template>
```

**Causa:** Mismatch entre a resposta do endpoint (`index.get.ts` linhas 161–162) e o template Vue.

### Bug 2 — `data?.items` inexistente na resposta da API

**Arquivo:** [app/pages/app/service-orders.vue](../app/pages/app/service-orders.vue) — linha 213

A API retorna `{ data: { items, totalFiltered, nextCursor, ... } }`, mas o template usa `data?.items`. O dado está em `data?.data?.items`.

```vue
<!-- ATUAL (quebrado) -->
:data="data?.items || []"

<!-- CORRETO -->
:data="data?.data?.items || []"
```

E nas paginações:
```typescript
// cursor pagination: data?.hasMore → data?.data?.nextCursor
// total: data?.total → data?.data?.totalFiltered
```

---

## O Que o Sistema Antigo Tinha

### 1. Card de OS na lista (ServiceOrderListCard)

Cada OS era exibida como um card rico com:
- Ícone + número da OS (`OS #1234`)
- Badge de status da OS + badge de status de pagamento
- Badge de parcelas (`3x`) quando parcelado
- Grid com: cliente, veículo, produto master, data de entrada, responsável
- Defeito relatado (2 linhas, truncado)
- Valor total (destaque verde) + valor de comissão
- Ações por botão com tooltip: Receber Pagamento, Ver Detalhes, Editar, Avançar Status, Ver Orçamento, Corrigir OS, Duplicar, Excluir

### 2. Tela de detalhes da OS (ServiceOrderDetails)

Página completa (não slideover) com seções:
1. **Header**: OS número, status badges, botões de ação (Editar, Receber Pagamento, Cancelar Pagamento, Concluir, Cancelar OS, Voltar)
2. **Parcelas** (`OSParcelsCard`): tabela de parcelas com status (pago/pendente), botão "Marcar como pago" por parcela
3. **Comissões** (`OSCommissionsCard`): comissões agrupadas por funcionário com botão de pagamento
4. **Informações da OS** (`OSInfoCard`): datas (entrada, prevista, pagamento, conclusão), forma de pagamento, taxa de maquininha, defeito relatado, diagnóstico, observações
5. **Cliente/Veículo/Produto Master** (`OSClientVehicleCard`)
6. **Responsáveis** (`OSResponsaveisCard`): lista de funcionários responsáveis com comissão prevista
7. **Itens** (`OSItemsCard`): tabela de serviços/peças com quantidade, valor unitário, valor total, breakdown de comissão
8. **Resumo Financeiro** (`OSFinancialSummaryCard`): subtotal, desconto, impostos, custo total, comissão, lucro real
9. **Nota Fiscal** (`OSInvoiceCard`): emissão de NF-e / NFS-e

### 3. Formulário de criação/edição (ServiceOrderForm)

Seções do formulário:
1. **Informações básicas** (BasicInfoCard):
   - Número da OS (auto-gerado, editável, formato `OS1234`)
   - Status (select com ícone)
   - Cliente (busca com autocomplete, limpa veículo ao trocar)
   - Veículo (filtrado pelo cliente selecionado)
   - Produto Master (bundle de serviços pré-definidos)
   - Responsáveis (múltiplos, dinâmico — pré-preenche com responsável do cliente)
   - Datas: entrada, prevista de entrega, prevista de pagamento
   - Defeito relatado + Diagnóstico técnico
2. **Agendamento** (apenas para novas OS): opção de criar agendamento vinculado na mesma tela
3. **Impostos** (TaxesCard): toggle "Aplicar impostos" + seleção individual de impostos cadastrados
4. **Itens** (ItemsCard): busca produto por nome/código, adicionar item manual, tabela editável com qty, preço, custo
5. **Resumo Financeiro** (FinancialSummaryCard): total, custo, lucro real, campo de desconto
6. **Observações** (ObservationsCard)

### 4. Avanço de Status Inline

Fluxo linear: `orcamento → aberta → em_andamento → concluida`

Botão contextual no card mostrando o próximo passo (ícone + label):
- `orcamento` → "Abrir OS" (ícone Circle)
- `aberta` → "Em andamento" (ícone Wrench)
- `em_andamento` → "Concluir" (ícone CheckCircle2)

Bloqueado para OSs canceladas ou quando já no status final.

### 5. Processamento de Pagamento

Modal de pagamento (`PaymentModal`) com:
- Forma de pagamento (PIX, dinheiro, cartão, transferência, etc.)
- Toggle parcelado (N×) com divisão automática
- Taxa de maquininha (percentual, aplicado ao total)
- Data de vencimento por parcela
- Ao confirmar → cria lançamentos financeiros + comissões + extratos bancários
- Após pagamento → prompt "Deseja marcar a OS como concluída?"

Cancelamento de pagamento: reverte **todos** os lançamentos, comissões e movimentações bancárias.

### 6. Filtros Avançados

A API já suporta todos esses parâmetros (ver `index.get.ts`):

| Filtro | Parâmetro API | Tipo |
|---|---|---|
| Busca por número/cliente | `searchTerm` | text |
| Status | `status` | select |
| Cliente | `clientId` | select |
| Veículo | `vehicleId` | select |
| Responsável | `responsibleId` | select |
| Data de entrada | `dateFrom` + `dateTo` | date range |
| Número exato | `exactNumber` | text |

### 7. Exportação CSV

Endpoint `POST /api/service-orders/export-csv` já existe.

### 8. Duplicar OS

Cria nova OS com os mesmos dados (novo número gerado automaticamente).

---

## APIs Existentes (já implementadas)

| Endpoint | Método | Descrição |
|---|---|---|
| `GET /api/service-orders` | GET | Lista com filtros, cursor, busca |
| `POST /api/service-orders` | POST | Cria ou atualiza (`body.orderId` para update) |
| `GET /api/service-orders/next-number` | GET | Retorna próximo número de OS |
| `GET /api/service-orders/[id]` | GET | Detalhes completos (dados de display) |
| `GET /api/service-orders/[id]/edit-data` | GET | Dados para popular o formulário de edição |
| `POST /api/service-orders/[id]/cancel` | POST | Cancela a OS |
| `DELETE /api/service-orders/[id]` | DELETE | Soft delete da OS |
| `POST /api/service-orders/[id]/process-payment` | POST | Processa pagamento (cria lançamentos) |
| `DELETE /api/service-orders/[id]/payment` | DELETE | Cancela/reverte pagamento |
| `POST /api/service-orders/[id]/generate-commissions` | POST | Gera comissões da OS |
| `GET /api/service-orders/export-csv` | GET | Exporta CSV |

**A maioria das APIs está pronta. O gap principal é a camada Vue.**

---

## Plano de Implementação por Fases

### Fase 1 — Correção dos Bugs (prioridade máxima)

**Arquivo:** [app/pages/app/service-orders.vue](../app/pages/app/service-orders.vue)

1. Corrigir `row.original._clientName` → `row.original.client_name`
2. Corrigir `row.original._vehicleLabel` → `row.original.vehicle_label`
3. Corrigir `data?.items` → `data?.data?.items`
4. Corrigir `data?.total` → `data?.data?.totalFiltered`
5. Corrigir `data?.hasMore` → `data?.data?.nextCursor !== null`

---

### Fase 2 — Layout em Cards + Avanço de Status

Substituir `UTable` por cards, similar ao `ServiceOrderListCard` do antigo sistema.

**Card da OS (template):**

```vue
<div
  v-for="order in data?.data?.items ?? []"
  :key="order.id"
  class="rounded-lg border border-default bg-default hover:shadow-md transition-shadow p-4"
  :class="order.status === 'cancelled' ? 'opacity-70' : ''"
>
  <!-- Cabeçalho: número + badges -->
  <div class="flex items-start justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="size-10 rounded-full bg-primary flex items-center justify-center shrink-0">
        <UIcon name="i-lucide-clipboard-list" class="size-5 text-white" />
      </div>
      <div>
        <span class="font-bold text-lg text-highlighted">OS #{{ order.number }}</span>
        <div class="flex items-center gap-2 flex-wrap mt-1">
          <UBadge :color="statusColorMap[order.status]" variant="subtle" :label="statusLabelMap[order.status]" size="sm" />
          <UBadge v-if="order.payment_status" :color="paymentStatusColorMap[order.payment_status]" variant="soft" :label="paymentStatusLabel(order)" size="sm" />
          <UBadge v-if="order.is_installment" variant="outline" :label="`${order.installment_count}x`" size="sm" />
        </div>
      </div>
    </div>
    <!-- Valor total -->
    <div class="text-right shrink-0">
      <div class="text-2xl font-bold" :class="order.status === 'cancelled' ? 'text-muted' : 'text-success-600'">
        {{ formatCurrency(order.total_amount) }}
      </div>
      <div v-if="order.commission_amount" class="text-xs text-muted">
        Comissão: {{ formatCurrency(order.commission_amount) }}
      </div>
    </div>
  </div>

  <!-- Informações -->
  <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
    <div class="flex items-center gap-2 text-default">
      <UIcon name="i-lucide-user" class="size-4 text-muted" />
      <span>{{ order.client_name ?? '—' }}</span>
    </div>
    <div v-if="order.vehicle_label" class="flex items-center gap-2 text-default">
      <UIcon name="i-lucide-car" class="size-4 text-muted" />
      <span>{{ order.vehicle_label }}</span>
    </div>
    <div v-if="order.master_product_name" class="flex items-center gap-2 text-primary">
      <UIcon name="i-lucide-package" class="size-4" />
      <span class="font-medium">{{ order.master_product_name }}</span>
    </div>
    <div class="flex items-center gap-2 text-default">
      <UIcon name="i-lucide-calendar" class="size-4 text-muted" />
      <span>Entrada: {{ formatDate(order.entry_date) }}</span>
    </div>
    <div v-if="order.responsible_name" class="flex items-center gap-2 text-default">
      <UIcon name="i-lucide-wrench" class="size-4 text-muted" />
      <span>{{ order.responsible_name }}</span>
    </div>
  </div>

  <!-- Defeito relatado -->
  <p v-if="order.reported_defect" class="mt-2 text-sm text-muted line-clamp-2">
    {{ order.reported_defect }}
  </p>

  <!-- Ações -->
  <div class="mt-3 flex flex-wrap items-center gap-2 justify-end">
    <!-- Receber pagamento (se pendente e não orçamento/cancelada) -->
    <UButton
      v-if="canUpdate && order.payment_status === 'pending' && !['estimate', 'cancelled'].includes(order.status)"
      icon="i-lucide-credit-card"
      color="success"
      variant="outline"
      size="xs"
      title="Receber pagamento"
      @click="openPayment(order)"
    />
    <!-- Ver detalhes -->
    <UButton icon="i-lucide-eye" color="neutral" variant="outline" size="xs" @click="openDetail(order)" />
    <!-- Editar (apenas se sem pagamento registrado) -->
    <UButton
      v-if="canUpdate && !order.payment_status && order.status !== 'cancelled'"
      icon="i-lucide-pencil"
      color="neutral"
      variant="outline"
      size="xs"
      @click="openEdit(order)"
    />
    <!-- Avançar status -->
    <UButton
      v-if="canUpdate && getNextStatus(order.status)"
      :icon="advanceStatusIcon(order.status)"
      :title="advanceStatusLabel(order.status)"
      color="primary"
      variant="outline"
      size="xs"
      @click="advanceStatus(order)"
    />
    <!-- Duplicar -->
    <UButton
      v-if="canCreate"
      icon="i-lucide-copy"
      color="neutral"
      variant="outline"
      size="xs"
      title="Duplicar"
      @click="duplicate(order)"
    />
    <!-- Cancelar -->
    <UButton
      v-if="canCancel && !['cancelled', 'delivered'].includes(order.status)"
      icon="i-lucide-ban"
      color="warning"
      variant="ghost"
      size="xs"
      :loading="isCancelling && selectedOrderId === order.id"
      title="Cancelar OS"
      @click="cancelOrder(order)"
    />
    <!-- Excluir -->
    <UButton
      v-if="canDelete"
      icon="i-lucide-trash-2"
      color="error"
      variant="ghost"
      size="xs"
      @click="deleteOrder(order)"
    />
  </div>
</div>
```

**Lógica de avanço de status:**

```typescript
function getNextStatus(status: string): string | null {
  const flow: Record<string, string> = {
    estimate: 'open',
    open: 'in_progress',
    in_progress: 'completed',
  }
  return flow[status] ?? null
}

const advanceStatusLabelMap: Record<string, string> = {
  estimate: 'Abrir OS',
  open: 'Em andamento',
  in_progress: 'Concluir',
}
const advanceStatusIconMap: Record<string, string> = {
  estimate: 'i-lucide-circle',
  open: 'i-lucide-wrench',
  in_progress: 'i-lucide-check-circle-2',
}

function advanceStatusLabel(status: string) { return advanceStatusLabelMap[status] ?? 'Avançar' }
function advanceStatusIcon(status: string) { return advanceStatusIconMap[status] ?? 'i-lucide-circle' }

async function advanceStatus(order: ServiceOrder) {
  const next = getNextStatus(order.status)
  if (!next) return
  try {
    await $fetch(`/api/service-orders`, {
      method: 'POST',
      body: {
        orderId: order.id,
        orderData: { ...order, status: next }
      }
    })
    toast.add({ title: `OS avançada para ${statusLabelMap[next]}`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erro ao avançar status', color: 'error' })
  }
}
```

---

### Fase 3 — Filtros Avançados

Expandir a barra de filtros com toggle "Filtros avançados":

```typescript
// Novos filtros no script
const showAdvancedFilters = ref(false)
const clientFilter = ref('')
const vehicleFilter = ref('')
const responsibleFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const useDateFilter = ref(false)

// Incluir no useAsyncData query:
query: {
  searchTerm: searchTerm.value || undefined,
  status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
  clientId: clientFilter.value || undefined,
  vehicleId: vehicleFilter.value || undefined,
  responsibleId: responsibleFilter.value || undefined,
  dateFrom: useDateFilter.value ? dateFrom.value || undefined : undefined,
  dateTo: useDateFilter.value ? dateTo.value || undefined : undefined,
  useDateFilter: useDateFilter.value ? 'true' : undefined,
  cursor: cursor.value,
  limit
}
```

```vue
<!-- Template: seção de filtros avançados -->
<div class="p-4 border-b border-default space-y-3">
  <!-- Linha 1: busca + status + toggle avançado -->
  <div class="flex flex-wrap gap-3">
    <UInput v-model="searchTerm" placeholder="Número ou cliente..." icon="i-lucide-search" class="w-64" @update:model-value="cursor = 0" />
    <USelectMenu v-model="statusFilter" :items="statusFilterOptions" value-key="value" class="w-44" @update:model-value="cursor = 0" />
    <UButton
      :label="showAdvancedFilters ? 'Menos filtros' : 'Mais filtros'"
      :icon="showAdvancedFilters ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="showAdvancedFilters = !showAdvancedFilters"
    />
    <UButton v-if="canCreate" label="Exportar CSV" icon="i-lucide-download" color="neutral" variant="outline" size="sm" @click="exportCsv" />
  </div>

  <!-- Linha 2: filtros avançados (colapsável) -->
  <div v-if="showAdvancedFilters" class="flex flex-wrap gap-3">
    <USelectMenu v-model="clientFilter" :items="clientFilterOptions" value-key="value" placeholder="Cliente" searchable class="w-52" @update:model-value="cursor = 0" />
    <USelectMenu v-model="responsibleFilter" :items="responsibleFilterOptions" value-key="value" placeholder="Responsável" class="w-44" @update:model-value="cursor = 0" />
    <div class="flex items-center gap-2">
      <UCheckbox v-model="useDateFilter" label="Filtrar por data" @update:model-value="cursor = 0" />
      <template v-if="useDateFilter">
        <UInput v-model="dateFrom" type="date" class="w-36" @update:model-value="cursor = 0" />
        <span class="text-muted text-sm">até</span>
        <UInput v-model="dateTo" type="date" class="w-36" @update:model-value="cursor = 0" />
      </template>
    </div>
  </div>
</div>
```

Para popular os selects de cliente e responsável, buscar junto com o `useAsyncData`:

```typescript
const { data: clientsData } = await useAsyncData('so-clients', () =>
  requestFetch<{ items: any[] }>('/api/clients', { headers: requestHeaders, query: { page_size: 500 } })
)
const { data: employeesData } = await useAsyncData('so-employees', () =>
  requestFetch<{ items: any[] }>('/api/employees', { headers: requestHeaders, query: { page_size: 200 } })
)

const clientFilterOptions = computed(() => [
  { label: 'Todos os clientes', value: '' },
  ...(clientsData.value?.items ?? []).map((c: any) => ({ label: c.name, value: c.id }))
])

const responsibleFilterOptions = computed(() => [
  { label: 'Todos os responsáveis', value: '' },
  ...(employeesData.value?.items ?? []).map((e: any) => ({ label: e.name, value: e.id }))
])
```

---

### Fase 4 — Enriquecer o Detail Slideover

Adicionar as seções ausentes ao `USlideover` existente (ou aumentar para `max-w-3xl`):

**Parcelas:**
```vue
<UPageCard v-if="orderDetail.installments?.length" title="Parcelas" variant="subtle">
  <div class="space-y-2">
    <div
      v-for="installment in orderDetail.installments"
      :key="installment.id"
      class="flex items-center justify-between text-sm border-b border-default last:border-0 pb-2 last:pb-0"
    >
      <div>
        <span class="font-medium">Parcela {{ installment.installment_number }}/{{ orderDetail.installments.length }}</span>
        <span class="text-muted ml-2">{{ formatDate(installment.due_date) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span>{{ formatCurrency(installment.amount) }}</span>
        <UBadge
          :color="installment.status === 'paid' ? 'success' : 'warning'"
          variant="subtle"
          :label="installment.status === 'paid' ? 'Pago' : 'Pendente'"
          size="sm"
        />
      </div>
    </div>
  </div>
</UPageCard>
```

**Responsáveis:**
```vue
<UPageCard v-if="orderDetail.responsible_employees?.length" title="Responsáveis" variant="subtle">
  <div class="space-y-1 text-sm">
    <div
      v-for="resp in orderDetail.responsible_employees"
      :key="resp.employee_id"
      class="flex items-center gap-2"
    >
      <UIcon name="i-lucide-user" class="size-4 text-muted" />
      <span>{{ resp.employee_name ?? resp.employee_id }}</span>
    </div>
  </div>
</UPageCard>
```

O endpoint `GET /api/service-orders/[id]` precisa ser verificado para confirmar que retorna `installments` e `responsible_employees` com nomes resolvidos.

---

### Fase 5 — Formulário de Criação/Edição

Esta é a fase mais trabalhosa. O formulário deve ser implementado como uma **página separada** (`/app/service-orders/new` e `/app/service-orders/[id]/edit`) ou como um `USlideover` de largura máxima (`max-w-4xl`).

**Estrutura recomendada: página separada** (mais espaço para os itens)

**Rota:** `/app/service-orders/[id]/edit` e `/app/service-orders/new`

**Arquivo sugerido:** `app/pages/app/service-orders/[id]/edit.vue` + `new.vue` (ou componente compartilhado)

**Campos do formulário:**

```typescript
const emptyForm = () => ({
  number: '',             // auto-gerado por GET /api/service-orders/next-number
  client_id: '',
  vehicle_id: '',         // filtrado por client_id
  master_product_id: '',
  responsible_employees: [] as { employee_id: string }[],
  status: 'estimate' as string,
  entry_date: new Date().toISOString().split('T')[0],
  expected_date: '',
  expected_payment_date: '',
  reported_defect: '',
  diagnosis: '',
  items: [] as ServiceOrderItem[],
  apply_taxes: false,
  selected_taxes: [] as any[],
  total_taxes: 0,
  total_amount: 0,
  total_cost: 0,
  commission_amount: 0,
  discount: 0,
  notes: '',
  // Para criação de agendamento vinculado
  create_appointment: false,
  appointment_date: '',
  appointment_time: '',
  appointment_priority: 'medium',
  appointment_notes: '',
})

type ServiceOrderItem = {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  total_price: number
}
```

**Seções do formulário (UPageCard):**

1. **Informações Básicas**
   - Número da OS (com botão recarregar)
   - Status
   - Cliente (USelectMenu searchable)
   - Veículo (filtrado por cliente)
   - Produto Master (opcional)
   - Defeito relatado
   - Diagnóstico técnico
   - Datas: entrada, prevista entrega, prevista pagamento

2. **Responsáveis**
   - Lista dinâmica de `USelectMenu` de funcionários
   - Botão "+ Adicionar responsável"
   - Pré-preenchimento automático com `responsible_employees` do cliente

3. **Itens**
   - Campo de busca de produto (search inline)
   - Botão "+ Adicionar item manual"
   - Tabela editável: descrição, quantidade, preço unitário, preço custo, total
   - Botão remover por linha

4. **Resumo Financeiro**
   - Subtotal dos itens
   - Campo de desconto
   - Total final
   - Custo total
   - Lucro real

5. **Agendamento** (apenas nova OS):
   - Toggle "Criar agendamento junto com esta OS"
   - Campos: data, horário, prioridade, observações

6. **Observações**

**Body para salvar:**
```typescript
const body = {
  orderId: isEditing.value ? selectedId.value : null,
  orderData: {
    number: form.number,
    client_id: form.client_id,
    vehicle_id: form.vehicle_id || null,
    master_product_id: form.master_product_id || null,
    responsible_employees: form.responsible_employees,
    status: form.status,
    entry_date: form.entry_date,
    expected_date: form.expected_date || null,
    expected_payment_date: form.expected_payment_date || null,
    reported_defect: form.reported_defect || null,
    diagnosis: form.diagnosis || null,
    items: form.items,
    apply_taxes: form.apply_taxes,
    selected_taxes: form.selected_taxes,
    total_taxes: form.total_taxes,
    total_amount: form.total_amount,
    total_cost: form.total_cost,
    commission_amount: form.commission_amount,
    discount: form.discount,
    notes: form.notes || null,
  },
  appointmentData: form.create_appointment ? {
    appointment_date: form.appointment_date,
    time: form.appointment_time,
    priority: form.appointment_priority,
    notes: form.appointment_notes || null,
  } : null,
}
await $fetch('/api/service-orders', { method: 'POST', body })
```

---

### Fase 6 — Processamento de Pagamento

Implementar `PaymentModal` como um `UModal` ou `USlideover`.

**Campos:**
- Forma de pagamento (select: pix, dinheiro, cartão de crédito, cartão de débito, transferência, cheque, boleto)
- Toggle "Parcelado"
- Número de parcelas (se parcelado)
- Taxa de maquininha % (se cartão)
- Data de pagamento

**Endpoint:** `POST /api/service-orders/[id]/process-payment`

**Body:**
```typescript
{
  payment_method: string,
  is_installment: boolean,
  installment_count: number | null,
  machine_fee_percent: number,
  payment_date: string,
  // gerado pelo frontend:
  installments: Array<{
    installment_number: number,
    amount: number,
    due_date: string,
    status: 'pending' | 'paid',
  }>
}
```

Após pagamento bem-sucedido → modal de confirmação "Deseja marcar a OS como concluída?":
```typescript
async function onPaymentSuccess(order: ServiceOrder) {
  await refresh()
  if (!['completed', 'delivered', 'cancelled'].includes(order.status)) {
    // Exibir UModal de confirmação
    showFinishConfirm.value = true
    pendingFinishOrderId.value = order.id
  }
}
```

---

### Fase 7 — Duplicar OS

```typescript
async function duplicate(order: ServiceOrder) {
  try {
    // Buscar dados completos da OS para edição
    const editData = await $fetch<any>(`/api/service-orders/${order.id}/edit-data`)
    const osData = editData.data

    // Buscar próximo número
    const { nextNumber } = await $fetch<any>('/api/service-orders/next-number')

    // Criar nova OS com mesmo conteúdo mas novo número
    await $fetch('/api/service-orders', {
      method: 'POST',
      body: {
        orderId: null, // nova OS
        orderData: {
          ...osData,
          number: nextNumber,
          status: 'estimate',
          payment_status: null,
          entry_date: new Date().toISOString().split('T')[0],
          completion_date: null,
        }
      }
    })
    toast.add({ title: 'OS duplicada com sucesso', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erro ao duplicar OS', color: 'error' })
  }
}
```

---

## Resumo de Campos do banco vs API

O endpoint `GET /api/service-orders` já retorna no item:

```typescript
{
  id, number, status, payment_status,
  is_installment, installment_count,
  client_id, client_name,
  vehicle_id, vehicle_label,
  master_product_id, master_product_name,
  employee_responsible_id, responsible_name,
  responsible_employees,
  entry_date, reported_defect,
  total_amount, commission_amount,
  has_commissions, installments_progress
}
```

O endpoint `GET /api/service-orders/[id]` retorna `{ data: { order, client, vehicle, installments } }`.

---

## Checklist de Implementação

### Fase 1 — Bugfixes (imediato)
- [ ] Corrigir `_clientName` → `client_name`
- [ ] Corrigir `_vehicleLabel` → `vehicle_label`
- [ ] Corrigir `data?.items` → `data?.data?.items`
- [ ] Corrigir paginação para usar `data?.data?.nextCursor`

### Fase 2 — Cards + Avanço de Status
- [ ] Substituir `UTable` por lista de cards
- [ ] Implementar `getNextStatus()`, `advanceStatus()`
- [ ] Botões de ação por card (ver, editar, avançar, cancelar, excluir)
- [ ] Adicionar botão "Nova OS" no header

### Fase 3 — Filtros Avançados
- [ ] Buscar clientes e funcionários para os selects
- [ ] Adicionar filtros: cliente, responsável, data
- [ ] Toggle "Filtros avançados"
- [ ] Adicionar botão "Exportar CSV"

### Fase 4 — Detail Slideover Enriquecido
- [ ] Adicionar seção de parcelas
- [ ] Adicionar seção de responsáveis
- [ ] Verificar `GET /api/service-orders/[id]` retorna dados suficientes

### Fase 5 — Formulário de Criação/Edição
- [ ] Criar página `/app/service-orders/new.vue` (ou componente `ServiceOrderForm.vue`)
- [ ] Seção: Informações básicas + auto-número + status
- [ ] Seção: Cliente + veículo filtrado
- [ ] Seção: Responsáveis dinâmicos (pré-preenchimento do cliente)
- [ ] Seção: Itens com busca de produto
- [ ] Seção: Resumo financeiro com desconto
- [ ] Seção: Agendamento opcional (apenas nova OS)
- [ ] Seção: Observações
- [ ] Integrar `POST /api/service-orders` para salvar

### Fase 6 — Pagamento
- [ ] Criar `ServiceOrderPaymentModal.vue`
- [ ] Formulário: forma, parcelas, taxa maquininha
- [ ] Integrar `POST /api/service-orders/[id]/process-payment`
- [ ] Integrar `DELETE /api/service-orders/[id]/payment` (cancelar pagamento)
- [ ] Prompt de conclusão após pagamento

### Fase 7 — Duplicar
- [ ] Buscar dados com `GET /api/service-orders/[id]/edit-data`
- [ ] Criar nova OS com mesmo conteúdo + novo número

---

## O Que Não Precisa Mudar

- Schema do banco (`service_orders`, `service_order_installments`) — já correto
- Todos os endpoints de API — já implementados
- Status values (`estimate`, `open`, `in_progress`, `waiting_for_part`, `completed`, `delivered`, `cancelled`)
- Payment status values (`pending`, `paid`, `partial`)
- Permissões (`ORDERS_READ`, `ORDERS_CREATE`, `ORDERS_UPDATE`, `ORDERS_DELETE`, `ORDERS_CANCEL`)
- Header pattern (`AppPageHeader` já correto)
- Soft delete pattern
