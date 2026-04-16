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
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="loading" class="p-4 space-y-3">
      <slot name="loading">
        <USkeleton v-for="index in loadingRows" :key="index" class="h-10 w-full" />
      </slot>
    </div>

    <template v-else-if="hasItems">
      <UTable
        :columns="columns"
        :data="data"
        :class="tableClass"
      >
        <template
          v-for="(_, slotName) in $slots"
          :key="slotName"
          #[slotName]="slotProps"
        >
          <slot :name="slotName" v-bind="slotProps ?? {}" />
        </template>
      </UTable>
    </template>

    <div
      v-else
      class="flex flex-1 items-center justify-center p-10 text-center"
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
      v-if="showPagination"
      class="flex justify-center border-t border-default p-4"
    >
      <UPagination
        v-model="currentPage"
        :page-count="pageSize"
        :total="total"
      />
    </div>
  </div>
</template>
