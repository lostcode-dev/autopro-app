<script setup lang="ts">
import type { Appointment } from '~/types/appointments'

const props = defineProps<{
  appointment: Appointment
  view: 'month' | 'week' | 'day'
}>()

const bgColor = computed(() => {
  const map: Record<string, string> = {
    scheduled: 'bg-info/20 text-info border border-info/30',
    confirmed: 'bg-success/20 text-success border border-success/30',
    completed: 'bg-neutral/20 text-highlighted border border-default',
    cancelled: 'bg-error/20 text-error border border-error/30',
  }
  return map[props.appointment.status] ?? map.scheduled
})
</script>

<template>
  <!-- Month: compact horizontal pill -->
  <div
    v-if="view === 'month'"
    class="flex cursor-pointer items-center gap-1 truncate rounded px-1 py-0.5 text-xs transition-opacity hover:opacity-80"
    :class="[bgColor, appointment.status === 'cancelled' ? 'opacity-60 line-through' : '']"
  >
    <span class="shrink-0 font-mono text-[10px]">{{ appointment.time }}</span>
    <span class="truncate">{{ appointment.service_type ?? '—' }}</span>
  </div>

  <!-- Week / Day: vertical card with more detail -->
  <div
    v-else
    class="flex h-full cursor-pointer flex-col justify-start overflow-hidden rounded px-1.5 py-1 text-xs transition-opacity hover:opacity-90"
    :class="[bgColor, appointment.status === 'cancelled' ? 'opacity-60 line-through' : '']"
  >
    <span class="truncate font-semibold leading-tight">{{ appointment.service_type ?? '—' }}</span>
    <span class="truncate opacity-80 leading-tight">{{ appointment.clients?.name ?? '—' }}</span>
    <span v-if="view === 'day'" class="truncate opacity-60 leading-tight text-[10px]">
      {{ appointment.vehicles
        ? [appointment.vehicles.brand, appointment.vehicles.model, appointment.vehicles.license_plate].filter(Boolean).join(' ')
        : '—' }}
    </span>
    <span class="truncate opacity-60 leading-tight font-mono text-[10px]">{{ appointment.time }}</span>
  </div>
</template>
