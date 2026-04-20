<script setup lang="ts">
type RoleItem = {
  id: string
  name: string
  display_name: string | null
  description: string | null
  is_system_role: boolean
}

type ActionItem = {
  id: string
  code: string
  name: string | null
  description: string | null
  resource: string | null
}

type RoleAction = {
  id: string
  role_id: string
  action_id: string
  is_granted: boolean
}

type AssignedUser = {
  id: string
  email: string | null
  full_name: string | null
  display_name: string | null
  employee_id: string | null
  employee_name: string | null
  active: boolean
}

type RoleDetailResponse = {
  item?: {
    role: RoleItem
    actions: ActionItem[]
    role_actions: RoleAction[]
    assigned_users: AssignedUser[]
    summary: {
      granted_actions_count: number
      total_actions_count: number
      assigned_users_count: number
    }
  }
}

type PermissionTab = {
  label: string
  value: string
  count: number
  icon: string
}

const props = defineProps<{
  open: boolean
  roleId: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const loading = ref(false)
const detail = ref<RoleDetailResponse['item'] | null>(null)
const activePermissionTab = ref('')

const grantedGroupedActions = computed<Record<string, ActionItem[]>>(() => {
  if (!detail.value)
    return {}

  const grantedIds = new Set(detail.value.role_actions
    .filter(roleAction => roleAction.is_granted)
    .map(roleAction => roleAction.action_id))

  return detail.value.actions.reduce<Record<string, ActionItem[]>>((groups, action) => {
    if (!grantedIds.has(action.id))
      return groups

    const groupName = action.resource || 'Geral'
    if (!groups[groupName])
      groups[groupName] = []

    groups[groupName].push(action)
    return groups
  }, {})
})

function roleLabel(role: RoleItem | null) {
  if (!role)
    return 'Detalhes do papel'

  return role.display_name?.trim() || role.name
}

function normalizeResourceKey(resource: string | null | undefined) {
  return String(resource || 'geral')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getResourceIcon(resource: string | null | undefined) {
  const key = normalizeResourceKey(resource)

  if (key.includes('appointment') || key.includes('agenda'))
    return 'i-lucide-calendar-days'
  if (key.includes('authorization'))
    return 'i-lucide-badge-check'
  if (key.includes('bank_account') || key.includes('bank'))
    return 'i-lucide-landmark'
  if (key.includes('client') || key.includes('customer'))
    return 'i-lucide-users'
  if (key.includes('consult'))
    return 'i-lucide-stethoscope'
  if (key.includes('employee') || key.includes('team'))
    return 'i-lucide-users-round'
  if (key.includes('financial') || key.includes('billing'))
    return 'i-lucide-badge-dollar-sign'
  if (key.includes('inventory') || key.includes('product') || key.includes('part'))
    return 'i-lucide-package'
  if (key.includes('notification'))
    return 'i-lucide-bell'
  if (key.includes('order') || key.includes('service'))
    return 'i-lucide-clipboard-list'
  if (key.includes('purchase'))
    return 'i-lucide-shopping-cart'
  if (key.includes('report'))
    return 'i-lucide-bar-chart-3'
  if (key.includes('role') || key.includes('permission'))
    return 'i-lucide-shield-check'
  if (key.includes('setting'))
    return 'i-lucide-settings-2'
  if (key.includes('supplier'))
    return 'i-lucide-truck'
  if (key.includes('tax'))
    return 'i-lucide-percent'
  if (key.includes('vehicle'))
    return 'i-lucide-car-front'

  return 'i-lucide-folder'
}

function formatResourceLabel(resource: string | null | undefined) {
  const key = normalizeResourceKey(resource)

  if (!key || key === 'geral' || key === 'general')
    return 'Geral'
  if (key.includes('appointment') || key.includes('agenda'))
    return 'Agendamentos'
  if (key.includes('authorization'))
    return 'Autorizações'
  if (key.includes('bank_account') || key.includes('bank'))
    return 'Contas bancárias'
  if (key.includes('client') || key.includes('customer'))
    return 'Clientes'
  if (key.includes('consult'))
    return 'Consultas'
  if (key.includes('employee') || key.includes('team'))
    return 'Funcionários'
  if (key.includes('financial') || key.includes('billing'))
    return 'Financeiro'
  if (key.includes('inventory'))
    return 'Estoque'
  if (key.includes('product'))
    return 'Produtos'
  if (key.includes('part'))
    return 'Peças'
  if (key.includes('notification'))
    return 'Notificações'
  if (key.includes('service_order') || key.includes('order') || key.includes('service'))
    return 'Ordens de serviço'
  if (key.includes('purchase'))
    return 'Compras'
  if (key.includes('report'))
    return 'Relatórios'
  if (key.includes('permission'))
    return 'Permissões'
  if (key.includes('role'))
    return 'Papéis'
  if (key.includes('setting'))
    return 'Configurações'
  if (key.includes('supplier'))
    return 'Fornecedores'
  if (key.includes('tax'))
    return 'Impostos'
  if (key.includes('vehicle'))
    return 'Veículos'
  if (key.includes('user'))
    return 'Usuários'

  return 'Outros'
}

function userLabel(user: AssignedUser) {
  return user.display_name?.trim() || user.full_name?.trim() || user.email || 'Usuário sem identificação'
}

function userInitials(user: AssignedUser) {
  const parts = userLabel(user)
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  return parts.map(part => part[0]?.toUpperCase() || '').join('') || 'U'
}

async function loadRoleDetail() {
  if (!props.open || !props.roleId)
    return

  loading.value = true

  try {
    const response = await $fetch<RoleDetailResponse>(`/api/roles/${props.roleId}`)
    detail.value = response.item ?? null
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

function onClose() {
  emit('update:open', false)
}

watch(() => [props.open, props.roleId], loadRoleDetail, { immediate: true })

const permissionTabs = computed<PermissionTab[]>(() =>
  Object.entries(grantedGroupedActions.value).map(([resource, actions]) => ({
    label: formatResourceLabel(resource),
    value: resource,
    count: actions.length,
    icon: getResourceIcon(resource)
  }))
)

const activeTabActions = computed(() => {
  if (!activePermissionTab.value)
    return []

  return grantedGroupedActions.value[activePermissionTab.value] ?? []
})

watch(permissionTabs, (tabs) => {
  if (!tabs.length) {
    activePermissionTab.value = ''
    return
  }

  if (!tabs.some(tab => tab.value === activePermissionTab.value))
    activePermissionTab.value = tabs[0]!.value
}, { immediate: true })
</script>

<template>
  <USlideover :open="props.open" :title="roleLabel(detail?.role ?? null)" @update:open="onClose">
    <template #body>
      <div v-if="loading" class="space-y-4 p-4">
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="h-32 w-full rounded-2xl" />
        <USkeleton class="h-52 w-full rounded-2xl" />
      </div>

      <div v-else-if="detail" class="space-y-6">
        <div class="rounded-2xl border border-default/70 bg-elevated/20 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <UIcon name="i-lucide-shield-check" class="size-5" />
                </div>
                <h3 class="text-lg font-semibold text-highlighted">
                  {{ roleLabel(detail.role) }}
                </h3>
                <UBadge
                  :label="detail.role.is_system_role ? 'Sistema' : 'Personalizado'"
                  :color="detail.role.is_system_role ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="xs"
                />
              </div>

              <p class="text-sm text-muted">
                {{ detail.role.description || 'Sem descrição cadastrada para este papel.' }}
              </p>
            </div>

            <div class="grid min-w-55 gap-2 sm:grid-cols-3">
              <div class="rounded-xl border border-default/70 bg-default/40 px-3 py-2">
                <UIcon name="i-lucide-users" class="mb-2 size-4 text-primary/80" />
                <p class="text-xs text-muted">
                  Usuários vinculados
                </p>
                <p class="text-lg font-semibold text-highlighted">
                  {{ detail.summary.assigned_users_count }}
                </p>
              </div>
              <div class="rounded-xl border border-default/70 bg-default/40 px-3 py-2">
                <UIcon name="i-lucide-badge-check" class="mb-2 size-4 text-success" />
                <p class="text-xs text-muted">
                  Permissões liberadas
                </p>
                <p class="text-lg font-semibold text-highlighted">
                  {{ detail.summary.granted_actions_count }}
                </p>
              </div>
              <div class="rounded-xl border border-default/70 bg-default/40 px-3 py-2">
                <UIcon name="i-lucide-grid-2x2" class="mb-2 size-4 text-primary/80" />
                <p class="text-xs text-muted">
                  Total de ações
                </p>
                <p class="text-lg font-semibold text-highlighted">
                  {{ detail.summary.total_actions_count }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted">
              <UIcon name="i-lucide-users-round" class="size-4" />
              <h4>Usuários com este papel</h4>
            </div>
          </div>

          <div v-if="detail.assigned_users.length" class="space-y-2">
            <div
              v-for="user in detail.assigned_users"
              :key="user.id"
              class="flex items-start gap-3 rounded-xl border border-default/70 px-3 py-3"
            >
              <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {{ userInitials(user) }}
              </div>

              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-highlighted">
                    {{ userLabel(user) }}
                  </p>
                  <UBadge
                    :label="user.active ? 'Ativo' : 'Inativo'"
                    :color="user.active ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  />
                </div>

                <p v-if="user.email" class="text-xs text-muted">
                  {{ user.email }}
                </p>

                <p v-if="user.employee_name" class="text-xs text-muted">
                  Funcionário vinculado: {{ user.employee_name }}
                </p>
              </div>
            </div>
          </div>

          <div v-else class="rounded-xl border border-dashed border-default px-4 py-8 text-center">
            <UIcon name="i-lucide-users" class="mx-auto mb-2 size-8 text-muted" />
            <p class="text-sm font-medium text-highlighted">
              Nenhum usuário com este papel
            </p>
            <p class="mt-1 text-sm text-muted">
              Assim que um usuário for vinculado a este papel, ele aparecerá aqui.
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted">
            <UIcon name="i-lucide-sparkles" class="size-4" />
            <h4>O que este papel pode fazer</h4>
          </div>

          <div v-if="Object.keys(grantedGroupedActions).length" class="space-y-4">
            <div class="rounded-2xl border border-default/70 bg-default/20 p-2">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tab in permissionTabs"
                  :key="tab.value"
                  type="button"
                  class="inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors"
                  :class="activePermissionTab === tab.value
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-default bg-default/60 text-muted hover:bg-elevated'"
                  @click="activePermissionTab = tab.value"
                >
                  <UIcon :name="tab.icon" class="size-4 shrink-0" />
                  <span class="break-all">
                    {{ tab.label }}
                  </span>
                  <span class="rounded-full bg-black/8 px-1.5 py-0.5 text-[11px] font-semibold leading-none">
                    {{ tab.count }}
                  </span>
                </button>
              </div>
            </div>

            <div class="rounded-xl border border-default/70">
              <div class="divide-y divide-default/60">
                <div
                  v-for="action in activeTabActions"
                  :key="action.id"
                  class="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div class="flex min-w-0 items-start gap-3">
                    <div class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <UIcon :name="getResourceIcon(action.resource || activePermissionTab)" class="size-4" />
                    </div>

                    <div class="min-w-0">
                      <p class="text-sm font-medium text-highlighted">
                        {{ action.name || action.code }}
                      </p>
                      <p v-if="action.description" class="text-xs text-muted">
                        {{ action.description }}
                      </p>
                      <p v-else class="text-xs text-muted">
                        Código: {{ action.code }}
                      </p>
                    </div>
                  </div>

                  <UBadge
                    label="Permitido"
                    color="success"
                    variant="subtle"
                    size="xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-else class="rounded-xl border border-dashed border-default px-4 py-8 text-center">
            <UIcon name="i-lucide-ban" class="mx-auto mb-2 size-8 text-muted" />
            <p class="text-sm font-medium text-highlighted">
              Nenhuma permissão liberada
            </p>
            <p class="mt-1 text-sm text-muted">
              Este papel ainda não possui ações marcadas como permitidas.
            </p>
          </div>
        </div>
      </div>

      <div v-else class="p-4">
        <div class="rounded-xl border border-error/30 bg-error/10 p-4">
          <p class="text-sm font-medium text-error">
            Não foi possível carregar os detalhes do papel.
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
