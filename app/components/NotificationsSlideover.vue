<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'
import { useNotifications } from '~/composables/useNotifications'

const { isNotificationsSlideoverOpen } = useDashboard()

const toast = useToast()
const notifications = useNotifications()

watch(isNotificationsSlideoverOpen, async (open) => {
  if (!open)
    return
  try {
    await notifications.ensureReady()
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível carregar as notificações'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  }
})

async function markAllRead() {
  try {
    await notifications.markAllRead()
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível marcar como lidas'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  }
}

async function onOpen(notificationId: number) {
  try {
    await notifications.markRead(notificationId)
  }
  catch {
    // ignore
  }
}
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    title="Notificações"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2 w-full">
        <span class="text-sm font-medium">Notificações</span>
        <UButton
          label="Marcar todas como lidas"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="markAllRead"
        />
      </div>
    </template>

    <template #body>
      <div v-if="notifications.pending" class="space-y-3">
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-12 w-full" />
      </div>

      <NuxtLink
        v-else
        v-for="notification in notifications.items"
        :key="notification.id"
        :to="notification.linkPath || '/app'"
        class="px-3 py-2.5 rounded-md hover:bg-elevated/50 flex items-center gap-3 relative -mx-3 first:-mt-3 last:-mb-3"
        @click="onOpen(notification.id)"
      >
        <UChip
          color="error"
          :show="!!notification.unread"
          inset
        >
          <UAvatar
            v-bind="notification.sender.avatar"
            :alt="notification.sender.name"
            size="md"
          />
        </UChip>

        <div class="text-sm flex-1">
          <p class="flex items-center justify-between">
            <span class="text-highlighted font-medium">{{ notification.sender.name }}</span>

            <time
              :datetime="notification.date"
              class="text-muted text-xs"
              v-text="formatTimeAgo(new Date(notification.date))"
            />
          </p>

          <p class="text-dimmed">
            {{ notification.body }}
          </p>
        </div>
      </NuxtLink>
    </template>
  </USlideover>
</template>
