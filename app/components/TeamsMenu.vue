<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const workshop = useWorkshopBootstrap()
const orgLogoUrl = computed(() => workshop.organization.value?.logo_url ?? null)
const orgName = computed(() => workshop.organization.value?.trade_name || workshop.organization.value?.name || 'AutoPro')
</script>

<template>
  <NuxtLink
    to="/app/"
    class="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-elevated"
  >
    <img
      v-if="orgLogoUrl"
      :src="orgLogoUrl"
      :alt="orgName"
      class="h-7 w-7 rounded object-contain shrink-0"
    >
    <AppLogo v-else size="sm" />
    <span
      v-if="!collapsed && orgLogoUrl"
      class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted"
    >
      {{ orgName }}
    </span>
  </NuxtLink>
</template>
