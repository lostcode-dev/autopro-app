<script setup lang="ts">
const modelValue = defineModel<number | string>()

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function parseRaw(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  return digits ? Number(digits) / 100 : 0
}

const displayValue = ref('')

watch(
  () => modelValue.value,
  (v) => {
    const num = v === '' || v == null ? 0 : Number(v)
    displayValue.value = num > 0 ? formatNumber(num) : ''
  },
  { immediate: true }
)

function onUpdateModelValue(val: string) {
  const num = parseRaw(val ?? '')
  displayValue.value = num > 0 ? formatNumber(num) : ''
  modelValue.value = num > 0 ? num : ''
}
</script>

<template>
  <UInput
    :model-value="displayValue"
    inputmode="numeric"
    class="w-full"
    placeholder="0,00"
    @update:model-value="onUpdateModelValue"
  />
</template>
