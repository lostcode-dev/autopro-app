<script setup lang="ts">
import type { Goal, GoalTask, GoalHabitLink } from '~/types/goals'
import { GoalStatus } from '~/types/goals'

const props = defineProps<{
  goal: Goal
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': []
  'archive': []
  'updated': []
}>()

const { getLifeCategoryLabel, getTimeCategoryLabel, getStatusColor, getStatusLabel, completeGoal, createTask, updateTask, deleteTask, linkHabit, unlinkHabit } = useGoals()

// ─── Local state for goal detail (refreshable) ──────────────────────────────
const goalDetail = ref<Goal | null>(null)
const detailLoading = ref(false)

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.goal) {
    await loadDetail()
  }
}, { immediate: true })

watch(() => props.goal?.id, async () => {
  if (props.open && props.goal) {
    await loadDetail()
  }
})

async function loadDetail() {
  if (!props.goal) return
  detailLoading.value = true
  try {
    const data = await $fetch<Goal>(`/api/goals/${props.goal.id}`)
    goalDetail.value = data
  } catch {
    goalDetail.value = null
  } finally {
    detailLoading.value = false
  }
}

const tasks = computed<GoalTask[]>(() => goalDetail.value?.tasks ?? [])
const habitLinks = computed<GoalHabitLink[]>(() => goalDetail.value?.habitLinks ?? [])
const completedTaskCount = computed(() => tasks.value.filter(t => t.completed).length)
const currentGoal = computed(() => goalDetail.value ?? props.goal)

// ─── New task form ───────────────────────────────────────────────────────────
const newTaskTitle = ref('')
const addingTask = ref(false)

async function onAddTask() {
  if (!newTaskTitle.value.trim() || !props.goal) return
  if (addingTask.value) return
  addingTask.value = true
  try {
    const result = await createTask(props.goal.id, { title: newTaskTitle.value.trim() })
    if (result) {
      newTaskTitle.value = ''
      await loadDetail()
      emit('updated')
    }
  } finally {
    addingTask.value = false
  }
}

async function onToggleTask(task: GoalTask) {
  await updateTask(task.id, { completed: !task.completed })
  await loadDetail()
  emit('updated')
}

async function onDeleteTask(taskId: string) {
  const ok = await deleteTask(taskId)
  if (ok) {
    await loadDetail()
    emit('updated')
  }
}

// ─── Complete goal ───────────────────────────────────────────────────────────
async function onCompleteGoal() {
  if (!currentGoal.value) return
  const ok = await completeGoal(currentGoal.value.id, currentGoal.value.title)
  if (ok) {
    await loadDetail()
    emit('updated')
  }
}

// ─── Habit linking ───────────────────────────────────────────────────────────
const showHabitLinker = ref(false)

async function onLinkHabit(habitId: string) {
  if (!props.goal) return
  const result = await linkHabit(props.goal.id, { habitId })
  if (result) {
    showHabitLinker.value = false
    await loadDetail()
  }
}

async function onUnlinkHabit(linkId: string) {
  const ok = await unlinkHabit(linkId)
  if (ok) {
    await loadDetail()
  }
}
</script>

<template>
  <USlideover
    :open="props.open"
    title="Detalhes da meta"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="detailLoading" class="space-y-4">
        <USkeleton class="h-6 w-2/3" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-20 w-full" />
      </div>

      <div v-else-if="currentGoal" class="space-y-6">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-highlighted">
              {{ currentGoal.title }}
            </h3>
            <p v-if="currentGoal.description" class="text-sm text-muted">
              {{ currentGoal.description }}
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="emit('edit')"
            />
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
          <UBadge :label="getLifeCategoryLabel(currentGoal.lifeCategory)" variant="subtle" color="primary" />
          <UBadge :label="getTimeCategoryLabel(currentGoal.timeCategory)" variant="subtle" color="neutral" />
          <UBadge
            :label="getStatusLabel(currentGoal.status)"
            :color="getStatusColor(currentGoal.status)"
            variant="subtle"
          />
        </div>

        <!-- Progress -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted">Progresso</span>
            <span class="text-sm font-medium text-highlighted tabular-nums">
              {{ Math.round(currentGoal.progress) }}%
            </span>
          </div>
          <UProgress :model-value="currentGoal.progress" size="md" />
          <p class="text-xs text-muted">
            {{ completedTaskCount }} de {{ tasks.length }} tarefa{{ tasks.length !== 1 ? 's' : '' }} concluída{{ completedTaskCount !== 1 ? 's' : '' }}
          </p>
        </div>

        <!-- Complete goal button -->
        <UButton
          v-if="currentGoal.status === GoalStatus.Active && currentGoal.progress === 100"
          label="Marcar como concluída"
          icon="i-lucide-trophy"
          color="success"
          variant="soft"
          block
          @click="onCompleteGoal"
        />

        <!-- Tasks section -->
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-highlighted">
            Tarefas
          </h4>

          <!-- Task list -->
          <div v-if="tasks.length > 0" class="space-y-2">
            <div
              v-for="task in tasks"
              :key="task.id"
              class="flex items-center gap-2 rounded-lg border border-default p-2"
            >
              <UCheckbox
                :model-value="task.completed"
                @update:model-value="onToggleTask(task)"
              />
              <span
                class="flex-1 text-sm"
                :class="task.completed ? 'text-muted line-through' : 'text-highlighted'"
              >
                {{ task.title }}
              </span>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="onDeleteTask(task.id)"
              />
            </div>
          </div>

          <p v-else class="text-sm text-muted">
            Nenhuma tarefa adicionada ainda.
          </p>

          <!-- Add task input -->
          <div class="flex items-center gap-2">
            <UInput
              v-model="newTaskTitle"
              placeholder="Adicionar tarefa..."
              class="flex-1"
              size="sm"
              @keydown.enter="onAddTask"
            />
            <UButton
              icon="i-lucide-plus"
              size="sm"
              :loading="addingTask"
              :disabled="addingTask || !newTaskTitle.trim()"
              @click="onAddTask"
            />
          </div>
        </div>

        <!-- Linked habits section -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium text-highlighted">
              Hábitos vinculados
            </h4>
            <UButton
              v-if="!showHabitLinker"
              icon="i-lucide-link"
              label="Vincular"
              size="xs"
              color="neutral"
              variant="subtle"
              @click="showHabitLinker = true"
            />
          </div>

          <div v-if="habitLinks.length > 0" class="space-y-2">
            <div
              v-for="link in habitLinks"
              :key="link.id"
              class="flex items-center justify-between rounded-lg border border-default p-2"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-calendar-check" class="size-4 text-muted" />
                <span class="text-sm text-highlighted">
                  {{ link.habitName ?? 'Hábito' }}
                </span>
              </div>
              <UButton
                icon="i-lucide-unlink"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="onUnlinkHabit(link.id)"
              />
            </div>
          </div>

          <p v-else-if="!showHabitLinker" class="text-sm text-muted">
            Nenhum hábito vinculado.
          </p>

          <!-- Habit linker -->
          <GoalsHabitLinker
            v-if="showHabitLinker"
            :existing-habit-ids="habitLinks.map(l => l.habitId)"
            @link="onLinkHabit"
            @cancel="showHabitLinker = false"
          />
        </div>

        <!-- Meta info -->
        <div class="space-y-2 text-sm pt-2 border-t border-default">
          <div>
            <span class="text-muted">Criada em: </span>
            <span class="text-highlighted">
              {{ new Date(currentGoal.createdAt).toLocaleDateString('pt-BR') }}
            </span>
          </div>
          <div>
            <span class="text-muted">Atualizada em: </span>
            <span class="text-highlighted">
              {{ new Date(currentGoal.updatedAt).toLocaleDateString('pt-BR') }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
