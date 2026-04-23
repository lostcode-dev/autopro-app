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
      <dl class="space-y-2 text-sm">
        <div>
          <dt class="text-muted">
            Nome
          </dt>
          <dd class="font-medium text-highlighted">
            {{ client?.name ?? '—' }}
          </dd>
        </div>
        <div v-if="client?.phone || client?.mobile_phone">
          <dt class="text-muted">
            Telefone
          </dt>
          <dd>{{ formatPhone(client.phone ?? client.mobile_phone) }}</dd>
        </div>
        <div v-if="client?.email">
          <dt class="text-muted">
            E-mail
          </dt>
          <dd>{{ client.email }}</dd>
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
      <dl class="space-y-2 text-sm">
        <div>
          <dt class="text-muted">
            Modelo
          </dt>
          <dd class="font-medium text-highlighted">
            {{ [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Placa
          </dt>
          <dd>{{ vehicle.license_plate ?? '—' }}</dd>
        </div>
        <div v-if="vehicle.year">
          <dt class="text-muted">
            Ano
          </dt>
          <dd>{{ vehicle.year }}</dd>
        </div>
        <div v-if="vehicle.color">
          <dt class="text-muted">
            Cor
          </dt>
          <dd class="capitalize">
            {{ vehicle.color }}
          </dd>
        </div>
        <div v-if="vehicle.fuel_type">
          <dt class="text-muted">
            Combustível
          </dt>
          <dd class="capitalize">
            {{ vehicle.fuel_type }}
          </dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
