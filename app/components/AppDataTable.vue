<script setup lang="ts">
import { computed, h, ref, resolveComponent, useSlots } from 'vue'
import type { Cell, ColumnDef, Header, HeaderContext, Row, RowSelectionState, SortingState } from '@tanstack/vue-table'

type TableRowData = Record<string, unknown>
type DataTableColumn = ColumnDef<TableRowData, unknown>

const props = withDefaults(defineProps<{
  columns: DataTableColumn[]
  data: TableRowData[]
  loading?: boolean
  loadingRows?: number
  loadingVariant?: 'row' | 'card'
  page?: number
  pageSize?: number
  total?: number
  emptyIcon?: string
  emptyTitle?: string
  emptyDescription?: string
  tableClass?: string
  selectable?: boolean
  stickyHeader?: boolean
  showFooter?: boolean
  actionsColumnKey?: string
  sorting?: SortingState
  rowSelection?: RowSelectionState
  getRowId?: (originalRow: TableRowData, index: number, parent?: Row<TableRowData>) => string
  rowSkeletonClass?: string
  cardSkeletonCount?: number
  cardSkeletonClass?: string
  cardSkeletonGridClass?: string
}>(), {
  loading: false,
  loadingRows: 8,
  loadingVariant: 'row',
  page: 1,
  pageSize: 20,
  total: 0,
  emptyIcon: 'i-lucide-inbox',
  emptyTitle: 'Nada por aqui ainda',
  emptyDescription: 'Quando houver registros para exibir, eles aparecerão nesta tabela.',
  tableClass: 'min-h-0 flex-1',
  selectable: false,
  stickyHeader: true,
  showFooter: true,
  actionsColumnKey: 'actions',
  sorting: () => [],
  rowSelection: () => ({}),
  rowSkeletonClass: 'h-12 w-full rounded-xl',
  cardSkeletonCount: 6,
  cardSkeletonClass: 'h-44 w-full rounded-2xl',
  cardSkeletonGridClass: 'grid grid-cols-1 gap-4 p-4 xl:grid-cols-2'
})

const emit = defineEmits<{
  'update:page': [value: number]
  'update:sorting': [value: SortingState]
  'update:rowSelection': [value: RowSelectionState]
}>()

const slots = useSlots()
const UCheckbox = resolveComponent('UCheckbox')
const UIcon = resolveComponent('UIcon')

const internalSorting = ref<SortingState>(props.sorting)
const internalRowSelection = ref<RowSelectionState>(props.rowSelection)

const currentPage = computed({
  get: () => props.page,
  set: value => emit('update:page', value)
})

const currentSorting = computed({
  get: () => props.sorting ?? internalSorting.value,
  set: (value) => {
    internalSorting.value = value
    emit('update:sorting', value)
  }
})

const currentRowSelection = computed({
  get: () => props.rowSelection ?? internalRowSelection.value,
  set: (value) => {
    internalRowSelection.value = value
    emit('update:rowSelection', value)
  }
})

const forwardedSlotNames = computed(() =>
  Object.keys(slots).filter(name => !['empty', 'loading', 'loading-card', 'loading-row'].includes(name))
)

const totalItems = computed(() => props.total > 0 ? props.total : props.data.length)
const hasItems = computed(() => props.data.length > 0)
const showPagination = computed(() => totalItems.value > props.pageSize)
const showCardLoading = computed(() => props.loading && props.loadingVariant === 'card')
const selectedCount = computed(() =>
  Object.values(currentRowSelection.value).filter(Boolean).length
)
const pageStart = computed(() => {
  if (!totalItems.value || !hasItems.value)
    return 0

  return (props.page - 1) * props.pageSize + 1
})
const pageEnd = computed(() => {
  if (!totalItems.value || !hasItems.value)
    return 0

  return Math.min(props.page * props.pageSize, totalItems.value)
})

function joinClasses(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ')
}

function formatColumnLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function getColumnKey(column: DataTableColumn) {
  if (typeof column.id === 'string')
    return column.id

  if (typeof column.accessorKey === 'string')
    return column.accessorKey

  return undefined
}

function isActionsColumn(column: DataTableColumn) {
  return getColumnKey(column) === props.actionsColumnKey
}

function mergeMetaClass<TContext>(
  existing: string | ((context: TContext) => string) | undefined,
  extra: string
) {
  if (typeof existing === 'function')
    return (context: TContext) => joinClasses(existing(context), extra)

  return joinClasses(existing, extra)
}

function resolveHeaderContent(
  header: DataTableColumn['header'],
  context: HeaderContext<TableRowData, unknown>,
  fallbackLabel: string
) {
  if (typeof header === 'function')
    return header(context)

  if (typeof header === 'string')
    return header

  return fallbackLabel
}

function createSortableHeader(
  header: DataTableColumn['header'],
  fallbackLabel: string
) {
  return (context: HeaderContext<TableRowData, unknown>) => {
    const sorted = context.column.getIsSorted()
    const icon = sorted === 'asc'
      ? 'i-lucide-arrow-up-narrow-wide'
      : sorted === 'desc'
        ? 'i-lucide-arrow-down-wide-narrow'
        : 'i-lucide-arrow-up-down'

    return h(
      'button',
      {
        type: 'button',
        class: 'group inline-flex w-full items-center gap-2 text-left font-semibold text-highlighted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md',
        onClick: context.column.getToggleSortingHandler()
      },
      [
        h('span', { class: 'truncate' }, resolveHeaderContent(header, context, fallbackLabel) as never),
        h(UIcon as never, {
          name: icon,
          class: joinClasses(
            'h-4 w-4 shrink-0 transition-colors',
            sorted ? 'text-primary' : 'text-muted group-hover:text-highlighted'
          )
        })
      ]
    )
  }
}

function createSelectionColumn(): DataTableColumn {
  return {
    id: '__select',
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) =>
      h('div', { class: 'flex items-center justify-center' }, [
        h(UCheckbox as never, {
          'modelValue': table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false,
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(value === true),
          'aria-label': 'Selecionar todas as linhas',
          'color': 'neutral',
          'size': 'sm'
        })
      ]),
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-center' }, [
        h(UCheckbox as never, {
          'modelValue': row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(value === true),
          'aria-label': `Selecionar linha ${row.id}`,
          'color': 'neutral',
          'size': 'sm'
        })
      ]),
    meta: {
      class: {
        th: 'w-12 min-w-12 text-center',
        td: 'w-12 min-w-12 text-center'
      }
    }
  }
}

function normalizeColumn(column: DataTableColumn): DataTableColumn {
  const fallbackLabel = formatColumnLabel(getColumnKey(column) ?? 'Coluna')
  const sortable = typeof column.enableSorting === 'boolean'
    ? column.enableSorting
    : Boolean(typeof column.accessorKey === 'string' && !isActionsColumn(column))
  const actionsColumn = isActionsColumn(column)
  const meta = (column.meta ?? {}) as {
    class?: {
      th?: string | ((context: Header<TableRowData, unknown>) => string)
      td?: string | ((context: Cell<TableRowData, unknown>) => string)
    }
  }

  return {
    ...column,
    enableSorting: sortable,
    header: sortable ? createSortableHeader(column.header, fallbackLabel) : (column.header ?? fallbackLabel),
    meta: {
      ...meta,
      class: {
        ...meta.class,
        th: mergeMetaClass(
          meta.class?.th,
          joinClasses(actionsColumn && 'text-right', sortable && 'cursor-pointer')
        ),
        td: mergeMetaClass(
          meta.class?.td,
          joinClasses(actionsColumn && 'text-right whitespace-nowrap')
        )
      }
    }
  }
}

const normalizedColumns = computed<DataTableColumn[]>(() => {
  const normalized = props.columns.map(normalizeColumn)
  const actionColumns = normalized.filter(isActionsColumn)
  const regularColumns = normalized.filter(column => !isActionsColumn(column))

  return [
    ...(props.selectable ? [createSelectionColumn()] : []),
    ...regularColumns,
    ...actionColumns
  ]
})

const tableUi = {
  root: 'relative min-h-0 flex-1 overflow-auto',
  base: 'min-w-full border-separate border-spacing-0',
  thead: 'sticky top-0 inset-x-0 z-10 bg-default/95 backdrop-blur supports-[backdrop-filter]:bg-default/85',
  tbody: 'divide-y divide-default/70',
  tr: 'transition-colors duration-150 hover:bg-elevated/40',
  th: 'border-b border-default/80 bg-default/95 px-4 py-3 text-xs font-semibold tracking-[0.02em] text-highlighted align-middle',
  td: 'border-b border-default/60 px-4 py-3.5 text-sm text-muted align-middle',
  empty: 'py-0',
  loading: 'py-0'
} as const

const paginationUi = {
  root: 'w-full md:w-auto',
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

    <div
      v-if="showCardLoading"
      class="min-h-0 flex-1 overflow-auto"
    >
      <slot name="loading-card">
        <div :class="cardSkeletonGridClass">
          <USkeleton
            v-for="index in cardSkeletonCount"
            :key="index"
            :class="cardSkeletonClass"
          />
        </div>
      </slot>
    </div>

    <div
      v-else
      class="min-h-0 flex-1 overflow-hidden"
    >
      <UTable
        v-model:sorting="currentSorting"
        v-model:row-selection="currentRowSelection"
        :columns="normalizedColumns"
        :data="data"
        :class="tableClass"
        :loading="loading"
        :sticky="stickyHeader ? 'header' : false"
        :get-row-id="getRowId"
        :row-selection-options="selectable ? { enableRowSelection: true } : undefined"
        :ui="tableUi"
      >
        <template #loading>
          <slot name="loading-row">
            <slot name="loading">
              <div class="space-y-3 p-4 md:p-5">
                <USkeleton
                  v-for="index in loadingRows"
                  :key="index"
                  :class="rowSkeletonClass"
                />
              </div>
            </slot>
          </slot>
        </template>

        <template #empty>
          <slot name="empty">
            <div class="flex min-h-[260px] items-center justify-center bg-gradient-to-b from-default to-elevated/20 p-10 text-center">
              <div class="max-w-sm space-y-3">
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-default/80 bg-elevated/60 text-primary">
                  <UIcon :name="emptyIcon" class="h-5 w-5" />
                </div>
                <div class="space-y-1.5">
                  <p class="text-sm font-semibold text-highlighted">
                    {{ emptyTitle }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ emptyDescription }}
                  </p>
                </div>
              </div>
            </div>
          </slot>
        </template>

        <template
          v-for="slotName in forwardedSlotNames"
          :key="slotName"
          #[slotName]="slotProps"
        >
          <slot :name="slotName" v-bind="slotProps ?? {}" />
        </template>
      </UTable>
    </div>

    <div
      v-if="showFooter && !showCardLoading"
      class="flex flex-col gap-3 border-t border-default/80 bg-elevated/20 px-4 py-3 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
        <span
          v-if="selectable"
          class="font-medium text-highlighted"
        >
          {{ selectedCount }} selecionado(s)
        </span>
        <span v-if="selectable" class="hidden h-1 w-1 rounded-full bg-default md:block" />
        <span class="font-medium text-toned">
          {{ pageStart }}-{{ pageEnd }}
        </span>
        <span>de {{ totalItems }} registro(s)</span>
        <span class="hidden h-1 w-1 rounded-full bg-default md:block" />
        <span class="text-xs uppercase tracking-[0.08em] text-muted">
          {{ pageSize }} por página
        </span>
      </div>

      <UPagination
        v-if="showPagination"
        v-model="currentPage"
        :items-per-page="pageSize"
        :total="totalItems"
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
