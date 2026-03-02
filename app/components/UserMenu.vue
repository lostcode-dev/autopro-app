<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useAuth } from '~/composables/useAuth';

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const appConfig = useAppConfig()
const toast = useToast()
const auth = useAuth()
const router = useRouter()

const colors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const neutrals = ['slate', 'gray', 'zinc', 'neutral', 'stone']

const user = computed(() => {
  const name = (auth.user.value?.user_metadata as any)?.name || auth.user.value?.email || 'Conta'

  return {
    name,
    avatar: {
      src: (auth.user.value?.user_metadata as any)?.avatar_url || 'https://github.com/benjamincanac.png',
      alt: String(name)
    }
  }
})

const items = computed<DropdownMenuItem[][]>(() => ([[{
  type: 'label',
  label: user.value.name,
  avatar: user.value.avatar
}], [{
  label: 'Perfil',
  icon: 'i-lucide-user'
}, {
  label: 'Assinatura',
  icon: 'i-lucide-credit-card',
  async onSelect(e) {
    e.preventDefault()

    try {
      const { url } = await $fetch<{ url: string }>('/api/billing/portal', { method: 'POST' })
      await navigateTo(url, { external: true })
    }
    catch (error: any) {
      const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível abrir o portal'
      toast.add({ title: 'Erro', description: message, color: 'error' })
    }
  }
}, {
  label: 'Configurações',
  icon: 'i-lucide-settings',
  to: '/settings'
}], [{
  label: 'Tema',
  icon: 'i-lucide-palette',
  children: [{
    label: 'Primária',
    slot: 'chip',
    chip: appConfig.ui.colors.primary,
    content: {
      align: 'center',
      collisionPadding: 16
    },
    children: colors.map(color => ({
      label: color,
      chip: color,
      slot: 'chip',
      checked: appConfig.ui.colors.primary === color,
      type: 'checkbox',
      onSelect: (e) => {
        e.preventDefault()

        appConfig.ui.colors.primary = color
      }
    }))
  }, {
    label: 'Neutra',
    slot: 'chip',
    chip: appConfig.ui.colors.neutral === 'neutral' ? 'old-neutral' : appConfig.ui.colors.neutral,
    content: {
      align: 'end',
      collisionPadding: 16
    },
    children: neutrals.map(color => ({
      label: color,
      chip: color === 'neutral' ? 'old-neutral' : color,
      slot: 'chip',
      type: 'checkbox',
      checked: appConfig.ui.colors.neutral === color,
      onSelect: (e) => {
        e.preventDefault()

        appConfig.ui.colors.neutral = color
      }
    }))
  }]
}, {
  label: 'Aparência',
  icon: 'i-lucide-sun-moon',
  children: [{
    label: 'Claro',
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.value === 'light',
    onSelect(e: Event) {
      e.preventDefault()

      colorMode.preference = 'light'
    }
  }, {
    label: 'Escuro',
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.value === 'dark',
    onUpdateChecked(checked: boolean) {
      if (checked) {
        colorMode.preference = 'dark'
      }
    },
    onSelect(e: Event) {
      e.preventDefault()
    }
  }]
}], [{
  label: 'Documentação',
  icon: 'i-lucide-book-open',
  to: '/docs/getting-started'
}, {
  label: 'Sair',
  icon: 'i-lucide-log-out',
  async onSelect(e) {
    e.preventDefault()

    try {
      await auth.logout()
      toast.add({ title: 'Sessão encerrada', color: 'success' })
      await router.push('/login')
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível sair', color: 'error' })
    }
  }
}]]))
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        ...user,
        label: collapsed ? undefined : user?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />

    <template #chip-leading="{ item }">
      <div class="inline-flex items-center justify-center shrink-0 size-5">
        <span
          class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>
