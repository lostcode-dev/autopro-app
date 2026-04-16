# Appointments Page Revamp Plan

## Objetivo

Alinhar `/app/appointments` com a lógica e UX do sistema antigo (React), que oferecia 4 modos de visualização, troca de status inline e formulário com filtragem dinâmica de veículos + vínculo com Ordens de Serviço abertas.

---

## Estado Atual (`app/pages/app/appointments.vue`)

- Tabela (`UTable`) com busca por tipo de serviço e filtro de status.
- Paginação de 30 itens por página.
- Modal para criar/editar com todos os campos.
- Nenhuma troca de status inline — só via modal de edição.
- Dropdown de veículos carrega **todos** os veículos da oficina (não filtra pelo cliente selecionado).
- Campo `service_order_id` existe no banco e na API, mas está **ausente** do formulário Vue.
- Um único modo de visualização (tabela).

---

## O Que o Sistema Antigo Tinha

| Funcionalidade | Antigo (React) | Novo (Nuxt) |
|---|---|---|
| Modos de visualização | 4: Mês, Semana, Dia, Lista | 1: Tabela |
| Visualização padrão | Semana | Tabela |
| Troca de status inline | Sim (dropdown no badge) | Não |
| Filtro de veículo por cliente | Sim (dinâmico no form) | Não |
| Vínculo com OS | Sim (`ordem_servico_id`) | Campo existe na API, sem UI |
| Agrupamento por data (lista) | Sim (data como header sticky) | Não |
| Navegação semana/dia | Sim (prev/next + Hoje) | Não |

---

## Bugs e Problemas a Corrigir

### Bug 1 — Veículo não filtrado por cliente no formulário

**Arquivo:** [app/pages/app/appointments.vue](../app/pages/app/appointments.vue) — linha 53

```typescript
// ATUAL: carrega todos os veículos
const vehicleOptions = computed(() =>
  (vehiclesData.value?.items ?? []).map((v: any) => ({
    label: [v.brand, v.model, v.license_plate].filter(Boolean).join(' - '),
    value: v.id
  }))
)

// CORRETO: filtrar pelo cliente selecionado no form
const vehicleOptions = computed(() =>
  (vehiclesData.value?.items ?? [])
    .filter((v: any) => !form.client_id || v.client_id === form.client_id)
    .map((v: any) => ({
      label: [v.brand, v.model, v.license_plate].filter(Boolean).join(' - '),
      value: v.id
    }))
)
```

Além disso, quando o cliente muda, zerar o `vehicle_id` selecionado:

```typescript
watch(() => form.client_id, () => {
  form.vehicle_id = ''
})
```

### Bug 2 — Campo `service_order_id` ausente no formulário

O banco e a API `POST /api/appointments` já suportam `service_order_id`, mas o form Vue não expõe esse campo. Ver Seção "Melhorias no Formulário" abaixo.

---

## Melhorias Planejadas

### 1. Toggle de Modos de Visualização

Adicionar ao header 4 botões de modo de visualização:

```vue
<!-- No AppPageHeader, slot #right, antes do botão "Novo agendamento" -->
<div class="flex items-center rounded-lg border border-default overflow-hidden">
  <UButton
    v-for="v in views"
    :key="v.value"
    :icon="v.icon"
    :label="v.label"
    size="sm"
    :color="currentView === v.value ? 'primary' : 'neutral'"
    :variant="currentView === v.value ? 'solid' : 'ghost'"
    class="rounded-none"
    @click="currentView = v.value"
  />
</div>
```

```typescript
const views = [
  { value: 'week',  label: 'Semana',    icon: 'i-lucide-calendar' },
  { value: 'day',   label: 'Dia',       icon: 'i-lucide-calendar-days' },
  { value: 'list',  label: 'Lista',     icon: 'i-lucide-list' },
  { value: 'month', label: 'Mês',       icon: 'i-lucide-grid-3x3' },
]

const currentView = ref<'week' | 'day' | 'list' | 'month'>('week')
const selectedDate = ref(new Date())
```

---

### 2. Troca de Status Inline

Substituir o badge estático por um `UDropdownMenu` clicável em todos os modos de visualização:

```vue
<UDropdownMenu
  v-if="canUpdate"
  :items="[
    [
      { label: 'Agendado',  click: () => changeStatus(appt, 'scheduled') },
      { label: 'Confirmado', click: () => changeStatus(appt, 'confirmed') },
      { label: 'Concluído', click: () => changeStatus(appt, 'completed') },
      { label: 'Cancelado', click: () => changeStatus(appt, 'cancelled') },
    ]
  ]"
>
  <UBadge
    :color="statusColorMap[appt.status]"
    variant="subtle"
    :label="statusLabelMap[appt.status]"
    class="cursor-pointer"
  />
</UDropdownMenu>
<UBadge
  v-else
  :color="statusColorMap[appt.status]"
  variant="subtle"
  :label="statusLabelMap[appt.status]"
/>
```

```typescript
async function changeStatus(appt: Appointment, newStatus: string) {
  try {
    await $fetch(`/api/appointments/${appt.id}`, {
      method: 'PUT',
      body: { ...appt, status: newStatus }
    })
    await refresh()
  } catch {
    toast.add({ title: 'Erro ao atualizar status', color: 'error' })
  }
}
```

---

### 3. Visualização Semana (padrão)

Agrupa os agendamentos por dia para a semana atual. Navegação para semana anterior/próxima.

**Dados necessários:** A API já suporta `date_from` e `date_to`. Buscar sempre 7 dias a partir do início da semana:

```typescript
const weekStart = computed(() => {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - d.getDay()) // domingo
  return d
})

const weekEnd = computed(() => {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 6)
  return d
})

// Parâmetros para a API
const dateFrom = computed(() => weekStart.value.toISOString().split('T')[0])
const dateTo = computed(() => weekEnd.value.toISOString().split('T')[0])
```

**Estrutura do template da semana:**

```vue
<template v-if="currentView === 'week'">
  <!-- Navegação -->
  <div class="flex items-center justify-between p-4 border-b border-default">
    <span class="font-semibold text-sm text-highlighted">
      Semana de {{ formatDate(weekStart) }} — {{ formatDate(weekEnd) }}
    </span>
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs" @click="prevWeek" />
      <UButton label="Hoje" color="neutral" variant="ghost" size="xs" @click="goToday" />
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs" @click="nextWeek" />
    </div>
  </div>

  <!-- Dias da semana -->
  <div class="divide-y divide-default">
    <div v-for="day in weekDays" :key="day" class="p-4">
      <!-- Header do dia -->
      <div
        class="flex items-center gap-3 mb-3 sticky top-0 bg-default py-1 z-10"
        :class="isToday(day) ? 'text-primary' : 'text-muted'"
      >
        <span class="text-xs font-semibold uppercase tracking-wide">
          {{ formatDayLabel(day) }}
        </span>
        <span v-if="isToday(day)" class="text-xs font-medium text-primary">Hoje</span>
        <span class="text-xs text-muted ml-auto">
          {{ appointmentsForDay(day).length }} agendamento(s)
        </span>
      </div>

      <!-- Agendamentos do dia -->
      <div v-if="appointmentsForDay(day).length > 0" class="space-y-2">
        <div
          v-for="appt in appointmentsForDay(day)"
          :key="appt.id"
          class="flex items-start gap-3 p-3 rounded-lg border border-default hover:bg-elevated transition-colors"
          :class="priorityBorderMap[appt.priority]"
        >
          <span class="font-bold text-sm text-highlighted shrink-0 w-12">{{ appt.time }}</span>
          <div class="flex-1 min-w-0 space-y-1">
            <p class="font-semibold text-sm text-highlighted truncate">{{ appt.service_type }}</p>
            <div class="flex items-center gap-3 text-xs text-muted">
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-user" class="size-3" />
                {{ appt.clients?.name ?? '—' }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-car" class="size-3" />
                {{ vehicleLabel(appt.vehicles) }}
              </span>
            </div>
            <p v-if="appt.notes" class="text-xs text-muted italic truncate">"{{ appt.notes }}"</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- Status badge com dropdown -->
            <AppointmentStatusDropdown :appt="appt" :can-update="canUpdate" @change="changeStatus" />
            <UButton
              v-if="canUpdate"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openEdit(appt)"
            />
          </div>
        </div>
      </div>

      <p v-else class="text-xs text-muted py-2 pl-1">Sem agendamentos</p>
    </div>
  </div>
</template>
```

**Helpers:**

```typescript
function appointmentsForDay(dateStr: string): Appointment[] {
  return (data.value?.items ?? [])
    .filter(a => a.appointment_date === dateStr)
    .sort((a, b) => a.time.localeCompare(b.time))
}

const weekDays = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
})

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

function vehicleLabel(v?: any) {
  if (!v) return '—'
  return [v.brand, v.model, v.license_plate].filter(Boolean).join(' ')
}

const priorityBorderMap: Record<string, string> = {
  low:    'border-l-4 border-l-neutral-300',
  medium: 'border-l-4 border-l-warning-400',
  high:   'border-l-4 border-l-error-500',
}
```

---

### 4. Visualização Dia

Semelhante à semana, mas para um único dia. Inclui navegação dia a dia.

```vue
<template v-if="currentView === 'day'">
  <div class="flex items-center justify-between p-4 border-b border-default">
    <span class="font-semibold text-sm text-highlighted capitalize">
      {{ formatDayLabelFull(selectedDayStr) }}
      <span v-if="isToday(selectedDayStr)" class="text-xs text-primary font-normal ml-2">Hoje</span>
    </span>
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs" @click="prevDay" />
      <UButton label="Hoje" color="neutral" variant="ghost" size="xs" @click="goToday" />
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs" @click="nextDay" />
    </div>
  </div>

  <div class="p-4 space-y-3">
    <template v-if="appointmentsForDay(selectedDayStr).length > 0">
      <!-- mesmo card da semana mas em tamanho maior -->
      <div
        v-for="appt in appointmentsForDay(selectedDayStr)"
        :key="appt.id"
        class="flex items-start gap-4 p-4 rounded-lg border border-default"
        :class="priorityBorderMap[appt.priority]"
      >
        <div class="text-center shrink-0">
          <span class="font-bold text-xl text-highlighted">{{ appt.time }}</span>
        </div>
        <div class="flex-1 space-y-2">
          <p class="font-semibold text-highlighted">{{ appt.service_type }}</p>
          <div class="flex items-center gap-4 text-sm text-muted">
            <span class="flex items-center gap-1"><UIcon name="i-lucide-user" class="size-3.5" />{{ appt.clients?.name ?? '—' }}</span>
            <span class="flex items-center gap-1"><UIcon name="i-lucide-car" class="size-3.5" />{{ vehicleLabel(appt.vehicles) }}</span>
          </div>
          <p v-if="appt.notes" class="text-sm text-muted italic">"{{ appt.notes }}"</p>
          <div v-if="appt.service_order_id">
            <UButton
              label="Ver OS vinculada"
              icon="i-lucide-link"
              size="xs"
              color="neutral"
              variant="outline"
              :to="`/app/service-orders?id=${appt.service_order_id}`"
            />
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <AppointmentStatusDropdown :appt="appt" :can-update="canUpdate" @change="changeStatus" />
          <UButton v-if="canUpdate" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(appt)" />
        </div>
      </div>
    </template>
    <div v-else class="text-center py-16 text-muted">
      <UIcon name="i-lucide-clock" class="size-12 mx-auto mb-4 opacity-30" />
      <p>Nenhum agendamento para este dia</p>
    </div>
  </div>
</template>
```

```typescript
const selectedDayStr = computed(() => selectedDate.value.toISOString().split('T')[0])

function prevDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = d
}
function nextDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  selectedDate.value = d
}
```

---

### 5. Visualização Lista (agrupada por data)

```vue
<template v-if="currentView === 'list'">
  <!-- Filtros mantidos -->
  <div class="flex flex-wrap gap-3 p-4 border-b border-default">
    <UInput v-model="search" placeholder="Buscar por serviço..." icon="i-lucide-search" class="w-72" @update:model-value="page = 1" />
    <USelectMenu v-model="statusFilter" :items="statusOptions" value-key="value" class="w-44" @update:model-value="page = 1" />
  </div>

  <div class="divide-y divide-default">
    <template v-for="(group, date) in groupedByDate" :key="date">
      <!-- Cabeçalho da data -->
      <div class="px-4 py-2 bg-elevated sticky top-0 z-10">
        <span class="text-sm font-semibold text-highlighted">{{ formatDayLabelFull(date as string) }}</span>
      </div>
      <!-- Cards do dia -->
      <div
        v-for="appt in group"
        :key="appt.id"
        class="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors"
        :class="priorityBorderMap[appt.priority]"
      >
        <span class="font-bold text-sm text-highlighted shrink-0 w-12">{{ appt.time }}</span>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm text-highlighted">{{ appt.service_type }}</p>
          <p class="text-xs text-muted">{{ appt.clients?.name ?? '—' }} · {{ vehicleLabel(appt.vehicles) }}</p>
          <p v-if="appt.notes" class="text-xs text-muted italic">"{{ appt.notes }}"</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <AppointmentStatusDropdown :appt="appt" :can-update="canUpdate" @change="changeStatus" />
          <UButton v-if="canUpdate" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(appt)" />
          <UButton v-if="canDelete" icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="remove(appt)" />
        </div>
      </div>
    </template>
  </div>

  <!-- Paginação (mantida) -->
  <div v-if="(data?.total || 0) > pageSize" class="flex justify-center p-4 border-t border-default">
    <UPagination v-model="page" :page-count="pageSize" :total="data?.total || 0" />
  </div>
</template>
```

```typescript
const groupedByDate = computed(() => {
  const groups: Record<string, Appointment[]> = {}
  for (const appt of (data.value?.items ?? [])) {
    if (!groups[appt.appointment_date]) groups[appt.appointment_date] = []
    groups[appt.appointment_date].push(appt)
    groups[appt.appointment_date].sort((a, b) => a.time.localeCompare(b.time))
  }
  // Ordenar datas em ordem crescente
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)))
})
```

---

### 6. Visualização Mês (lower priority)

Calendário mensal com pontos indicando agendamentos por dia. Clicar em um dia muda para a visualização Dia.

```vue
<template v-if="currentView === 'month'">
  <!-- Cabeçalho de navegação -->
  <div class="flex items-center justify-between p-4 border-b border-default">
    <span class="font-semibold">{{ formatMonthLabel(selectedDate) }}</span>
    <div class="flex gap-2">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs" @click="prevMonth" />
      <UButton label="Hoje" color="neutral" variant="ghost" size="xs" @click="goToday" />
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs" @click="nextMonth" />
    </div>
  </div>

  <!-- Grid 7 colunas -->
  <div class="p-4">
    <div class="grid grid-cols-7 text-center text-xs font-semibold text-muted pb-2">
      <span v-for="d in ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']" :key="d">{{ d }}</span>
    </div>
    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="cell in monthCells"
        :key="cell.dateStr"
        class="aspect-square p-1 rounded-lg text-sm flex flex-col items-center justify-start hover:bg-elevated transition-colors"
        :class="[
          cell.isCurrentMonth ? 'text-highlighted' : 'text-muted opacity-40',
          isToday(cell.dateStr) ? 'bg-primary/10 font-bold text-primary' : '',
        ]"
        @click="selectDayFromCalendar(cell.dateStr)"
      >
        <span>{{ cell.day }}</span>
        <!-- Indicadores de agendamentos -->
        <div class="flex gap-0.5 mt-1 flex-wrap justify-center">
          <span
            v-for="(appt, i) in appointmentsForDay(cell.dateStr).slice(0, 3)"
            :key="i"
            class="w-1.5 h-1.5 rounded-full"
            :class="statusDotMap[appt.status]"
          />
          <span v-if="appointmentsForDay(cell.dateStr).length > 3" class="text-[10px] text-muted">+{{ appointmentsForDay(cell.dateStr).length - 3 }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
```

```typescript
const statusDotMap: Record<string, string> = {
  scheduled: 'bg-info-500',
  confirmed: 'bg-success-500',
  completed: 'bg-neutral-400',
  cancelled: 'bg-error-500',
}

function selectDayFromCalendar(dateStr: string) {
  selectedDate.value = new Date(dateStr + 'T00:00:00')
  currentView.value = 'day'
}
```

---

### 7. Melhorias no Formulário

**a) Filtrar veículos por cliente**

```typescript
// Limpar vehicle_id quando o cliente muda
watch(() => form.client_id, () => {
  form.vehicle_id = ''
  form.service_order_id = ''
})

const vehicleOptions = computed(() =>
  (vehiclesData.value?.items ?? [])
    .filter((v: any) => !form.client_id || v.client_id === form.client_id)
    .map((v: any) => ({
      label: [v.brand, v.model, v.license_plate].filter(Boolean).join(' - '),
      value: v.id
    }))
)
```

**b) Campo de vínculo com OS**

Adicionar `service_order_id` ao `emptyForm()` e buscar ordens abertas do cliente selecionado:

```typescript
const emptyForm = () => ({
  // ...campos existentes...
  service_order_id: '' as string,
})

// Buscar OS abertas quando cliente muda
const openServiceOrders = ref<{ id: string, number: number, reported_defect: string }[]>([])

watch(() => form.client_id, async (clientId) => {
  form.vehicle_id = ''
  form.service_order_id = ''
  openServiceOrders.value = []
  if (clientId) {
    try {
      const res = await $fetch<{ items: any[] }>('/api/service-orders', {
        query: { client_id: clientId, status: 'aberta,em_andamento', page_size: 50 }
      })
      openServiceOrders.value = res.items ?? []
    } catch { /* silencioso */ }
  }
})

const serviceOrderOptions = computed(() =>
  openServiceOrders.value.map(os => ({
    label: `OS #${os.number} — ${os.reported_defect ?? ''}`.trim(),
    value: os.id
  }))
)
```

**Template do campo de OS no modal:**

```vue
<UFormField label="Vincular a OS em Aberto" class="sm:col-span-2">
  <USelectMenu
    v-model="form.service_order_id"
    :items="serviceOrderOptions"
    value-key="value"
    :disabled="serviceOrderOptions.length === 0"
    :placeholder="form.client_id ? (serviceOrderOptions.length === 0 ? 'Nenhuma OS aberta para este cliente' : 'Selecionar OS...') : 'Selecione um cliente primeiro'"
    class="w-full"
  />
</UFormField>
```

Incluir `service_order_id` no body do `save()`:

```typescript
const body = {
  // ...campos existentes...
  service_order_id: form.service_order_id || null,
}
```

---

## Estratégia de Fetch por Modo de Visualização

| Modo | Parâmetros da API | Observação |
|---|---|---|
| `week` | `date_from`, `date_to` (7 dias) | Sem paginação; `page_size=500` |
| `day` | `date_from` = `date_to` = dia selecionado | Sem paginação |
| `list` | `search`, `status`, `page`, `page_size` | Paginação normal |
| `month` | `date_from`, `date_to` (mês inteiro) | Sem paginação; `page_size=500` |

O `useAsyncData` deve observar `[currentView, selectedDate, search, statusFilter, page]` e ajustar os parâmetros dinamicamente:

```typescript
const { data, status, refresh } = await useAsyncData(
  () => `appointments-${currentView.value}-${selectedDate.value.toISOString().split('T')[0]}-${page.value}-${search.value}-${statusFilter.value}`,
  () => {
    const query: Record<string, any> = {}
    
    if (currentView.value === 'week') {
      query.date_from = dateFrom.value
      query.date_to = dateTo.value
      query.page_size = 500
    } else if (currentView.value === 'day') {
      query.date_from = selectedDayStr.value
      query.date_to = selectedDayStr.value
      query.page_size = 500
    } else if (currentView.value === 'month') {
      query.date_from = monthStart.value
      query.date_to = monthEnd.value
      query.page_size = 500
    } else {
      // list
      query.search = search.value || undefined
      query.status = statusFilter.value || undefined
      query.page = page.value
      query.page_size = pageSize
    }

    return requestFetch<{ items: Appointment[], total: number, page: number, page_size: number }>(
      '/api/appointments', { headers: requestHeaders, query }
    )
  },
  { watch: [currentView, selectedDate, page, search, statusFilter] }
)
```

---

## Componente Auxiliar: `AppointmentStatusDropdown`

Para evitar repetição nos 4 modos de visualização, extrair o dropdown de status em um componente:

**`app/components/AppointmentStatusDropdown.vue`:**

```vue
<script setup lang="ts">
const props = defineProps<{
  appt: Record<string, any>
  canUpdate: boolean
}>()

const emit = defineEmits<{
  change: [appt: Record<string, any>, newStatus: string]
}>()

const statusColorMap: Record<string, string> = {
  scheduled: 'info', confirmed: 'success', completed: 'neutral', cancelled: 'error'
}
const statusLabelMap: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado'
}

const items = [[
  { label: 'Agendado',  click: () => emit('change', props.appt, 'scheduled') },
  { label: 'Confirmado', click: () => emit('change', props.appt, 'confirmed') },
  { label: 'Concluído', click: () => emit('change', props.appt, 'completed') },
  { label: 'Cancelado', click: () => emit('change', props.appt, 'cancelled') },
]]
</script>

<template>
  <UDropdownMenu v-if="canUpdate" :items="items">
    <UBadge
      :color="statusColorMap[appt.status] ?? 'neutral'"
      variant="subtle"
      :label="statusLabelMap[appt.status] ?? appt.status"
      class="cursor-pointer"
    />
  </UDropdownMenu>
  <UBadge
    v-else
    :color="statusColorMap[appt.status] ?? 'neutral'"
    variant="subtle"
    :label="statusLabelMap[appt.status] ?? appt.status"
  />
</template>
```

---

## Formatação de Datas (helpers)

```typescript
function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function formatDayLabelFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
```

---

## Checklist de Implementação

### Fase 1 — Correção de bugs imediatos
- [ ] Filtrar `vehicleOptions` por `form.client_id` no formulário
- [ ] Limpar `vehicle_id` ao trocar de cliente (watcher)

### Fase 2 — Troca de status inline
- [ ] Criar componente `AppointmentStatusDropdown.vue`
- [ ] Implementar função `changeStatus()` na página
- [ ] Substituir badges estáticos por `AppointmentStatusDropdown` na tabela atual

### Fase 3 — Modo Lista (agrupada por data)
- [ ] Implementar `groupedByDate` computed
- [ ] Renderizar template do modo lista com headers sticky por data
- [ ] Adicionar toggle de view no header (inicialmente só Lista / Semana)

### Fase 4 — Modo Semana
- [ ] Computeds de `weekStart`, `weekEnd`, `weekDays`, `dateFrom`, `dateTo`
- [ ] Ajustar `useAsyncData` para aceitar parâmetros dinâmicos por modo
- [ ] Renderizar template do modo semana com navegação prev/next

### Fase 5 — Modo Dia
- [ ] Computeds de `selectedDayStr`, helpers `prevDay`, `nextDay`, `goToday`
- [ ] Renderizar template do modo dia

### Fase 6 — Vínculo com OS no formulário
- [ ] Adicionar `service_order_id` ao `emptyForm()`
- [ ] Buscar OS abertas ao selecionar cliente (`watch` + `$fetch`)
- [ ] Adicionar campo OS no modal do formulário
- [ ] Incluir `service_order_id` no body do `save()`
- [ ] Mostrar link "Ver OS vinculada" nos modos Dia e Semana

### Fase 7 — Modo Mês (lower priority)
- [ ] Computeds de `monthCells`, `monthStart`, `monthEnd`
- [ ] Renderizar grid do calendário mensal
- [ ] Clicar em dia redireciona para modo Dia

---

## Não Precisa Mudar

- Schema do banco de dados (`appointments` já tem todos os campos)
- API endpoints (`GET`, `POST`, `PUT`, `DELETE` — já estão corretos)
- Status/prioridade values (`scheduled`, `confirmed`, `completed`, `cancelled` / `low`, `medium`, `high`)
- Header pattern (`AppPageHeader` já está correto nesta página)
- Permissões (`APPOINTMENTS_*` action codes já estão corretos)
