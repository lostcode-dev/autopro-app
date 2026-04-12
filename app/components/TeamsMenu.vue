<script setup lang="ts">
const workshop = useWorkshopBootstrap()

defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <NuxtLink
    to="/app/dashboard"
    class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-elevated"
  >
    <AppLogo
      :show-label="false"
      size="sm"
    />
    <span
      v-if="!collapsed"
      class="text-sm font-semibold text-highlighted truncate"
    >
      {{ workshop.organization.value?.name || 'AutoPro' }}
    </span>
  </NuxtLink>
</template>
