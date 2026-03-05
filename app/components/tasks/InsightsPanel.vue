<script setup lang="ts">
import type { TaskInsights } from '~/types/tasks'

defineProps<{
  insights: TaskInsights | null
  loading: boolean
}>()
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <template v-if="loading">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <UCard v-for="i in 6" :key="i">
          <div class="text-center space-y-2">
            <USkeleton class="h-8 w-12 mx-auto" />
            <USkeleton class="h-3 w-16 mx-auto" />
          </div>
        </UCard>
      </div>
      <UCard>
        <div class="space-y-3">
          <USkeleton class="h-4 w-32" />
          <USkeleton v-for="i in 4" :key="i" class="h-6 w-full" />
        </div>
      </UCard>
    </template>

    <template v-else-if="insights">
      <!-- Stats cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-highlighted">
              {{ insights.totalTasks }}
            </p>
            <p class="text-xs text-muted">
              Total de tarefas
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-warning">
              {{ insights.pendingTasks }}
            </p>
            <p class="text-xs text-muted">
              Pendentes
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-info">
              {{ insights.inProgressTasks }}
            </p>
            <p class="text-xs text-muted">
              Em progresso
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-success">
              {{ insights.completedTasks }}
            </p>
            <p class="text-xs text-muted">
              Concluídas
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-error">
              {{ insights.overdueTasks }}
            </p>
            <p class="text-xs text-muted">
              Atrasadas
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-highlighted">
              {{ insights.completionRate }}%
            </p>
            <p class="text-xs text-muted">
              Taxa de conclusão
            </p>
          </div>
        </UCard>
      </div>

      <!-- By priority -->
      <UCard v-if="insights.byPriority.length > 0">
        <template #header>
          <h4 class="text-sm font-medium text-highlighted">
            Por prioridade
          </h4>
        </template>

        <div class="space-y-3">
          <div v-for="item in insights.byPriority" :key="item.priority" class="space-y-1">
            <div class="flex items-center justify-between text-sm">
              <span class="text-highlighted">{{ item.label }}</span>
              <span class="text-muted tabular-nums">
                {{ item.count }} tarefa{{ item.count !== 1 ? 's' : '' }}
              </span>
            </div>
            <UProgress
              :model-value="insights.totalTasks > 0 ? Math.round((item.count / insights.totalTasks) * 100) : 0"
              size="xs"
            />
          </div>
        </div>
      </UCard>

      <!-- By list -->
      <UCard v-if="insights.byList.length > 0">
        <template #header>
          <h4 class="text-sm font-medium text-highlighted">
            Por lista
          </h4>
        </template>

        <div class="space-y-3">
          <div v-for="item in insights.byList" :key="item.listName" class="space-y-1">
            <div class="flex items-center justify-between text-sm">
              <span class="text-highlighted">{{ item.listName }}</span>
              <span class="text-muted tabular-nums">
                {{ item.count }} tarefa{{ item.count !== 1 ? 's' : '' }}
              </span>
            </div>
            <UProgress
              :model-value="insights.totalTasks > 0 ? Math.round((item.count / insights.totalTasks) * 100) : 0"
              size="xs"
            />
          </div>
        </div>
      </UCard>

      <!-- Empty insights -->
      <div v-if="insights.totalTasks === 0" class="flex flex-col items-center justify-center py-8 gap-3">
        <UIcon name="i-lucide-bar-chart-3" class="size-12 text-dimmed" />
        <p class="text-sm text-muted">
          Crie tarefas para ver estatísticas aqui.
        </p>
      </div>
    </template>
  </div>
</template>
