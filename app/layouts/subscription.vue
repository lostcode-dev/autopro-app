<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useWorkshopBootstrap } from '~/composables/useWorkshopBootstrap'

const auth = useAuth()
const bootstrap = useWorkshopBootstrap()
const router = useRouter()
const toast = useToast()

const user = computed(() => {
  const meta = auth.user.value?.user_metadata as Record<string, string> | undefined
  return {
    name: meta?.name || auth.user.value?.email || 'Conta',
    email: auth.user.value?.email || '',
    avatar: {
      src: meta?.avatar_url,
      alt: meta?.name || auth.user.value?.email || 'Conta'
    }
  }
})

async function handleLogout() {
  try {
    bootstrap.clear()
    await auth.logout()
    toast.add({ title: 'Sessão encerrada', color: 'success' })
    await router.push('/login')
  } catch {
    toast.add({ title: 'Erro', description: 'Não foi possível sair', color: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default">
    <!-- ─── Header — igual ao AppHeader mas para usuário autenticado ───── -->
    <UHeader>
      <template #left>
        <NuxtLink to="/" aria-label="beenk" class="flex items-center">
          <AppLogo />
        </NuxtLink>
      </template>

      <template #right>
        <UDropdownMenu
          :items="[[{
            type: 'label',
            label: user.name,
            avatar: user.avatar
          }], [{
            label: 'Sair',
            icon: 'i-lucide-log-out',
            onSelect: handleLogout
          }]]"
          :content="{ align: 'end', collisionPadding: 12 }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-down"
            v-bind="{ avatar: user.avatar }"
          >
            <span class="hidden sm:inline max-w-40 truncate">{{ user.name }}</span>
          </UButton>
        </UDropdownMenu>
      </template>
    </UHeader>

    <!-- ─── Conteúdo ────────────────────────────────────────────────────── -->
    <main class="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div class="w-full max-w-3xl">
        <slot />
      </div>
    </main>

    <!-- ─── Rodapé ───────────────────────────────────────────────────────── -->
    <UFooter>
      <template #left>
        <p class="text-muted text-sm">
          © {{ new Date().getFullYear() }} beenk. Todos os direitos reservados.
        </p>
      </template>
    </UFooter>
  </div>
</template>
