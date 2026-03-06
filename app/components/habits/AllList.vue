<script setup lang="ts">
import type { Habit } from '~/types/habits'
import { DIFFICULTY_META, FREQUENCY_META, HABIT_TYPE_META } from '~/types/habits'

const _props = defineProps<{
  habits: Habit[]
  total: number
  page: number
  pageSize: number
  loading: boolean
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'select': [habitId: string]
  'edit': [habit: Habit]
  'archive': [habit: Habit]
}>()

const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function getRowItems(habit: Habit) {
  return [
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect: () => emit('edit', habit)
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Arquivar',
      icon: 'i-lucide-archive',
      color: 'error' as const,
      onSelect: () => emit('archive', habit)
    }
  ]
}
</script>

<template>
  <div class="space-y-4">
    <!-- Loading skeletons -->
    <template v-if="loading">
      <UCard v-for="i in 6" :key="i">
        <div class="flex items-center gap-3">
          <div class="flex-1 space-y-2">
            <USkeleton class="h-4 w-2/3" />
            <USkeleton class="h-3 w-1/3" />
          </div>
          <USkeleton class="h-5 w-16 rounded-full" />
          <USkeleton class="h-5 w-14 rounded-full" />
        </div>
      </UCard>
    </template>

    <!-- Habits list -->
    <template v-else-if="habits.length > 0">
      <UCard
        v-for="habit in habits"
        :key="habit.id"
        class="cursor-pointer transition-colors hover:bg-elevated/50"
        @click="emit('select', habit.id)"
      >
        <div class="flex items-center gap-3">
          <!-- Positive/Negative indicator -->
          <UIcon
            :name="HABIT_TYPE_META[habit.habitType ?? 'positive'].icon"
            class="size-4 shrink-0"
            :class="habit.habitType === 'negative' ? 'text-error' : 'text-success'"
          />

          <div class="flex-1 min-w-0">
            <p class="font-medium text-highlighted truncate">
              {{ habit.name }}
            </p>
            <!-- Tags row: identity + frequency + custom days -->
            <div class="flex flex-wrap items-center gap-1.5 mt-1">
              <UBadge
                v-if="habit.identity"
                :label="habit.identity.name"
                variant="subtle"
                color="primary"
                size="xs"
              />
              <UBadge variant="subtle" color="neutral" size="xs">
                <template #leading>
                  <UIcon :name="FREQUENCY_META[habit.frequency].icon" class="size-3" />
                </template>
                {{ FREQUENCY_META[habit.frequency].label }}
              </UBadge>
              <!-- Show custom days when frequency is custom -->
              <span
                v-if="habit.frequency === 'custom' && habit.customDays?.length"
                class="text-xs text-muted"
              >
                ({{ habit.customDays.map((d: number) => dayLabels[d]).join(', ') }})
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UBadge
              :color="DIFFICULTY_META[habit.difficulty].color"
              variant="subtle"
              size="xs"
            >
              <template #leading>
                <UIcon :name="DIFFICULTY_META[habit.difficulty].icon" class="size-3" />
              </template>
              {{ DIFFICULTY_META[habit.difficulty].label }}
            </UBadge>

            <div
              v-if="habit.streak && habit.streak.currentStreak > 0"
              class="flex items-center gap-1 text-xs text-muted"
            >
              <UIcon name="i-lucide-flame" class="size-3.5 text-orange-500" />
              <span>{{ habit.streak.currentStreak }}d</span>
            </div>

            <UDropdownMenu
              :items="getRowItems(habit)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                size="xs"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center gap-4 py-12">
      <UIcon name="i-lucide-inbox" class="size-12 text-dimmed" />
      <div class="text-center">
        <p class="font-medium text-highlighted">
          Nenhum hábito encontrado
        </p>
        <p class="text-sm text-muted">
          Ajuste os filtros ou crie um novo hábito.
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > pageSize" class="flex justify-center pt-2">
      <UPagination
        :default-page="page"
        :items-per-page="pageSize"
        :total="total"
        @update:page="emit('update:page', $event)"
      />
    </div>
  </div>
</template>
