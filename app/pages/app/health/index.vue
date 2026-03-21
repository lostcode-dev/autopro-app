<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Health'
})
</script>

<template>
  <UDashboardPanel id="health">
    <template #header>
      <UDashboardNavbar title="Health">
        <template #leading>
          <AppSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full flex-1 flex-col items-center justify-center gap-4">
        <UIcon name="i-lucide-calendar-check" class="size-16 text-dimmed" />
        <div class="text-center">
          <p class="font-medium text-highlighted">
            Acompanhe sua saúde aqui
          </p>
          <p class="text-sm text-muted">
            Em breve: criação de registros de saúde, acompanhamento de hábitos relacionados à saúde e revisão semanal.
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
