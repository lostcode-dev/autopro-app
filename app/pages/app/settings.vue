<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Configuracoes'
})

const workshop = useWorkshopPermissions()

const links = computed<NavigationMenuItem[][]>(() => [[
  {
    label: 'Conta',
    icon: 'i-lucide-settings',
    to: '/app/settings',
    exact: true
  },
  {
    label: 'Perfil',
    icon: 'i-lucide-user',
    to: '/app/settings/profile'
  },
  workshop.can('settings.view')
    ? {
        label: 'Empresa',
        icon: 'i-lucide-building-2',
        to: '/app/settings/company'
      }
    : null,
  workshop.can('employees.read')
    ? {
        label: 'Funcionarios',
        icon: 'i-lucide-users-round',
        to: '/app/settings/employees'
      }
    : null,
  workshop.can('roles.view')
    ? {
        label: 'Permissoes',
        icon: 'i-lucide-shield-check',
        to: '/app/settings/roles'
      }
    : null,
  {
    label: 'Assinatura',
    icon: 'i-lucide-credit-card',
    to: '/app/settings/subscription'
  },
  {
    label: 'Notificacoes',
    icon: 'i-lucide-bell',
    to: '/app/settings/notifications'
  },
  {
    label: 'Seguranca',
    icon: 'i-lucide-shield',
    to: '/app/settings/security'
  }
].filter(Boolean) as NavigationMenuItem[]])
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Configuracoes">
        <template #leading>
          <AppSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
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
