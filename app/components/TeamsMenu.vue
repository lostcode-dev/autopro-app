<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <NuxtLink
    to="/app/"
    class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-elevated"
  >
    <AppLogo size="sm" />
  </NuxtLink>
</template>
