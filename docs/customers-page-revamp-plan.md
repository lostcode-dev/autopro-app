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

**Quando abrir**: ao clicar no ícone 🚗 na linha do cliente.

**Dados mostrados**:

```
Veículos de [Nome do Cliente]
─────────────────────────────
[Marca] [Modelo]               [Ano]
Placa: ABC-1234 · Cor: Prata · Combustível: Flex
                                          [Ver →]
─────────────────────────────
Nenhum veículo cadastrado.
[+ Cadastrar primeiro veículo]
```

**API**: `GET /api/vehicles?client_id={id}` (verificar se endpoint existe; se não, criar)

```typescript
const vehiclesModal = ref(false)
const vehiclesModalClient = ref<Client | null>(null)
const vehiclesModalData = ref<Vehicle[]>([])

async function openVehiclesModal(client: Client) {
  vehiclesModalClient.value = client
  vehiclesModal.value = true
  const result = await $fetch<{ items: Vehicle[] }>('/api/vehicles', {
    query: { client_id: client.id, page_size: 50 }
  })
  vehiclesModalData.value = result.items
}
```

---

## Parte 6: Modal de Histórico Financeiro

**Quando abrir**: ao clicar no ícone 💰 na linha do cliente.

**Layout**:
```
Histórico Financeiro — [Nome do Cliente]
─────────────────────────────────────────
  [Total de OS: 12]  [Total Faturado: R$ 4.800]  [Ticket Médio: R$ 400]
─────────────────────────────────────────
Ordens de Serviço
  OS #1042 · Troca de óleo · 12/03/2025 ............... R$ 350  [Concluída]
  OS #1039 · Revisão completa · 01/02/2025 ............. R$ 980  [Entregue]
  ...
```

**API**: `GET /api/service-orders?client_id={id}&page_size=10`

```typescript
const historyModal = ref(false)
const historyModalClient = ref<Client | null>(null)
const historyModalOrders = ref<ServiceOrder[]>([])

async function openHistoryModal(client: Client) {
  historyModalClient.value = client
  historyModal.value = true
  const result = await $fetch<{ items: ServiceOrder[] }>('/api/service-orders', {
    query: { client_id: client.id, page_size: 10 }
  })
  historyModalOrders.value = result.items
}

const historyStats = computed(() => {
  const orders = historyModalOrders.value
  const completed = orders.filter(o => ['completed', 'delivered'].includes(o.status))
  const total = completed.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  return {
    count: orders.length,
    revenue: total,
    avgTicket: completed.length > 0 ? total / completed.length : 0
  }
})
```

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
- [ ] Implementar Modal de Veículos do cliente
- [ ] Implementar Modal de Histórico Financeiro do cliente
- [ ] Adicionar botões "Importar" e "Exportar" no header

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
