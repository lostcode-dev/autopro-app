# Plano: Revisão da Página /app/appointments — Visão Calendário

## Objetivo

Substituir a tabela (`UTable`) + paginação atual por uma **interface estilo Google Calendar**, mantendo o modal de criação/edição existente e adicionando navegação por período, múltiplos modos de visualização e interação direta no grid.

---

## Estado Atual

| Aspecto | Hoje |
|---------|------|
| Visualização | Tabela paginada plana |
| Navegação temporal | Nenhuma — exibe últimos N agendamentos |
| Criação | Botão "Novo agendamento" no header |
| Filtros | Busca por texto + filtro de status |
| Fetch | Paginado, sem recorte de datas |

---

## Estado Alvo

| Aspecto | Depois |
|---------|--------|
| Visualização | Calendário com 3 modos: **Mês**, **Semana**, **Dia** |
| Navegação temporal | Botões `‹ Anterior` / `Hoje` / `Próximo ›` |
| Criação | Clique em qualquer célula/horário pré-preenche data e hora |
| Filtros | Status + busca na sidebar (modo agenda, opcional) |
| Fetch | Busca por intervalo (`date_from` / `date_to`) — API já suporta |

---

## Modos de Visualização

### 1. Visão Mês (`month`)

```
          Abril 2026
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Seg │ Ter │ Qua │ Qui │ Sex │ Sáb │ Dom │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│     │     │  1  │  2  │  3  │  4  │  5  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  6  │  7  │  8  │  9  │ 10  │ 11  │ 12  │
│     │[●]  │[●●] │     │[●]  │     │     │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ 13  │ 14  │ 15  │ 16  │ 17  │ 18  │ 19  │
│     │[●]  │     │[●]  │[●●] │     │     │
...
```

- Cada célula exibe pills com `service_type` (truncado)
- Máximo 3 pills visíveis; excedente mostra `+N mais`
- Cor da pill = status do agendamento
- Click em célula vazia → abre modal pré-preenchido com aquela data
- Click em pill → abre modal de edição

### 2. Visão Semana (`week`)

```
           Seg 13  Ter 14  Qua 15  Qui 16  Sex 17  Sáb 18  Dom 19
           ──────  ──────  ──────  ──────  ──────  ──────  ──────
00:00  │         │        │        │        │        │        │
00:30  │         │        │        │        │        │        │
...
07:00  │         │        │[Troca ]│        │        │        │
07:30  │         │        │[de    ]│        │        │        │
08:00  │         │[Revis.]│[óleo  ]│        │[Alin.]│        │
08:30  │         │        │        │        │        │        │
09:00  │[Freios ]│        │        │[Revisão│        │        │
09:30  │[João   ]│        │        │ Anual ]│        │        │
...
22:00  │         │        │        │        │        │        │
23:30  │         │        │        │        │        │        │
```

- Colunas = dias da semana (Seg–Dom)
- Linhas = slots de 30 minutos, das 00:00 às 23:30 (48 slots — grid completo de 24h)
- Grid é **scrollável verticalmente**; ao abrir, faz scroll automático para o horário atual (ou 07:00 como fallback)
- Eventos posicionados com `top` e `height` proporcionais à duração estimada (padrão: 1h = 2 slots)
- Click em slot vazio → abre modal com data + hora pré-preenchidos
- Click em evento → abre modal de edição
- Linha horizontal indicando horário atual (hoje)

### 3. Visão Dia (`day`)

- Idêntico à semana, mas apenas 1 coluna (o dia selecionado)
- Mais espaço horizontal → exibe mais detalhes no evento (cliente, veículo)
- Útil para dias com muitos agendamentos

---

## Arquitetura de Componentes

```
app/pages/app/appointments.vue          ← Página principal (orquestra tudo)
app/components/appointments/
  CalendarHeader.vue                    ← Barra de navegação temporal + seletor de view
  CalendarMonthView.vue                 ← Grid mensal
  CalendarWeekView.vue                  ← Grid semanal com time slots
  CalendarDayView.vue                   ← Grid diário com time slots
  CalendarEventPill.vue                 ← Pill/card de evento (reutilizado em todas as views)
  FormModal.vue                         ← Modal de criação/edição (extraído do inline atual)
```

> **Princípio**: a página (`appointments.vue`) gerencia estado (data atual, modo, dados) e passa props para os componentes. Os componentes emitem eventos (`@create`, `@edit`, `@date-change`) sem acessar o estado global.

---

## Estado Global da Página

```typescript
// Modo de visualização
type CalendarView = 'month' | 'week' | 'day'
const calendarView = ref<CalendarView>('week')

// Data de referência (âncora da navegação)
const currentDate = ref(new Date())  // hoje

// Range derivado do modo + currentDate
const visibleRange = computed(() => {
  switch (calendarView.value) {
    case 'month': return getMonthRange(currentDate.value)   // 1º ao último dia do mês
    case 'week':  return getWeekRange(currentDate.value)    // Seg a Dom da semana corrente
    case 'day':   return getDayRange(currentDate.value)     // apenas o dia
  }
})

// Query para a API — reativo ao range
const { data, status, refresh } = await useAsyncData(
  () => `appointments-cal-${calendarView.value}-${visibleRange.value.from}-${visibleRange.value.to}`,
  () => requestFetch<{ items: Appointment[], total: number }>('/api/appointments', {
    headers: requestHeaders,
    query: {
      date_from: visibleRange.value.from,   // YYYY-MM-DD
      date_to:   visibleRange.value.to,     // YYYY-MM-DD
      page_size: 200                         // sem paginação no calendário
    }
  }),
  { watch: [visibleRange] }
)
```

---

## Helpers de Datas (sem biblioteca externa)

```typescript
// Retorna { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
function getMonthRange(d: Date) {
  const y = d.getFullYear(), m = d.getMonth()
  return {
    from: toISO(new Date(y, m, 1)),
    to:   toISO(new Date(y, m + 1, 0))
  }
}

function getWeekRange(d: Date) {
  const day = d.getDay()                        // 0=Dom
  const diff = (day === 0 ? -6 : 1 - day)      // ajuste para Seg como início
  const mon = new Date(d); mon.setDate(d.getDate() + diff)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: toISO(mon), to: toISO(sun) }
}

function getDayRange(d: Date) {
  const iso = toISO(d)
  return { from: iso, to: iso }
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Monta a grade de dias para o modo mês (sempre 6 semanas = 42 células)
function buildMonthGrid(d: Date): Date[] {
  const y = d.getFullYear(), m = d.getMonth()
  const first = new Date(y, m, 1)
  const startOffset = (first.getDay() === 0 ? 6 : first.getDay() - 1)  // Seg=0
  const start = new Date(first); start.setDate(1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start); day.setDate(start.getDate() + i)
    return day
  })
}

// Monta os slots de tempo para semana/dia — 24h completas
const HOUR_START = 0    // 00:00
const HOUR_END   = 24   // 23:30 (último slot)
const SLOT_MINUTES = 30
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * (60 / SLOT_MINUTES)  // 48 slots

// Altura fixa por slot em pixels — 48px por slot = 2304px de altura total (scrollável)
const SLOT_HEIGHT_PX = 48

function buildTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = HOUR_START; h < HOUR_END; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots  // ['00:00', '00:30', ..., '23:00', '23:30'] — 48 itens
}

// Calcula posição e altura em px (não %, evita erros de sub-pixel em grid alto)
function getEventStyle(time: string, durationMinutes = 60): { top: string; height: string } {
  const [hh, mm] = time.split(':').map(Number)
  const startMinutes = hh * 60 + mm
  const topPx = (startMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX
  const heightPx = (durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX
  return {
    top:    `${topPx}px`,
    height: `${Math.max(heightPx, SLOT_HEIGHT_PX)}px`  // mínimo 1 slot de altura
  }
}

// Altura total do grid (usada no :style do container)
const GRID_HEIGHT_PX = TOTAL_SLOTS * SLOT_HEIGHT_PX  // 2304px

// Scroll automático para o horário atual ao montar a view semana/dia
function scrollToCurrentTime(containerEl: HTMLElement) {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const scrollTop = (minutes / SLOT_MINUTES) * SLOT_HEIGHT_PX - 200  // 200px acima
  containerEl.scrollTop = Math.max(0, scrollTop)
}

// Linha do horário atual — posição em px
const currentTimePx = computed(() => {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  return (minutes / SLOT_MINUTES) * SLOT_HEIGHT_PX
})
```

---

## Componente `CalendarHeader.vue`

```html
<template>
  <div class="flex items-center justify-between border-b border-default px-4 py-3">
    <!-- Navegação temporal -->
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" @click="$emit('prev')" />
      <UButton label="Hoje" color="neutral" variant="outline" size="sm" @click="$emit('today')" />
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="sm" @click="$emit('next')" />
      <h2 class="ml-2 text-base font-semibold text-highlighted">{{ title }}</h2>
    </div>

    <!-- Seletor de visualização -->
    <div class="flex items-center gap-2">
      <!-- Filtro de status (opcional, colapsável) -->
      <USelectMenu v-model="statusFilter" :items="statusOptions" value-key="value" class="w-40" />
      <!-- Toggle de view -->
      <UButtonGroup>
        <UButton label="Mês"    :color="view === 'month' ? 'primary' : 'neutral'" :variant="view === 'month' ? 'solid' : 'outline'" @click="$emit('update:view', 'month')" />
        <UButton label="Semana" :color="view === 'week'  ? 'primary' : 'neutral'" :variant="view === 'week'  ? 'solid' : 'outline'" @click="$emit('update:view', 'week')" />
        <UButton label="Dia"    :color="view === 'day'   ? 'primary' : 'neutral'" :variant="view === 'day'   ? 'solid' : 'outline'" @click="$emit('update:view', 'day')" />
      </UButtonGroup>
    </div>
  </div>
</template>
```

**Props / Emits:**
```typescript
defineProps<{ view: CalendarView; title: string; statusFilter: string }>()
defineEmits<{ prev: []; next: []; today: []; 'update:view': [v: CalendarView] }>()
```

---

## Componente `CalendarMonthView.vue`

### Template

```html
<template>
  <div class="flex-1 overflow-auto">
    <!-- Header dos dias da semana -->
    <div class="grid grid-cols-7 border-b border-default">
      <div v-for="day in ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']" :key="day"
           class="py-2 text-center text-xs font-medium text-muted uppercase">
        {{ day }}
      </div>
    </div>

    <!-- Grid das células -->
    <div class="grid grid-cols-7 flex-1" style="grid-template-rows: repeat(6, 1fr)">
      <div
        v-for="cell in monthGrid"
        :key="toISO(cell)"
        class="min-h-24 border-b border-r border-default/60 p-1 cursor-pointer hover:bg-elevated transition-colors"
        :class="{
          'bg-muted/30': !isSameMonth(cell, currentDate),
          'ring-2 ring-inset ring-primary': isToday(cell)
        }"
        @click="$emit('cell-click', cell)"
      >
        <!-- Número do dia -->
        <div class="mb-1 flex justify-end">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
            :class="isToday(cell) ? 'bg-primary text-white' : 'text-muted'"
          >
            {{ cell.getDate() }}
          </span>
        </div>

        <!-- Pills de eventos -->
        <div class="space-y-0.5">
          <CalendarEventPill
            v-for="appt in getEventsForDay(cell).slice(0, 3)"
            :key="appt.id"
            :appointment="appt"
            view="month"
            @click.stop="$emit('event-click', appt)"
          />
          <div
            v-if="getEventsForDay(cell).length > 3"
            class="px-1 text-xs text-muted cursor-pointer hover:text-highlighted"
            @click.stop="$emit('overflow-click', cell)"
          >
            +{{ getEventsForDay(cell).length - 3 }} mais
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

**Props:**
```typescript
defineProps<{
  currentDate: Date
  monthGrid: Date[]
  appointments: Appointment[]
}>()
defineEmits<{
  'cell-click': [date: Date]
  'event-click': [appt: Appointment]
  'overflow-click': [date: Date]
}>()

function getEventsForDay(day: Date): Appointment[] {
  const iso = toISO(day)
  return props.appointments.filter(a => a.appointment_date === iso)
    .sort((a, b) => a.time.localeCompare(b.time))
}
```

---

## Componente `CalendarWeekView.vue`

### Estrutura do Grid

```
┌──────────┬──────────────────────────────────────────────────┐
│  00:00   │  Seg 13  │  Ter 14  │  Qua 15  │  ...  │  Dom 19 │
│  00:30   │          │          │          │        │          │
│  ...     │          │          │          │        │          │  ← scroll
│  07:00   │          │          │ [Troca ] │        │          │
│  07:30   │          │          │ [de óleo]│        │          │
│  08:00   │          │ [evento] │          │        │          │
│  ...     │          │          │          │        │          │
│  19:30   │          │          │          │        │          │
└──────────┴──────────────────────────────────────────────────┘
```

### Implementação

A estrutura do WeekView usa **altura fixa em px** (não `%`) para posicionar os eventos, com scroll vertical. Isso garante que todos os 48 slots (00:00–23:30) fiquem acessíveis.

```typescript
// Helper: converte slot "HH:MM" em posição topo em px
function getSlotTopPx(slot: string): number {
  const [hh, mm] = slot.split(':').map(Number)
  return ((hh * 60 + mm) / SLOT_MINUTES) * SLOT_HEIGHT_PX
}
```

```html
<template>
  <!--
    Layout:
    ┌────────────────────────────────────────────────┐
    │ [Header dias fixo — não scrolla]               │
    ├──────┬─────────────────────────────────────────┤
    │ 00:00│            ← área scrollável            │
    │ 00:30│                                         │
    │  ... │  (GRID_HEIGHT_PX = 2304px total)        │
    │ 23:30│                                         │
    └──────┴─────────────────────────────────────────┘
  -->
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <!-- Header dos dias (sticky, não scrolla) -->
    <div class="flex shrink-0 border-b border-default">
      <div class="w-16 shrink-0" />  <!-- espaço da coluna de horas -->
      <div
        v-for="day in weekDays"
        :key="toISO(day)"
        class="flex-1 min-w-24 border-l border-default py-2 text-center cursor-pointer hover:bg-elevated"
        :class="{ 'text-primary font-semibold': isToday(day) }"
        @click="$emit('day-click', day)"
      >
        <span class="block text-xs text-muted">{{ formatDayName(day) }}</span>
        <span
          class="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
          :class="isToday(day) ? 'bg-primary text-white' : ''"
        >{{ day.getDate() }}</span>
      </div>
    </div>

    <!-- Área scrollável (horas + eventos) -->
    <div ref="scrollContainerRef" class="flex flex-1 overflow-y-auto overflow-x-auto">
      <!-- Coluna de horários -->
      <div class="w-16 shrink-0 border-r border-default">
      <!-- Espaço do header -->
      <div class="h-10 border-b border-default" />
      <!-- Slots de horário — 48 linhas, cada uma com SLOT_HEIGHT_PX de altura -->
      <div class="relative" :style="{ height: GRID_HEIGHT_PX + 'px' }">
        <div
          v-for="slot in timeSlots"
          :key="slot"
          class="absolute w-full border-t border-default/40 pr-1"
          :style="{ top: getSlotTopPx(slot) + 'px', height: SLOT_HEIGHT_PX + 'px' }"
        >
          <span class="text-[10px] text-muted leading-none block text-right">{{ slot }}</span>
        </div>
      </div>
    </div>

    <!-- Colunas dos dias (sem header — já está fixo acima) -->
    <div class="flex flex-1">
      <div
        v-for="day in weekDays"
        :key="toISO(day)"
        class="flex-1 min-w-24 border-l border-default"
      >
        <!-- Header do dia -->
        <div
          class="h-10 border-b border-default flex flex-col items-center justify-center cursor-pointer hover:bg-elevated"
          :class="{ 'text-primary font-semibold': isToday(day) }"
          @click="$emit('day-click', day)"
        >
          <span class="text-xs text-muted">{{ formatDayName(day) }}</span>
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold"
            :class="isToday(day) ? 'bg-primary text-white' : ''"
          >
            {{ day.getDate() }}
          </span>
        </div>

        <!-- Área de eventos (posicionamento absoluto, altura fixa = 24h × 48px) -->
        <div
          class="relative"
          :style="{ height: GRID_HEIGHT_PX + 'px' }"
          @click="onGridClick(day, $event)"
        >
          <!-- Linhas de slot (fundo) -->
          <div
            v-for="slot in timeSlots"
            :key="slot"
            class="absolute w-full border-t"
            :class="slot.endsWith(':00') ? 'border-default/60' : 'border-default/20'"
            :style="{ top: getSlotTopPx(slot) + 'px', height: SLOT_HEIGHT_PX + 'px' }"
          />

          <!-- Linha do horário atual (sempre visível pois o grid é 24h) -->
          <div
            v-if="isToday(day)"
            class="absolute w-full border-t-2 border-primary z-10"
            :style="{ top: currentTimePx + 'px' }"
          >
            <div class="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-primary" />
          </div>

          <!-- Eventos posicionados -->
          <CalendarEventPill
            v-for="appt in getEventsForDay(day)"
            :key="appt.id"
            :appointment="appt"
            :style="getEventStyle(appt.time)"
            class="absolute inset-x-0.5 z-20"
            view="week"
            @click.stop="$emit('event-click', appt)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
```

**Script do WeekView (props, emits, scroll automático, click no grid):**
```typescript
const props = defineProps<{
  currentDate: Date
  weekDays: Date[]
  appointments: Appointment[]
}>()
const emit = defineEmits<{
  'cell-click': [payload: { date: Date; time: string }]
  'event-click': [appt: Appointment]
  'day-click': [date: Date]
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)

// Ao montar (ou ao mudar de view), rola para o horário atual
onMounted(() => {
  if (scrollContainerRef.value)
    scrollToCurrentTime(scrollContainerRef.value)
})

watch(() => props.currentDate, () => {
  if (scrollContainerRef.value)
    scrollToCurrentTime(scrollContainerRef.value)
})

// Click em slot vazio → calcula hora a partir da posição Y no container scrollável
function onGridClick(day: Date, event: MouseEvent) {
  const container = event.currentTarget as HTMLElement
  // offsetY já considera o scroll interno do container
  const relY = event.offsetY
  const totalMinutes = (relY / SLOT_HEIGHT_PX) * SLOT_MINUTES
  const roundedMinutes = Math.round(totalMinutes / 30) * 30
  const clamped = Math.min(Math.max(roundedMinutes, 0), 23 * 60 + 30)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  emit('cell-click', {
    date: day,
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })
}

function getEventsForDay(day: Date): Appointment[] {
  const iso = toISO(day)
  return props.appointments
    .filter(a => a.appointment_date === iso)
    .sort((a, b) => a.time.localeCompare(b.time))
}
```

---

## Componente `CalendarEventPill.vue`

Reutilizado em todas as views. Muda apenas o layout baseado na prop `view`.

```html
<template>
  <!-- Modo Mês: pill horizontal compacta -->
  <div
    v-if="view === 'month'"
    class="flex items-center gap-1 rounded px-1 py-0.5 text-xs truncate cursor-pointer hover:opacity-80 transition-opacity"
    :class="bgColor"
  >
    <span class="shrink-0 font-mono text-[10px]">{{ appointment.time }}</span>
    <span class="truncate">{{ appointment.service_type }}</span>
  </div>

  <!-- Modo Semana/Dia: card vertical com mais info -->
  <div
    v-else
    class="flex flex-col justify-start rounded px-1.5 py-1 text-xs cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
    :class="bgColor"
  >
    <span class="font-semibold truncate">{{ appointment.service_type }}</span>
    <span class="truncate opacity-80">{{ appointment.clients?.name ?? '—' }}</span>
    <span class="truncate opacity-60">{{ appointment.time }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  appointment: Appointment
  view: 'month' | 'week' | 'day'
}>()

const bgColor = computed(() => {
  const map: Record<string, string> = {
    scheduled: 'bg-info/20 text-info border border-info/30',
    confirmed:  'bg-success/20 text-success border border-success/30',
    completed:  'bg-neutral/20 text-highlighted border border-default',
    cancelled:  'bg-error/20 text-error border border-error/30 line-through',
  }
  return map[props.appointment.status] ?? map.scheduled
})
</script>
```

---

## Integração na Página `appointments.vue`

### Script

```typescript
// Navegação
const calendarView = ref<CalendarView>('week')
const currentDate = ref(new Date())

function navigate(direction: 'prev' | 'next' | 'today') {
  if (direction === 'today') { currentDate.value = new Date(); return }
  const d = new Date(currentDate.value)
  const delta = direction === 'next' ? 1 : -1
  if (calendarView.value === 'month') d.setMonth(d.getMonth() + delta)
  else if (calendarView.value === 'week') d.setDate(d.getDate() + delta * 7)
  else d.setDate(d.getDate() + delta)
  currentDate.value = d
}

// Título dinâmico do header
const calendarTitle = computed(() => {
  const opts: Intl.DateTimeFormatOptions =
    calendarView.value === 'month'
      ? { month: 'long', year: 'numeric' }
      : calendarView.value === 'week'
        ? { month: 'long', year: 'numeric' }  // "Semana de 14–20 Abr 2026"
        : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  return new Intl.DateTimeFormat('pt-BR', opts).format(currentDate.value)
})

// Abrir modal com data/hora pré-preenchida
function handleCellClick(payload: { date: Date; time?: string }) {
  Object.assign(form, emptyForm())
  form.appointment_date = toISO(payload.date)
  if (payload.time) form.time = payload.time
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

// Overflow no mês: ir para view de dia
function handleOverflowClick(date: Date) {
  currentDate.value = date
  calendarView.value = 'day'
}
```

### Template

```html
<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Agendamentos">
        <template #right>
          <UButton v-if="canCreate" label="Novo agendamento" icon="i-lucide-plus" color="neutral" @click="openCreate" />
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">Você não tem permissão para visualizar agendamentos.</p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Barra do calendário -->
        <AppointmentsCalendarHeader
          v-model:view="calendarView"
          v-model:status-filter="statusFilter"
          :title="calendarTitle"
          :status-options="statusOptions"
          @prev="navigate('prev')"
          @next="navigate('next')"
          @today="navigate('today')"
        />

        <!-- Área de conteúdo -->
        <div v-if="status === 'pending'" class="flex flex-1 items-center justify-center">
          <div class="space-y-3 w-full p-4">
            <USkeleton v-for="i in 6" :key="i" class="h-16 w-full" />
          </div>
        </div>

        <AppointmentsCalendarMonthView
          v-else-if="calendarView === 'month'"
          :current-date="currentDate"
          :month-grid="monthGrid"
          :appointments="filteredAppointments"
          @cell-click="handleCellClick"
          @event-click="openEdit"
          @overflow-click="handleOverflowClick"
        />

        <AppointmentsCalendarWeekView
          v-else-if="calendarView === 'week'"
          :current-date="currentDate"
          :week-days="weekDays"
          :appointments="filteredAppointments"
          @cell-click="handleCellClick"
          @event-click="openEdit"
          @day-click="(d) => { currentDate = d; calendarView = 'day' }"
        />

        <AppointmentsCalendarDayView
          v-else
          :current-date="currentDate"
          :appointments="filteredAppointments"
          @cell-click="handleCellClick"
          @event-click="openEdit"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal (mantido idêntico ao atual) -->
  <AppointmentsFormModal
    v-model:open="showModal"
    :is-editing="isEditing"
    :form="form"
    ...
  />
</template>
```

---

## Ajustes Necessários na API

### `GET /api/appointments/index.get.ts`

A API **já suporta** `date_from` e `date_to`. Apenas ajustar a ordenação:

```typescript
// Antes
dbQuery.order('appointment_date', { ascending: false }).order('time', { ascending: false })

// Depois (calendário usa ordem cronológica)
dbQuery.order('appointment_date', { ascending: true }).order('time', { ascending: true })
```

E remover o `page`/`page_size` padrão de 50 — o calendário precisa buscar **todos** do período:

```typescript
// Permitir page_size até 500 para o calendário
const pageSize = Math.min(Math.max(1, Number(query.page_size) || 50), 500)
```

---

## Cores por Status (referência)

| Status | Tailwind | UBadge color |
|--------|----------|--------------|
| `scheduled` | `bg-info/20 text-info` | `info` |
| `confirmed` | `bg-success/20 text-success` | `success` |
| `completed` | `bg-neutral/20 text-highlighted` | `neutral` |
| `cancelled` | `bg-error/20 text-error line-through` | `error` |

---

## Checklist de Implementação

### Fase 1 — Infraestrutura
- [ ] Criar `app/components/appointments/CalendarHeader.vue`
- [ ] Criar `app/components/appointments/CalendarEventPill.vue`
- [ ] Extrair form para `app/components/appointments/FormModal.vue`
- [ ] Criar helpers de datas em `app/utils/calendar.ts`
- [ ] Ajustar `GET /api/appointments` (ordenação ASC + page_size até 500)

### Fase 2 — View Semana (prioridade)
- [ ] Criar `app/components/appointments/CalendarWeekView.vue`
- [ ] Grid 24h com altura fixa em px (`SLOT_HEIGHT_PX = 48`, `GRID_HEIGHT_PX = 2304`)
- [ ] Scroll vertical automático para o horário atual ao montar (`scrollToCurrentTime`)
- [ ] Posicionamento de eventos com `top` e `height` em px (não %)
- [ ] Click em slot → calcula hora via `offsetY` e pré-preenche data + hora no modal
- [ ] Linha do horário atual sempre visível (grid é 24h completo)
- [ ] Header dos dias fixo (sticky), área de slots scrollável separada
- [ ] Responsividade (scroll horizontal em telas pequenas, `min-w-24` por coluna)

### Fase 3 — View Mês
- [ ] Criar `app/components/appointments/CalendarMonthView.vue`
- [ ] Grid 7×6 com `buildMonthGrid()`
- [ ] Pills truncadas + "+N mais"
- [ ] Click em overflow → navega para view Dia

### Fase 4 — View Dia
- [ ] Criar `app/components/appointments/CalendarDayView.vue`
- [ ] Reutiliza lógica do WeekView com 1 coluna
- [ ] Mais detalhe no card do evento

### Fase 5 — Integração e Polimento
- [ ] Integrar tudo em `appointments.vue`
- [ ] URL sync: `?view=week&date=2026-04-14`
- [ ] Transição suave entre views (fade)
- [ ] Testar mobile (view Mês colapsa para agenda vertical)
- [ ] Atalhos de teclado: `←` `→` para navegar, `t` para Hoje, `m/w/d` para mudar view

---

## Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `app/pages/app/appointments.vue` | Refatorar — substituir tabela por calendário |
| `app/components/appointments/CalendarHeader.vue` | Criar |
| `app/components/appointments/CalendarMonthView.vue` | Criar |
| `app/components/appointments/CalendarWeekView.vue` | Criar |
| `app/components/appointments/CalendarDayView.vue` | Criar |
| `app/components/appointments/CalendarEventPill.vue` | Criar |
| `app/components/appointments/FormModal.vue` | Criar (extraído do inline) |
| `app/utils/calendar.ts` | Criar — helpers de datas |
| `server/api/appointments/index.get.ts` | Modificar — ordem ASC + page_size 500 |
