<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()

const open = ref(false)

const links = [[{
  label: 'Visão geral',
  icon: 'i-lucide-house',
  to: '/app',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Caixa de entrada',
  icon: 'i-lucide-inbox',
  to: '/app/inbox',
  badge: '4',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Notas',
  icon: 'i-lucide-notebook-pen',
  to: '/app/customers',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Configurações',
  to: '/app/settings',
  icon: 'i-lucide-settings',
  defaultOpen: true,
  type: 'trigger',
  children: [{
    label: 'Geral',
    to: '/app/settings',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Faturamento',
    to: '/app/settings/billing',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Membros',
    to: '/app/settings/members',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Notificações',
    to: '/app/settings/notifications',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Segurança',
    to: '/app/settings/security',
    onSelect: () => {
      open.value = false
    }
  }]
}], [{
  label: 'Enviar feedback',
  icon: 'i-lucide-message-circle',
  to: '/docs/getting-started'
}, {
  label: 'Ajuda',
  icon: 'i-lucide-info',
  to: '/docs'
}]] satisfies NavigationMenuItem[][]

const groups = computed(() => [{
  id: 'links',
  label: 'Ir para',
  items: links.flat()
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'Usamos cookies essenciais para melhorar sua experiência no Second Brain.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Aceitar',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Recusar',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
