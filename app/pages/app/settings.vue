<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

definePageMeta({
  layout: "app",
});

useSeoMeta({
  title: "Configurações",
});

const links = [
  [
    {
      label: "Geral",
      icon: "i-lucide-user",
      to: "/app/settings",
      exact: true,
    },
    {
      label: "Assinatura",
      icon: "i-lucide-credit-card",
      to: "/app/settings/subscription",
    },
    {
      label: "Notificações",
      icon: "i-lucide-bell",
      to: "/app/settings/notifications",
    },
    {
      label: "Segurança",
      icon: "i-lucide-shield",
      to: "/app/settings/security",
    },
  ],
] satisfies NavigationMenuItem[][];
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Configurações">
        <template #leading>
          <AppSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div
        class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto"
      >
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
