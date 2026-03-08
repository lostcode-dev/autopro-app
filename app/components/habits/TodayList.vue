<script setup lang="ts">
import type { HabitStack, TodayHabit, TodayHabitTreeNode } from '~/types/habits'

const props = defineProps<{
  habits: TodayHabit[]
  stacks?: HabitStack[]
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
const habitTrees = computed<TodayHabitTreeNode[]>(() => {
  const visibleHabits = props.habits ?? []

  if (visibleHabits.length === 0) return []

  const visibleHabitIds = new Set(visibleHabits.map((habit) => habit.id))
  const childrenByParent = new Map<string, string[]>()
  const parentsByChild = new Map<string, string[]>()

  for (const stack of props.stacks ?? []) {
    if (!visibleHabitIds.has(stack.triggerHabitId) || !visibleHabitIds.has(stack.newHabitId)) {
      continue
    }

    const parentChildren = childrenByParent.get(stack.triggerHabitId) ?? []
    if (!parentChildren.includes(stack.newHabitId)) {
      parentChildren.push(stack.newHabitId)
      childrenByParent.set(stack.triggerHabitId, parentChildren)
    }

    const childParents = parentsByChild.get(stack.newHabitId) ?? []
    if (!childParents.includes(stack.triggerHabitId)) {
      childParents.push(stack.triggerHabitId)
      parentsByChild.set(stack.newHabitId, childParents)
    }
  }

  const habitById = new Map(visibleHabits.map((habit) => [habit.id, habit] as const))
  const roots: TodayHabitTreeNode[] = []
  const visited = new Set<string>()

  function buildNode(habitId: string): TodayHabitTreeNode | null {
    if (visited.has(habitId)) return null

    const habit = habitById.get(habitId)
    if (!habit) return null

    visited.add(habitId)

    const childIds = childrenByParent.get(habitId) ?? []
    const children = childIds
      .map((childId) => buildNode(childId))
      .filter((child): child is TodayHabitTreeNode => child !== null)

    return { habit, children }
  }

  for (const habit of visibleHabits) {
    const visibleParents = parentsByChild.get(habit.id) ?? []
    if (visibleParents.length === 0) {
      const root = buildNode(habit.id)
      if (root) roots.push(root)
    }
  }

  for (const habit of visibleHabits) {
    const root = buildNode(habit.id)
    if (root) roots.push(root)
  }

  return roots
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
      <div class="space-y-4">
        <HabitsTodayTreeItem
          v-for="tree in habitTrees"
          :key="tree.habit.id"
          :node="tree"
          :stacks="stacks"
          @toggle="emit('toggle', $event[0], $event[1])"
          @select="emit('select', $event)"
          @open-note="openNoteModal($event[0], $event[1])"
        />
      </div>
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
