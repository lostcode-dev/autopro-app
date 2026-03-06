<script setup lang="ts">
import type { TodayHabit } from '~/types/habits'
import { HabitDifficulty } from '~/types/habits'

const props = defineProps<{
  habits: TodayHabit[]
  completedCount: number
  totalCount: number
  loading: boolean
}>()

const emit = defineEmits<{
  toggle: [habitId: string, completed: boolean]
  select: [habitId: string]
}>()

const difficultyLabel: Record<string, string> = {
  [HabitDifficulty.Tiny]: 'Pequeno',
  [HabitDifficulty.Normal]: 'Normal',
  [HabitDifficulty.Hard]: 'Difícil'
}

const difficultyColor: Record<string, 'success' | 'warning' | 'error'> = {
  [HabitDifficulty.Tiny]: 'success',
  [HabitDifficulty.Normal]: 'warning',
  [HabitDifficulty.Hard]: 'error'
}

const progress = computed(() => {
  if (props.totalCount === 0) return 0
  return Math.round((props.completedCount / props.totalCount) * 100)
})

const allDone = computed(() => props.totalCount > 0 && props.completedCount === props.totalCount)
</script>

<template>
  <div class="space-y-4">
    <!-- Progress bar -->
    <div v-if="totalCount > 0" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Progresso do dia</span>
          <span class="font-medium text-highlighted">{{ completedCount }}/{{ totalCount }}</span>
      </div>
      <UProgress :value="progress" size="sm" v-model="completedCount" :max="totalCount" />
    </div>

    <!-- All done state -->
    <UCard v-if="allDone" class="text-center">
      <div class="flex flex-col items-center gap-2 py-4">
        <UIcon name="i-lucide-party-popper" class="size-10 text-primary" />
        <p class="font-medium text-highlighted">
          Parabéns! Todos os hábitos de hoje foram concluídos.
        </p>
        <p class="text-sm text-muted">
          Você está construindo a sua identidade.
        </p>
      </div>
    </UCard>

    <!-- Loading skeletons -->
    <template v-if="loading">
      <UCard v-for="i in 4" :key="i">
        <div class="flex items-center gap-3">
          <USkeleton class="size-5 rounded" />
          <div class="flex-1 space-y-2">
            <USkeleton class="h-4 w-3/4" />
            <USkeleton class="h-3 w-1/3" />
          </div>
          <USkeleton class="h-5 w-12 rounded-full" />
        </div>
      </UCard>
    </template>

    <!-- Habits list -->
    <template v-else-if="habits.length > 0 && !allDone">
      <UCard
        v-for="habit in habits"
        :key="habit.id"
        class="cursor-pointer transition-colors hover:bg-elevated/50"
        @click="emit('select', habit.id)"
      >
        <div class="flex items-center gap-3">
          <UCheckbox
            :model-value="habit.log?.completed ?? false"
            @click.stop
            @update:model-value="emit('toggle', habit.id, $event as boolean)"
          />

          <div class="flex-1 min-w-0">
            <p
              class="font-medium truncate"
              :class="habit.log?.completed ? 'line-through text-muted' : 'text-highlighted'"
            >
              {{ habit.name }}
            </p>
            <div class="flex items-center gap-2 mt-0.5">
              <span v-if="habit.identity" class="text-xs text-muted truncate">
                {{ habit.identity.name }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UBadge
              :label="difficultyLabel[habit.difficulty]"
              :color="difficultyColor[habit.difficulty]"
              variant="subtle"
              size="xs"
            />
            <div
              v-if="habit.streak && habit.streak.currentStreak > 0"
              class="flex items-center gap-1 text-xs text-muted"
            >
              <UIcon name="i-lucide-flame" class="size-3.5 text-orange-500" />
              <span>{{ habit.streak.currentStreak }}</span>
            </div>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Empty state -->
    <div v-else-if="!loading && habits.length === 0" class="flex flex-col items-center justify-center gap-4 py-12">
      <UIcon name="i-lucide-sun" class="size-12 text-dimmed" />
      <div class="text-center">
        <p class="font-medium text-highlighted">
          Nenhum hábito para hoje
        </p>
        <p class="text-sm text-muted">
          Crie seu primeiro hábito para começar a trilhar o caminho.
        </p>
      </div>
    </div>
  </div>
</template>
