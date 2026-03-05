<script setup lang="ts">
import type { JournalEntry } from '~/types/journal'

defineProps<{
  entries: JournalEntry[]
  total: number
  page: number
  pageSize: number
  loading: boolean
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'select': [date: string]
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function truncateContent(text: string, maxLen: number = 120): string {
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen).trimEnd() + '...'
}
</script>

<template>
  <!-- Loading -->
  <div
    v-if="loading"
    class="space-y-3"
  >
    <UCard
      v-for="i in 5"
      :key="i"
    >
      <div class="space-y-2">
        <USkeleton class="h-4 w-32" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-3 w-2/3" />
      </div>
    </UCard>
  </div>

  <!-- Empty -->
  <div
    v-else-if="entries.length === 0"
    class="flex flex-col items-center justify-center py-12 gap-3"
  >
    <UIcon
      name="i-lucide-book-open"
      class="size-12 text-dimmed"
    />
    <p class="text-sm text-muted">
      Nenhuma entrada encontrada.
    </p>
  </div>

  <!-- Entry list -->
  <div
    v-else
    class="space-y-3"
  >
    <UCard
      v-for="entry in entries"
      :key="entry.id"
      class="cursor-pointer hover:ring-1 hover:ring-primary transition-all"
      @click="emit('select', entry.entryDate)"
    >
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-highlighted">
            {{ entry.title || formatDate(entry.entryDate) }}
          </span>
          <span class="text-xs text-muted">
            {{ formatDate(entry.entryDate) }}
          </span>
        </div>
        <p class="text-sm text-muted">
          {{ truncateContent(entry.content) }}
        </p>
        <div
          v-if="entry.tags && entry.tags.length > 0"
          class="flex flex-wrap gap-1 pt-1"
        >
          <UBadge
            v-for="tag in entry.tags"
            :key="tag.id"
            :label="tag.name"
            variant="subtle"
            color="neutral"
            size="xs"
          />
        </div>
      </div>
    </UCard>

    <!-- Pagination -->
    <div
      v-if="total > pageSize"
      class="flex justify-center pt-4"
    >
      <UPagination
        :model-value="page"
        :total="total"
        :items-per-page="pageSize"
        @update:model-value="emit('update:page', $event)"
      />
    </div>
  </div>
</template>
