<script setup lang="ts">
interface Series {
  name: string
  data: number[]
}

const props = defineProps<{
  categories: string[]
  series: Series[]
  height?: number
  colors?: string[]
  stacked?: boolean
  formatValue?: (v: number) => string
  columnWidth?: string
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const defaultColors = ['#22c55e', '#f87171', '#3b82f6', '#a78bfa', '#fb923c', '#facc15']

function fmt(v: number) {
  return props.formatValue ? props.formatValue(v) : v.toLocaleString('pt-BR')
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(Math.round(v))
}

const chartOptions = computed(() => ({
  chart: {
    type: 'bar',
    stacked: props.stacked ?? false,
    toolbar: { show: false },
    fontFamily: 'inherit',
    background: 'transparent',
    animations: { enabled: true, speed: 300, animateGradually: { enabled: false } },
    dropShadow: { enabled: false }
  },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: props.colors ?? defaultColors,
  plotOptions: {
    bar: {
      columnWidth: props.columnWidth ?? (props.series.length > 1 ? '72%' : '45%'),
      borderRadius: 3,
      borderRadiusApplication: 'end'
    }
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories: props.categories,
    labels: {
      style: { fontSize: '11px', fontFamily: 'inherit', colors: isDark.value ? '#9ca3af' : '#6b7280' },
      rotate: props.categories.length > 16 ? -45 : 0
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    labels: {
      formatter: fmtShort,
      style: { fontSize: '11px', fontFamily: 'inherit', colors: isDark.value ? '#9ca3af' : '#6b7280' }
    }
  },
  grid: {
    borderColor: isDark.value ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
    padding: { left: 0, right: 8 }
  },
  tooltip: {
    theme: isDark.value ? 'dark' : 'light',
    y: { formatter: fmt }
  },
  legend: {
    show: props.series.length > 1,
    position: 'top',
    horizontalAlign: 'right',
    fontSize: '12px',
    fontFamily: 'inherit',
    labels: { colors: isDark.value ? '#d1d5db' : '#374151' },
    markers: { size: 8, shape: 'square', offsetY: 0 },
    itemMargin: { horizontal: 10 }
  }
}))
</script>

<template>
  <ClientOnly>
    <ApexChart
      type="bar"
      :height="height ?? 220"
      :options="chartOptions"
      :series="series"
      class="w-full"
    />
    <template #fallback>
      <div
        class="animate-pulse bg-elevated rounded-xl w-full"
        :style="`height: ${height ?? 220}px`"
      />
    </template>
  </ClientOnly>
</template>
