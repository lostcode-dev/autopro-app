<script setup lang="ts">
definePageMeta({
  layout: 'app'
})
</script>

<template>
  <UDashboardPanel id="financial">
    <template #header>
      <UDashboardNavbar title="Financial">
        <template #leading>
          <UDashboardSidebarCollapse />
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
            Acompanhe suas finanças aqui
          </p>
          <p class="text-sm text-muted">
            Em breve: criação de orçamentos, acompanhamento de despesas e receitas, e análise financeira.
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
