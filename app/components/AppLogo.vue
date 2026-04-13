<script setup lang="ts">
withDefaults(defineProps<{
  showLabel?: boolean
  size?: 'sm' | 'md'
}>(), {
  showLabel: true,
  size: 'md'
})
</script>

<template>
  <img
    src="/images/beenk-logo.png"
    alt="beenk"
    :class="size === 'sm' ? 'h-7 w-auto object-contain' : 'h-8 w-auto object-contain'"
  >
</template>
