<script setup lang="ts">
import type { Habit } from '~/types/habits'
import { DIFFICULTY_META, FREQUENCY_META, HABIT_TYPE_META } from '~/types/habits'

const props = defineProps<{
  habit: Habit
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': []
  'archive': []
  'identityModalOpen': [value: boolean]
}>()

const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
</script>

<template>
  <USlideover
    :open="props.open"
    title="Detalhes do hábito"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2">
              <UIcon
                :name="HABIT_TYPE_META[habit.habitType ?? 'positive'].icon"
                class="size-5 shrink-0"
                :class="habit.habitType === 'negative' ? 'text-error' : 'text-success'"
              />
              <h3 class="text-lg font-semibold text-highlighted truncate">
                {{ habit.name }}
              </h3>
            </div>
            <p v-if="habit.description" class="text-sm text-muted">
              {{ habit.description }}
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Editar hábito"
              @click="emit('edit')"
            />
            <UButton
              icon="i-lucide-archive"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Arquivar hábito"
              @click="emit('archive')"
            />
          </div>
        </div>

        <!-- Badges with icons -->
        <div class="flex flex-wrap gap-2">
          <UBadge variant="subtle" :color="HABIT_TYPE_META[habit.habitType ?? 'positive'].color" size="xs">
            <template #leading>
              <UIcon :name="HABIT_TYPE_META[habit.habitType ?? 'positive'].icon" class="size-3" />
            </template>
            {{ HABIT_TYPE_META[habit.habitType ?? 'positive'].label }}
          </UBadge>
          <UBadge variant="subtle" color="neutral" size="xs">
            <template #leading>
              <UIcon :name="FREQUENCY_META[habit.frequency].icon" class="size-3" />
            </template>
            {{ FREQUENCY_META[habit.frequency].label }}
          </UBadge>
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
          <UBadge
            v-if="habit.identity"
            :label="habit.identity.name"
            variant="subtle"
            color="primary"
            size="xs"
          />
        </div>

        <!-- Streak stats with icons -->
        <div v-if="habit.streak" class="grid grid-cols-2 gap-3">
          <UCard>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-flame" class="size-5 text-orange-500 shrink-0" />
              <div>
                <p class="text-2xl font-bold text-highlighted">
                  {{ habit.streak.currentStreak }}
                </p>
                <p class="text-xs text-muted">
                  Streak atual
                </p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-trophy" class="size-5 text-amber-500 shrink-0" />
              <div>
                <p class="text-2xl font-bold text-highlighted">
                  {{ habit.streak.longestStreak }}
                </p>
                <p class="text-xs text-muted">
                  Maior streak
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Overview info (no tabs needed) -->
        <div class="space-y-3">
          <div class="text-sm">
            <span class="text-muted">Criado em: </span>
            <span class="text-highlighted">
              {{ formatDate(habit.createdAt) }}
            </span>
          </div>
          <div v-if="habit.streak?.lastCompletedDate" class="text-sm">
            <span class="text-muted">Última conclusão: </span>
            <span class="text-highlighted">
              {{ formatDate(habit.streak.lastCompletedDate) }}
            </span>
          </div>
          <div v-if="habit.customDays?.length" class="text-sm">
            <span class="text-muted">Dias: </span>
            <span class="text-highlighted">
              {{ habit.customDays.map((d: number) => dayLabels[d]).join(', ') }}
            </span>
          </div>
        </div>

        <!-- Calendar (always visible, no tab needed) -->
        <HabitsCalendar :habit-id="habit.id" />
      </div>
    </template>
  </USlideover>
</template>
