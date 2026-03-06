<script setup lang="ts">
import type { TodayHabit } from '~/types/habits'
import { DIFFICULTY_META, HABIT_TYPE_META } from '~/types/habits'

const props = defineProps<{
  habits: TodayHabit[]
  completedCount: number
  totalCount: number
  loading: boolean
  currentDate: string
}>()

const emit = defineEmits<{
  toggle: [habitId: string, completed: boolean]
  select: [habitId: string]
  'log-with-note': [habitId: string, completed: boolean, note: string]
  'navigate-date': [direction: 'prev' | 'next']
}>()

// ─── Note modal ───────────────────────────────────────────────────────────────
const noteModalOpen = ref(false)
const noteHabitId = ref<string | null>(null)
const noteCompleted = ref(true)
const noteText = ref('')

function openNoteModal(habitId: string, completed: boolean) {
  noteHabitId.value = habitId
  noteCompleted.value = completed
  noteText.value = ''
  noteModalOpen.value = true
}

function submitNote() {
  if (!noteHabitId.value) return
  emit('log-with-note', noteHabitId.value, noteCompleted.value, noteText.value)
  noteModalOpen.value = false
  noteHabitId.value = null
  noteText.value = ''
}

const allDone = computed(() => props.totalCount > 0 && props.completedCount === props.totalCount)

const formattedDate = computed(() => {
  const d = new Date(props.currentDate + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
})

const isToday = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return props.currentDate === today
})
</script>

<template>
  <div class="space-y-4">
    <!-- Date navigation -->
    <div class="flex items-center justify-between">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Dia anterior"
        @click="emit('navigate-date', 'prev')"
      />
      <div class="text-center">
        <p class="text-sm font-medium text-highlighted capitalize">
          {{ formattedDate }}
        </p>
        <UBadge v-if="isToday" label="Hoje" variant="subtle" color="primary" size="xs" />
      </div>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Próximo dia"
        @click="emit('navigate-date', 'next')"
      />
    </div>

    <!-- Progress bar -->
    <div v-if="totalCount > 0" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Progresso do dia</span>
        <span class="font-medium text-highlighted">{{ completedCount }}/{{ totalCount }}</span>
      </div>
      <UProgress
        :model-value="Number(completedCount)"
        :max="Number(totalCount)"
        size="sm"
      />
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

          <!-- Positive/Negative indicator -->
          <UIcon
            :name="HABIT_TYPE_META[habit.habitType ?? 'positive'].icon"
            class="size-4 shrink-0"
            :class="habit.habitType === 'negative' ? 'text-error' : 'text-success'"
          />

          <div class="flex-1 min-w-0">
            <p
              class="font-medium truncate"
              :class="habit.log?.completed ? 'line-through text-muted' : 'text-highlighted'"
            >
              {{ habit.name }}
            </p>
            <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
              <UBadge
                v-if="habit.identity"
                :label="habit.identity.name"
                variant="subtle"
                color="primary"
                size="xs"
              />
              <span v-if="habit.log?.note" class="text-xs text-muted italic truncate max-w-40">
                "{{ habit.log.note }}"
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
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
              <span>{{ habit.streak.currentStreak }}</span>
            </div>

            <!-- Note action -->
            <UButton
              :icon="habit.log?.completed ? 'i-lucide-message-square' : 'i-lucide-message-square-plus'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="habit.log?.completed ? 'Adicionar nota (feito)' : 'Marcar como não feito com nota'"
              @click.stop="openNoteModal(habit.id, !(habit.log?.completed ?? false))"
            />
          </div>
        </div>
      </UCard>
    </template>

    <!-- Empty state -->
    <div v-else-if="!loading && habits.length === 0" class="flex flex-col items-center justify-center gap-4 py-12">
      <UIcon name="i-lucide-sun" class="size-12 text-dimmed" />
      <div class="text-center">
        <p class="font-medium text-highlighted">
          Nenhum hábito para {{ isToday ? 'hoje' : 'este dia' }}
        </p>
        <p class="text-sm text-muted">
          Crie seu primeiro hábito para começar a trilhar o caminho.
        </p>
      </div>
    </div>

    <!-- Note modal -->
    <UModal
      :open="noteModalOpen"
      title="Adicionar observação"
      @update:open="noteModalOpen = $event"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">
            {{ noteCompleted ? 'Marcar como feito com observação:' : 'Marcar como não feito com observação:' }}
          </p>
          <UTextarea
            v-model="noteText"
            placeholder="O que aconteceu? O que funcionou ou não?"
            class="w-full"
            :rows="3"
          />
          <div class="flex justify-end gap-2">
            <UButton
              icon="i-lucide-x"
              label="Cancelar"
              color="neutral"
              variant="subtle"
              @click="noteModalOpen = false"
            />
            <UButton
              icon="i-lucide-check"
              label="Salvar"
              :loading="false"
              @click="submitNote"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
