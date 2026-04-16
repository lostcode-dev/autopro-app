# Plano: Revisão da Página /app/vehicles

## Bugs Críticos Identificados (quebram funcionalidade hoje)

### 🔴 Bug 1 — Campo `chassis` enviado, API espera `engine`

O form Vue usa `chassis` como nome do campo, mas a coluna no banco é `engine` e o endpoint valida/salva `engine`.

**Impacto**: o campo "Chassi/Motor" nunca é salvo. Qualquer valor digitado é descartado silenciosamente.

```typescript
// vehicles.vue — ERRADO (linhas 58, 81, 106)
chassis: v.chassis ?? ''
chassis: form.chassis || null

// API (index.post.ts / [id].put.ts) — espera
engine: ...

// Banco (migrations/20240101000014_create_vehicles.sql) — coluna
engine varchar(100)
```

**Fix**: renomear `chassis` → `engine` em todo `vehicles.vue`.

---

### 🔴 Bug 2 — Combustível `gnv` inválido na API

O select do form tem `{ label: 'GNV', value: 'gnv' }`, mas o endpoint valida contra `VALID_FUEL_TYPES = ['gasoline', 'ethanol', 'diesel', 'flex', 'cng', 'electric', 'hybrid']`. O valor `'gnv'` não está na lista — a request retorna 400.

**Fix**: mudar o value de `'gnv'` para `'cng'` no `fuelTypeOptions`.

---

### 🟡 Bug 3 — `useAsyncData` recebe objeto, passa array para `UTable`

O endpoint `GET /api/vehicles` retorna `{ items: [], total, page, page_size }`, mas o código faz:
```typescript
// vehicles.vue linha 24 — tipo errado
() => requestFetch<Vehicle[]>('/api/vehicles', ...)

// vehicles.vue linha 209 — desestrutura errado
:data="data || []"  // data é o objeto { items, total }, não o array
```

**Fix**: tipar corretamente e usar `data?.items || []` na tabela, e adicionar paginação.

---

## Comparativo: Sistema Antigo vs. Atual

### Layout da lista

| Aspecto | Sistema Antigo | Atual |
|---------|---------------|-------|
| Formato | Lista estilo card, click na linha → detalhes | `UTable` com colunas simples |
| Avatar | Ícone carro fundo azul | Ausente |
| Linha principal | `Marca Modelo (Ano)` em negrito | Colunas separadas |
| Linha secundária | Placa em negrito · Motor em roxo · 👤 Cliente | — |
| Click na linha | Abre view de detalhes completa | Nenhuma ação |
| Ação "Ver Detalhes" | Botão olho 👁 | Ausente |

### Busca

| Campo buscado | Sistema Antigo | Atual |
|--------------|---------------|-------|
| Placa | Sim | Sim |
| Marca | Sim | Sim |
| Modelo | Sim | Sim |
| Motor | **Sim** | Não |
| Nome do cliente | **Sim** | Não |

### Form de cadastro/edição

| Campo | Sistema Antigo | Atual | Status |
|-------|---------------|-------|--------|
| Cliente | Obrigatório | Obrigatório | OK |
| Placa | Opcional + formatação automática | Obrigatório + uppercase | Validação diferente |
| Marca | Sim (uppercase) | Sim | OK |
| Modelo | Sim (uppercase) | Sim | OK |
| Ano | Sim | Sim | OK |
| Cor | Sim (uppercase) | Sim | OK |
| Motor | `motor` — ex: "1.0 16V" | `chassis` → bug, deve ser `engine` | **Bug** |
| Combustível | `flex` default | sem default | Diferente |
| Quilometragem | Sim | Sim | OK |
| Observações | Sim | Sim | OK |
| Consulta por placa (IA) | **Sim** (InvokeLLM) | Não | Ausente |

### View de detalhes do veículo

| Elemento | Sistema Antigo | Atual |
|----------|---------------|-------|
| Página/view de detalhes | Sim (VeiculoDetalhes.jsx) | Não — apenas modal de edição |
| Informações exibidas | Ano, Cor, Motor, Combustível, KM, Proprietário (nome + tel) | — |
| Histórico de Manutenção | **Timeline com todas as OS do veículo** | Não |

---

## Parte 1: Correções de Bugs (implementar primeiro)

### Fix 1 — Renomear `chassis` → `engine` em `vehicles.vue`

```typescript
// emptyForm() — linha 50
const emptyForm = () => ({
  client_id: '',
  plate: '',
  brand: '',
  model: '',
  year: '' as string | number,
  color: '',
  mileage: '' as string | number,
  engine: '',      // era: chassis
  fuel_type: '' as string,
  notes: ''
})

// openEdit() — linha 72
Object.assign(form, {
  // ...
  engine: v.engine ?? '',   // era: chassis: v.chassis ?? ''
  // ...
})

// save() — linha 98
const body = {
  // ...
  engine: form.engine || null,   // era: chassis
  // ...
}
```

```html
<!-- Template — linha 289 -->
<UFormField label="Motor">
  <UInput v-model="form.engine" class="w-full uppercase" placeholder="Ex: 1.0 16V, 2.0 TURBO" />
</UFormField>
```

### Fix 2 — Corrigir combustível GNV

```typescript
// linha 147 — mudar value de 'gnv' para 'cng'
const fuelTypeOptions = [
  { label: 'Gasolina',  value: 'gasoline' },
  { label: 'Etanol',    value: 'ethanol'  },
  { label: 'Flex',      value: 'flex'     },
  { label: 'Diesel',    value: 'diesel'   },
  { label: 'GNV',       value: 'cng'      },  // era: 'gnv'
  { label: 'Elétrico',  value: 'electric' },
  { label: 'Híbrido',   value: 'hybrid'   }
]
```

### Fix 3 — Tipar corretamente o retorno da API

```typescript
// Antes
() => requestFetch<Vehicle[]>('/api/vehicles', ...)

// Depois
() => requestFetch<{ items: Vehicle[], total: number }>('/api/vehicles', ...)

// No template
:data="data?.items || []"
```

---

## Parte 2: Layout da Lista — Estilo Card

Substituir `UTable` por lista vertical de cards, seguindo o padrão do sistema antigo.

### Estrutura de cada item

```
┌─────────────────────────────────────────────────────────────────────┐
│  [🚗]  TOYOTA COROLLA (2021)                                        │
│        ABC-1234  ·  Motor: 2.0 16V  ·  👤 João Silva               │
│                                          [✏ Editar] [👁 Detalhes]  │
└─────────────────────────────────────────────────────────────────────┘
```

### Template Vue

```html
<div class="divide-y divide-default">
  <div
    v-for="vehicle in data?.items"
    :key="vehicle.id"
    class="flex items-center gap-4 p-4 hover:bg-elevated transition-colors cursor-pointer"
    @click="openDetails(vehicle)"
  >
    <!-- Avatar -->
    <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
      <UIcon name="i-lucide-car" class="w-5 h-5 text-white" />
    </div>

    <!-- Info principal -->
    <div class="flex-1 min-w-0">
      <p class="font-semibold">
        {{ vehicle.brand }} {{ vehicle.model }}
        <span class="text-muted font-normal">({{ vehicle.year }})</span>
      </p>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted mt-0.5">
        <span class="font-bold text-default">
          {{ vehicle.license_plate || 'Sem placa' }}
        </span>
        <span v-if="vehicle.engine" class="text-primary font-medium">
          Motor: {{ vehicle.engine }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-user" class="w-3 h-3" />
          {{ vehicle.clients?.name ?? '—' }}
        </span>
      </div>
    </div>

    <!-- Ações -->
    <div class="flex items-center gap-1 shrink-0" @click.stop>
      <UButton
        v-if="canUpdate"
        icon="i-lucide-pencil"
        variant="ghost"
        color="neutral"
        size="xs"
        @click="openEdit(vehicle)"
      />
      <UButton
        icon="i-lucide-eye"
        variant="ghost"
        color="neutral"
        size="xs"
        @click="openDetails(vehicle)"
      />
      <UButton
        v-if="canDelete"
        icon="i-lucide-trash-2"
        variant="ghost"
        color="error"
        size="xs"
        @click="remove(vehicle)"
      />
    </div>
  </div>
</div>
```

---

## Parte 3: Busca por Motor e Nome do Cliente

### Atualizar `GET /api/vehicles/index.get.ts`

O campo `search` atual filtra apenas `license_plate`, `brand`, `model`. Precisa incluir `engine` e o nome do cliente.

```typescript
// server/api/vehicles/index.get.ts — adicionar ao filtro de busca
if (search) {
  query = query.or([
    `license_plate.ilike.%${search}%`,
    `brand.ilike.%${search}%`,
    `model.ilike.%${search}%`,
    `engine.ilike.%${search}%`,          // NOVO: busca por motor
    `clients.name.ilike.%${search}%`     // NOVO: busca por nome do cliente
  ].join(','))
}
```

> **Nota**: o join com `clients` para busca por nome requer que o select inclua `clients(name)` — o que já é feito. O `.or()` com campos de tabela relacionada pode exigir uma query diferente no Supabase (via `rpc` ou subquery). Avaliar se a busca por cliente deve ser feita no frontend com os dados já carregados ou via query.

### Alternativa simples (busca no frontend)

Se a quantidade de veículos for pequena (< 1000), filtrar no frontend:

```typescript
const filteredVehicles = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return data.value?.items ?? []
  return (data.value?.items ?? []).filter(v =>
    v.license_plate?.toLowerCase().includes(q) ||
    v.brand?.toLowerCase().includes(q) ||
    v.model?.toLowerCase().includes(q) ||
    v.engine?.toLowerCase().includes(q) ||
    v.clients?.name?.toLowerCase().includes(q)
  )
})
```

---

## Parte 4: View de Detalhes do Veículo

O sistema antigo tem uma view completa ao clicar no veículo. No sistema atual, implementar como um **Slideover** (painel lateral) ou **página dedicada** `/app/vehicles/{id}`.

### Opção recomendada: Slideover lateral

```html
<USlideover v-model:open="showDetails" side="right" :ui="{ width: 'max-w-2xl' }">
  <template #header>
    <div>
      <h2 class="text-lg font-semibold">{{ selectedVehicle?.brand }} {{ selectedVehicle?.model }}</h2>
      <div class="flex items-center gap-2 mt-1">
        <UBadge :label="selectedVehicle?.license_plate || 'Sem placa'" color="neutral" />
        <UBadge v-if="selectedVehicle?.engine" :label="selectedVehicle.engine" color="primary" variant="subtle" />
      </div>
    </div>
  </template>
  <template #body>
    <div class="space-y-6 p-4">
      <!-- Ficha do veículo -->
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><span class="text-muted">Ano</span><p class="font-medium">{{ selectedVehicle?.year ?? '—' }}</p></div>
        <div><span class="text-muted">Cor</span><p class="font-medium">{{ selectedVehicle?.color ?? '—' }}</p></div>
        <div><span class="text-muted">Motor</span><p class="font-medium text-primary">{{ selectedVehicle?.engine ?? '—' }}</p></div>
        <div><span class="text-muted">Combustível</span><p class="font-medium">{{ fuelLabel(selectedVehicle?.fuel_type) }}</p></div>
        <div><span class="text-muted">Quilometragem</span><p class="font-medium">{{ selectedVehicle?.mileage ? `${selectedVehicle.mileage.toLocaleString('pt-BR')} km` : '—' }}</p></div>
        <div>
          <span class="text-muted">Proprietário</span>
          <p class="font-semibold text-orange-500">{{ selectedVehicle?.clients?.name ?? '—' }}</p>
        </div>
      </div>

      <USeparator />

      <!-- Histórico de Manutenção (timeline) -->
      <div>
        <h3 class="font-semibold mb-4 flex items-center gap-2">
          <UIcon name="i-lucide-wrench" />
          Histórico de Manutenção ({{ vehicleOrders.length }})
        </h3>
        <div v-if="vehicleOrders.length === 0" class="text-sm text-muted text-center py-8">
          Nenhum registro de manutenção para este veículo.
        </div>
        <div v-else class="relative pl-5">
          <!-- linha vertical da timeline -->
          <div class="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
          <div class="space-y-6">
            <div v-for="order in vehicleOrders" :key="order.id" class="relative">
              <!-- ponto na timeline -->
              <div class="absolute -left-3.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
              <div class="bg-elevated rounded-lg p-3 space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="font-semibold">OS #{{ order.number }}</span>
                  <UBadge :color="statusColorMap[order.status]" :label="statusLabelMap[order.status]" size="xs" />
                </div>
                <p class="text-muted text-xs">{{ formatDate(order.entry_date) }}</p>
                <p v-if="order.reported_defect" class="text-muted">{{ order.reported_defect }}</p>
                <p class="font-semibold text-success text-right">
                  R$ {{ order.total_amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</USlideover>
```

### API para buscar OS do veículo

```typescript
const vehicleOrders = ref<ServiceOrder[]>([])

async function openDetails(vehicle: Vehicle) {
  selectedVehicle.value = vehicle
  showDetails.value = true
  const result = await $fetch<{ items: ServiceOrder[] }>('/api/service-orders', {
    query: { vehicle_id: vehicle.id, page_size: 50 }
  })
  vehicleOrders.value = result.items
}
```

> Verificar se `GET /api/service-orders` aceita `vehicle_id` como filtro. Se não, adicionar.

---

## Parte 5: Formatação da Placa

O sistema antigo formata a placa automaticamente ao digitar. Implementar no Vue:

```typescript
function formatPlate(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
  // Mercosul: ABC1D23
  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean))
    return clean.replace(/^([A-Z]{3})([0-9][A-Z][0-9]{2})$/, '$1-$2')
  // Antigo: ABC1234
  if (/^[A-Z]{3}[0-9]{4}$/.test(clean))
    return clean.replace(/^([A-Z]{3})([0-9]{4})$/, '$1-$2')
  return clean
}

// No template, usar @input em vez de v-model diretamente
function onPlateInput(e: Event) {
  form.plate = formatPlate((e.target as HTMLInputElement).value)
}
```

---

## Parte 6: Placa como Opcional (alinhamento com o antigo)

O sistema antigo tem placa como **opcional** (veículos sem placa são aceitos). O sistema atual valida placa como **obrigatória** no `save()`.

```typescript
// Antes (linha 92 — validação incorreta)
if (!form.client_id || !form.plate) {
  toast.add({ title: 'Cliente e placa são obrigatórios', color: 'warning' })
  return
}

// Depois — apenas cliente é obrigatório
if (!form.client_id) {
  toast.add({ title: 'Selecione o cliente proprietário', color: 'warning' })
  return
}
```

---

## Parte 7: Paginação

O endpoint retorna `{ items, total, page, page_size }`, mas a página atual não usa paginação. Adicionar:

```typescript
const page = ref(1)
const pageSize = 30

// watch para re-fetch
const { data, status, refresh } = await useAsyncData(
  () => `vehicles-${search.value}-${page.value}`,
  () => requestFetch<{ items: Vehicle[], total: number }>('/api/vehicles', {
    headers: requestHeaders,
    query: { search: search.value || undefined, page: page.value, page_size: pageSize }
  }),
  { watch: [search, page] }
)
```

```html
<!-- Paginação no rodapé -->
<div v-if="(data?.total ?? 0) > pageSize" class="flex justify-center p-4 border-t border-default">
  <UPagination v-model="page" :page-count="pageSize" :total="data?.total ?? 0" />
</div>
```

---

## Parte 8: Checklist de Implementação

### Bugs críticos — corrigir imediatamente
- [ ] Renomear `chassis` → `engine` em todo `vehicles.vue` (emptyForm, openEdit, save, template)
- [ ] Corrigir `fuelTypeOptions`: `'gnv'` → `'cng'`
- [ ] Corrigir tipo do `useAsyncData`: `Vehicle[]` → `{ items: Vehicle[], total: number }`
- [ ] Corrigir tabela: usar `data?.items || []`

### Layout
- [ ] Substituir `UTable` por lista estilo card com avatar azul, linha de motor e cliente
- [ ] Click na linha abre view de detalhes (Slideover)
- [ ] Botão "Ver detalhes" (olho) por linha
- [ ] Renomear label "Chassi" → "Motor" no form

### Form
- [ ] Tornar `plate` opcional (remover da validação obrigatória)
- [ ] Adicionar formatação automática de placa (Mercosul e antigo)
- [ ] Adicionar dica embaixo do campo placa
- [ ] Definir `flex` como valor default para `fuel_type`

### Busca
- [ ] Ampliar busca para incluir `engine` e nome do cliente (frontend ou query)

### View de detalhes
- [ ] Implementar Slideover de detalhes do veículo
- [ ] Exibir ficha: Ano, Cor, Motor, Combustível, KM, Proprietário (nome + tel)
- [ ] Implementar timeline de Histórico de Manutenção com OS do veículo
- [ ] Verificar/adicionar filtro `vehicle_id` em `GET /api/service-orders`

### Paginação
- [ ] Adicionar paginação (`page` ref + `UPagination`)

---

## Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `app/pages/app/vehicles.vue` | Modificar — bugs, layout, lista card, detalhes, paginação |
| `server/api/vehicles/index.get.ts` | Modificar — adicionar `engine` e cliente na busca |
| `server/api/service-orders/index.get.ts` | Verificar — confirmar se aceita `vehicle_id` como filtro |
