<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

const route = useRoute()
const router = useRouter()
const workshop = useWorkshopPermissions()

const items = computed(() => [
  { label: 'Inicio', icon: 'i-lucide-house', to: '/app/dashboard' },
  workshop.can(ActionCode.ORDERS_READ) ? { label: 'OS', icon: 'i-lucide-clipboard-list', to: '/app/service-orders' } : null,
  workshop.can(ActionCode.APPOINTMENTS_READ) ? { label: 'Agenda', icon: 'i-lucide-calendar-days', to: '/app/appointments' } : null,
  workshop.can(ActionCode.FINANCIAL_READ) ? { label: 'Financeiro', icon: 'i-lucide-wallet', to: '/app/financial' } : null,
  { label: 'Mais', icon: 'i-lucide-menu', to: '' }
].filter(Boolean) as Array<{ label: string, icon: string, to: string }>)

const showMoreMenu = ref(false)

const moreItems = computed(() => [
  workshop.can(ActionCode.CUSTOMERS_READ) ? { label: 'Clientes', icon: 'i-lucide-users', to: '/app/customers' } : null,
  workshop.can(ActionCode.VEHICLES_READ) ? { label: 'Veiculos', icon: 'i-lucide-car-front', to: '/app/vehicles' } : null,
  workshop.can(ActionCode.PRODUCTS_READ) ? { label: 'Produtos', icon: 'i-lucide-package', to: '/app/products' } : null,
  workshop.can(ActionCode.INVENTORY_READ) ? { label: 'Estoque', icon: 'i-lucide-box', to: '/app/inventory' } : null,
  workshop.can(ActionCode.REPORTS_VIEW) ? { label: 'Relatorios', icon: 'i-lucide-bar-chart-3', to: '/app/reports' } : null,
  { label: 'Configuracoes', icon: 'i-lucide-settings', to: '/app/settings' }
].filter(Boolean) as Array<{ label: string, icon: string, to: string }>)

function isActive(to: string): boolean {
  if (!to) return false
  if (to === '/app/dashboard') return route.path === '/app' || route.path === '/app/dashboard'
  return route.path.startsWith(to)
}

function isMoreActive(): boolean {
  return moreItems.value.some(item => route.path.startsWith(item.to))
}

function handleMoreClick() {
  showMoreMenu.value = !showMoreMenu.value
}

function navigateToPage(to: string) {
  showMoreMenu.value = false
  if (to) {
    router.push(to)
  }
}
</script>

<template>
  <div class="mobile-bottom-nav lg:hidden">
    <Transition name="slide-up">
      <div
        v-if="showMoreMenu"
        class="absolute bottom-full left-0 right-0 bg-elevated border-t border-default shadow-lg"
      >
        <div class="grid grid-cols-3 gap-1 p-3">
          <button
            v-for="item in moreItems"
            :key="item.to"
            class="flex flex-col items-center gap-1.5 rounded-lg p-3 transition-colors"
            :class="isActive(item.to) ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-muted/50'"
            @click="navigateToPage(item.to)"
          >
            <UIcon :name="item.icon" class="size-5" />
            <span class="text-xs font-medium">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showMoreMenu"
          class="fixed inset-0 z-40 bg-black/30 lg:hidden"
          @click="showMoreMenu = false"
        />
      </Transition>
    </Teleport>

    <nav class="flex items-center justify-around px-2 py-1.5">
      <template v-for="item in items" :key="item.label">
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors"
          :class="isActive(item.to) ? 'text-primary' : 'text-muted'"
          @click="showMoreMenu = false"
        >
          <UIcon :name="item.icon" class="size-5" />
          <span class="text-[10px] font-medium leading-tight">{{ item.label }}</span>
        </NuxtLink>

        <button
          v-else
          class="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors"
          :class="isMoreActive() || showMoreMenu ? 'text-primary' : 'text-muted'"
          @click="handleMoreClick"
        >
          <UIcon :name="item.icon" class="size-5" />
          <span class="text-[10px] font-medium leading-tight">{{ item.label }}</span>
        </button>
      </template>
    </nav>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
