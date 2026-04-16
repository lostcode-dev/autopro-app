<script setup lang="ts">
type TableColumn = Record<string, unknown>

const props = withDefaults(defineProps<{
  columns: TableColumn[]
  data: Record<string, unknown>[]
  loading?: boolean
  loadingRows?: number
  page?: number
  pageSize?: number
  total?: number
  emptyTitle?: string
  emptyDescription?: string
  tableClass?: string
}>(), {
  loading: false,
  loadingRows: 8,
  page: 1,
  pageSize: 20,
  total: 0,
  emptyTitle: 'Nenhum item encontrado',
  emptyDescription: 'Ajuste os filtros ou cadastre um novo item.',
  tableClass: 'min-h-0 flex-1'
})

const emit = defineEmits<{
  'update:page': [value: number]
}>()

const currentPage = computed({
  get: () => props.page,
  set: value => emit('update:page', value)
})

const hasItems = computed(() => props.data.length > 0)
const showPagination = computed(() => props.total > props.pageSize)
const pageStart = computed(() => {
  if (!props.total || !hasItems.value)
    return 0

  return (props.page - 1) * props.pageSize + 1
})
const pageEnd = computed(() => {
  if (!props.total || !hasItems.value)
    return 0

  return Math.min(props.page * props.pageSize, props.total)
})
const tableUi = {
  root: 'relative min-h-0 flex-1 overflow-auto',
  base: 'min-w-full border-separate border-spacing-0',
  thead: 'sticky top-0 inset-x-0 z-10 bg-default/95 backdrop-blur',
  tbody: 'divide-y divide-default/70',
  tr: 'transition-colors duration-150 hover:bg-elevated/40',
  th: 'border-b border-default/80 bg-default/95 px-4 py-3 text-xs font-semibold tracking-[0.02em] text-highlighted',
  td: 'border-b border-default/60 px-4 py-3.5 text-sm text-muted align-middle',
  empty: 'py-16'
} as const
const paginationUi = {
  list: 'flex items-center gap-1.5',
  item: '',
  prev: '',
  next: '',
  first: '',
  last: ''
} as const
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-default/80 bg-default shadow-sm ring-1 ring-inset ring-default/50">
    <div class="pointer-events-none h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

    <div v-if="loading" class="space-y-3 p-4 md:p-5">
      <slot name="loading">
        <USkeleton
          v-for="index in loadingRows"
          :key="index"
          class="h-12 w-full rounded-xl"
        />
      </slot>
    </div>

    <template v-else-if="hasItems">
      <div class="min-h-0 flex-1 overflow-hidden">
        <UTable
          :columns="columns"
          :data="data"
          :class="tableClass"
          sticky="header"
          :ui="tableUi"
        >
          <template
            v-for="(_, slotName) in $slots"
            :key="slotName"
            #[slotName]="slotProps"
          >
            <slot :name="slotName" v-bind="slotProps ?? {}" />
          </template>
        </UTable>
      </div>
    </template>

    <div
      v-else
      class="flex flex-1 items-center justify-center bg-gradient-to-b from-default to-elevated/20 p-10 text-center"
    >
      <div class="max-w-sm space-y-2">
        <p class="text-sm font-semibold text-highlighted">
          {{ emptyTitle }}
        </p>
        <p class="text-sm text-muted">
          {{ emptyDescription }}
        </p>
      </div>
    </div>

    <div
      v-if="hasItems"
      class="flex flex-col gap-3 border-t border-default/80 bg-elevated/20 px-4 py-3 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
        <span class="font-medium text-toned">
          {{ pageStart }}-{{ pageEnd }}
        </span>
        <span>de {{ total }} registro(s)</span>
        <span class="hidden h-1 w-1 rounded-full bg-default md:block" />
        <span class="text-xs uppercase tracking-[0.08em] text-muted">
          {{ pageSize }} por página
        </span>
      </div>

      <UPagination
        v-if="showPagination"
        v-model="currentPage"
        :items-per-page="pageSize"
        :total="total"
        :show-edges="false"
        :sibling-count="1"
        color="neutral"
        variant="ghost"
        active-color="neutral"
        active-variant="outline"
        size="sm"
        :ui="paginationUi"
      />
    </div>
  </div>
</template>
