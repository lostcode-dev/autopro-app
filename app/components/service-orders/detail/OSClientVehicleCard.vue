<script setup lang="ts">
import type { ServiceOrderDetailFull } from '~/types/service-orders'
import { formatPhone } from '~/utils/service-orders'

defineProps<{
  client: ServiceOrderDetailFull['client']
  vehicle: ServiceOrderDetailFull['vehicle']
}>()
</script>

<template>
  <div class="space-y-4">
    <!-- Client -->
    <UCard variant="subtle">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-user" class="size-4 text-primary" />
          <h3 class="font-semibold text-highlighted">
            Cliente
          </h3>
        </div>
      </template>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3 sm:col-span-2">
          <UIcon name="i-lucide-id-card" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Nome
            </dt>
            <dd class="font-medium text-highlighted break-words">
              {{ client?.name ?? '—' }}
            </dd>
          </div>
        </div>
        <div v-if="client?.phone || client?.mobile_phone" class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3">
          <UIcon name="i-lucide-phone" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Telefone
            </dt>
            <dd>{{ formatPhone(client.phone ?? client.mobile_phone) }}</dd>
          </div>
        </div>
        <div v-if="client?.email" class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3">
          <UIcon name="i-lucide-mail" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              E-mail
            </dt>
            <dd class="break-all">
              {{ client.email }}
            </dd>
          </div>
        </div>
      </dl>
    </UCard>

    <!-- Vehicle -->
    <UCard v-if="vehicle" variant="subtle">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-car" class="size-4 text-primary" />
          <h3 class="font-semibold text-highlighted">
            Veículo
          </h3>
        </div>
      </template>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3 sm:col-span-2">
          <UIcon name="i-lucide-car-front" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Modelo
            </dt>
            <dd class="font-medium text-highlighted break-words">
              {{ [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '—' }}
            </dd>
          </div>
        </div>
        <div class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3">
          <UIcon name="i-lucide-id-card" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Placa
            </dt>
            <dd>{{ vehicle.license_plate ?? '—' }}</dd>
          </div>
        </div>
        <div v-if="vehicle.year" class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3">
          <UIcon name="i-lucide-calendar-days" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Ano
            </dt>
            <dd>{{ vehicle.year }}</dd>
          </div>
        </div>
        <div v-if="vehicle.color" class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3">
          <UIcon name="i-lucide-palette" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Cor
            </dt>
            <dd class="capitalize">
              {{ vehicle.color }}
            </dd>
          </div>
        </div>
        <div v-if="vehicle.fuel_type" class="flex items-start gap-3 rounded-xl bg-elevated/70 p-3">
          <UIcon name="i-lucide-fuel" class="mt-0.5 size-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <dt class="text-xs uppercase tracking-wide text-muted">
              Combustível
            </dt>
            <dd class="capitalize">
              {{ vehicle.fuel_type }}
            </dd>
          </div>
        </div>
      </dl>
    </UCard>
  </div>
</template>
