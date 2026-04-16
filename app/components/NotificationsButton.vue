<script setup lang="ts">
const { openNotifications } = useNotification()
const notifications = useNotifications()
const unreadCount = notifications.unreadCount

onMounted(() => {
  void notifications.ensureReady()
})
</script>

<template>
  <UTooltip text="Notificações" :shortcuts="['N']">
    <UButton
      color="neutral"
      variant="ghost"
      square
      @click="openNotifications"
    >
      <UChip
        color="error"
        inset
        :show="unreadCount > 0"
        :text="String(unreadCount)"
      >
        <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
      </UChip>
    </UButton>
  </UTooltip>
</template>
