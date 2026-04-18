<script setup lang="ts">
interface Bar {
  key: string
  label: string
  color: string
}

const props = defineProps<{
  data: ({ name: string } & Record<string, any>)[]
  bars: Bar[]
  height?: number
  formatValue?: (v: number) => string
}>()

const chartH = computed(() => (props.height ?? 180) - 36)

const maxVal = computed(() => {
  let m = 0
  for (const d of props.data)
    for (const b of props.bars) {
      const v = Number(d[b.key] ?? 0)
      if (v > m) m = v
    }
  return m || 1
})

function pct(d: Record<string, any>, key: string) {
  const v = Number(d[key] ?? 0)
  if (v <= 0) return 0
  return Math.max(2, Math.round((v / maxVal.value) * 100))
}

function tip(d: Record<string, any>, b: Bar) {
  const v = Number(d[b.key] ?? 0)
  const formatted = props.formatValue ? props.formatValue(v) : v.toString()
  return `${b.label}: ${formatted}`
}
</script>

<template>
  <div v-if="!data.length" class="flex items-center justify-center text-muted text-sm" :style="`height: ${height ?? 180}px`">
    Sem dados para o período
  </div>
  <div v-else class="w-full min-w-0 overflow-hidden space-y-1">
    <div class="flex items-end gap-px overflow-hidden" :style="`height: ${chartH}px`">
      <div
        v-for="d in data"
        :key="d.name"
        class="h-full flex-1 flex items-end gap-px min-w-0"
      >
        <div
          v-for="b in bars"
          :key="b.key"
          class="flex-1 rounded-t transition-all duration-200 cursor-default"
          :style="{ height: pct(d, b.key) + '%', background: b.color }"
          :title="tip(d, b)"
        />
      </div>
    </div>
    <div class="flex gap-px min-w-0 overflow-hidden">
      <span
        v-for="(d, i) in data"
        :key="d.name"
        class="flex-1 truncate text-center leading-tight"
        :class="data.length > 14 && i % 5 !== 0 ? 'text-transparent' : 'text-[9px] text-muted/60'"
      >{{ d.name }}</span>
    </div>
    <div class="flex gap-4 text-xs text-muted justify-end pt-1">
      <div v-for="b in bars" :key="b.key" class="flex items-center gap-1.5">
        <span class="inline-block w-2.5 h-2.5 rounded-sm" :style="{ background: b.color }" />
        {{ b.label }}
      </div>
    </div>
  </div>
</template>
