<script setup lang="ts">
import type { Habit } from '~/types/habits'
import { HabitDifficulty, HabitFrequency } from '~/types/habits'

const props = defineProps<{
  habit: Habit
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'archive': []
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

const frequencyLabel: Record<string, string> = {
  [HabitFrequency.Daily]: 'Diário',
  [HabitFrequency.Weekly]: 'Semanal',
  [HabitFrequency.Custom]: 'Personalizado'
}

const activeTab = ref('overview')

const tabs = [
  { label: 'Visão geral', value: 'overview' },
  { label: 'Calendário', value: 'calendar' }
]

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
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-highlighted">
              {{ habit.name }}
            </h3>
            <p v-if="habit.description" class="text-sm text-muted">
              {{ habit.description }}
            </p>
          </div>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-archive"
              color="error"
              variant="ghost"
              size="sm"
              @click="emit('archive')"
            />
          </div>
        </div>

        <!-- Badges -->
        <div class="flex flex-wrap gap-2">
          <UBadge :label="frequencyLabel[habit.frequency]" variant="subtle" color="neutral" />
          <UBadge
            :label="difficultyLabel[habit.difficulty]"
            :color="difficultyColor[habit.difficulty]"
            variant="subtle"
          />
          <UBadge
            v-if="habit.identity"
            :label="habit.identity.name"
            variant="subtle"
            color="primary"
          />
        </div>

        <!-- Streak stats -->
        <div v-if="habit.streak" class="grid grid-cols-2 gap-3">
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-highlighted">
                {{ habit.streak.currentStreak }}
              </p>
              <p class="text-xs text-muted">
                Streak atual
              </p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-highlighted">
                {{ habit.streak.longestStreak }}
              </p>
              <p class="text-xs text-muted">
                Maior streak
              </p>
            </div>
          </UCard>
        </div>

        <!-- Tabs -->
        <UTabs
          :items="tabs"
          :model-value="activeTab"
          @update:model-value="activeTab = $event as string"
        />

        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="space-y-3">
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
              {{ habit.customDays.map((d: number) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ') }}
            </span>
          </div>
        </div>

        <!-- Calendar Tab -->
        <HabitsCalendar
          v-if="activeTab === 'calendar'"
          :habit-id="habit.id"
        />
      </div>
    </template>
  </USlideover>
</template>
