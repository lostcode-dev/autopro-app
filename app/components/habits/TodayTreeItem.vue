<script setup lang="ts">
import type { HabitStack, TodayHabitTreeNode } from '~/types/habits'
import { DIFFICULTY_META, HABIT_TYPE_META } from '~/types/habits'

const props = defineProps<{
  node: TodayHabitTreeNode
  stacks?: HabitStack[]
  depth?: number
  isLast?: boolean
  ancestorHasNext?: boolean[]
}>()

const emit = defineEmits<{
  toggle: [habitId: string, completed: boolean]
  select: [habitId: string]
  'open-note': [habitId: string, completed: boolean]
}>()

const depth = computed(() => props.depth ?? 0)
const isLast = computed(() => props.isLast ?? true)
const ancestorHasNext = computed(() => props.ancestorHasNext ?? [])

const INDENT_SIZE = 24
const CONNECTOR_OFFSET = 12
const ROW_MIDPOINT = '2rem'

const treePaddingLeft = computed(() => {
  if (depth.value === 0) return '0px'
  return `${(ancestorHasNext.value.length + 1) * INDENT_SIZE}px`
})

const currentConnectorLeft = computed(() => {
  if (depth.value === 0) return '0px'
  return `${ancestorHasNext.value.length * INDENT_SIZE + CONNECTOR_OFFSET}px`
})

const ancestorConnectors = computed(() => {
  return ancestorHasNext.value.map((hasNext, index) => ({
    hasNext,
    left: `${index * INDENT_SIZE + CONNECTOR_OFFSET}px`
  }))
})

function onChildToggle(habitId: string, completed: boolean) {
  emit('toggle', habitId, completed)
}

function onChildSelect(habitId: string) {
  emit('select', habitId)
}

function onChildOpenNote(habitId: string, completed: boolean) {
  emit('open-note', habitId, completed)
}

function getIncomingStacks(): HabitStack[] {
  return (props.stacks ?? []).filter((stack) => stack.newHabitId === props.node.habit.id)
}

function getOutgoingStacks(): HabitStack[] {
  return (props.stacks ?? []).filter((stack) => stack.triggerHabitId === props.node.habit.id)
}

function isStackedHabit(): boolean {
  return getIncomingStacks().length > 0 || getOutgoingStacks().length > 0
}

function getIncomingStackLabel(): string {
  const incomingStacks = getIncomingStacks()

  if (incomingStacks.length === 0) return ''
  if (incomingStacks.length === 1) {
    return `Depois de ${incomingStacks[0]?.triggerHabit?.name ?? 'outro hábito'}`
  }

  return `Depois de ${incomingStacks.length} hábitos`
}

function getOutgoingStackLabel(): string {
  const outgoingStacks = getOutgoingStacks()

  if (outgoingStacks.length === 0) return ''
  if (outgoingStacks.length === 1) {
    return `Continua com ${outgoingStacks[0]?.newHabit?.name ?? 'o próximo hábito'}`
  }

  return `Continua com ${outgoingStacks.length} hábitos`
}
</script>

<template>
  <div class="relative space-y-3">
    <div
      v-for="(connector, index) in ancestorConnectors"
      :key="`${node.habit.id}-ancestor-${index}`"
      v-show="connector.hasNext"
      class="pointer-events-none absolute top-0 bottom-0 w-px bg-default"
      :style="{ left: connector.left }"
    />

    <div
      v-if="depth > 0"
      class="pointer-events-none absolute w-px bg-primary/30"
      :style="{
        left: currentConnectorLeft,
        top: '0',
        height: ROW_MIDPOINT,
      }"
    />

    <div
      v-if="depth > 0"
      class="pointer-events-none absolute h-px bg-primary/30"
      :style="{
        left: currentConnectorLeft,
        top: ROW_MIDPOINT,
        width: `${CONNECTOR_OFFSET}px`,
      }"
    />

    <div
      v-if="depth > 0 && (node.children.length > 0 || !isLast)"
      class="pointer-events-none absolute bottom-0 w-px bg-primary/30"
      :style="{
        left: currentConnectorLeft,
        top: ROW_MIDPOINT,
      }"
    />

    <div :style="{ paddingLeft: treePaddingLeft }">
      <UCard
        :class="[
          'cursor-pointer transition-colors hover:bg-elevated/50',
          isStackedHabit() ? 'ring-1 ring-primary/30 bg-primary/5' : '',
          depth > 0 ? 'shadow-sm' : '',
        ]"
        @click="emit('select', node.habit.id)"
      >
        <div class="flex items-center gap-3">
          <UCheckbox
            :model-value="node.habit.log?.completed ?? false"
            @click.stop
            @update:model-value="emit('toggle', node.habit.id, $event as boolean)"
          />

          <UIcon
            :name="HABIT_TYPE_META[node.habit.habitType ?? 'positive'].icon"
            class="size-4 shrink-0"
            :class="node.habit.habitType === 'negative' ? 'text-error' : 'text-success'"
          />

          <div class="flex-1 min-w-0">
            <p
              class="font-medium truncate"
              :class="node.habit.log?.completed ? 'line-through text-muted' : 'text-highlighted'"
            >
              {{ node.habit.name }}
            </p>
            <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
              <UBadge
                v-if="node.habit.identity"
                :label="node.habit.identity.name"
                variant="subtle"
                color="primary"
                size="xs"
              />
              <span v-if="node.habit.log?.note" class="max-w-40 truncate text-xs italic text-muted">
                "{{ node.habit.log.note }}"
              </span>
            </div>

            <div v-if="isStackedHabit()" class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <UBadge
                v-if="getIncomingStacks().length"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                <template #leading>
                  <UIcon name="i-lucide-arrow-down-left" class="size-3" />
                </template>
                {{ getIncomingStackLabel() }}
              </UBadge>

              <UBadge
                v-if="getOutgoingStacks().length"
                color="primary"
                variant="subtle"
                size="xs"
              >
                <template #leading>
                  <UIcon name="i-lucide-arrow-up-right" class="size-3" />
                </template>
                {{ getOutgoingStackLabel() }}
              </UBadge>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <UBadge
              :color="DIFFICULTY_META[node.habit.difficulty].color"
              variant="subtle"
              size="xs"
            >
              <template #leading>
                <UIcon :name="DIFFICULTY_META[node.habit.difficulty].icon" class="size-3" />
              </template>
              {{ DIFFICULTY_META[node.habit.difficulty].label }}
            </UBadge>
            <div
              v-if="node.habit.streak && node.habit.streak.currentStreak > 0"
              class="flex items-center gap-1 text-xs text-muted"
            >
              <UIcon name="i-lucide-flame" class="size-3.5 text-orange-500" />
              <span>{{ node.habit.streak.currentStreak }}</span>
            </div>

            <UButton
              :icon="node.habit.log?.completed ? 'i-lucide-message-square' : 'i-lucide-message-square-plus'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="node.habit.log?.completed ? 'Adicionar nota (feito)' : 'Marcar como não feito com nota'"
              @click.stop="emit('open-note', node.habit.id, !(node.habit.log?.completed ?? false))"
            />
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="node.children.length" class="space-y-3">
      <TodayTreeItem
        v-for="(child, index) in node.children"
        :key="child.habit.id"
        :node="child"
        :stacks="stacks"
        :depth="depth + 1"
        :is-last="index === node.children.length - 1"
        :ancestor-has-next="[...ancestorHasNext, !isLast]"
        @toggle="onChildToggle"
        @select="onChildSelect"
        @open-note="onChildOpenNote"
      />
    </div>
  </div>
</template>