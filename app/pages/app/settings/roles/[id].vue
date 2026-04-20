<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Editar papel' })

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

const route = useRoute()
const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canView = computed(() => workshop.can(ActionCode.ROLES_VIEW))
const canUpdate = computed(() => workshop.can(ActionCode.ROLES_UPDATE))
const canManagePermissions = computed(() => workshop.can(ActionCode.ROLES_MANAGE_PERMISSIONS))
const canAccessEditPage = computed(() => canUpdate.value || canManagePermissions.value)
const roleId = computed(() => String(route.params.id || ''))

const { data, status, error, refresh } = await useAsyncData(
  () => `role-detail-${roleId.value}`,
  () => requestFetch<RoleDetailResponse>(`/api/roles/${roleId.value}`, { headers: requestHeaders }),
  {
    watch: [roleId],
    server: true
  }
)

const role = computed(() => data.value?.item?.role ?? null)
const actions = computed(() => data.value?.item?.actions ?? [])
const roleActions = computed(() => data.value?.item?.role_actions ?? [])
const assignedUsers = computed(() => data.value?.item?.assigned_users ?? [])
const summary = computed(() => data.value?.item?.summary ?? {
  granted_actions_count: 0,
  total_actions_count: 0,
  assigned_users_count: 0
})

const roleForm = reactive({
  display_name: '',
  description: ''
})

const permissionState = ref<Record<string, boolean>>({})
const isSaving = ref(false)

const groupedActions = computed<Record<string, ActionItem[]>>(() => {
  if (!actions.value.length)
    return {}

  return actions.value.reduce<Record<string, ActionItem[]>>((groups, action) => {
    const groupName = action.resource || 'Geral'
    if (!groups[groupName])
      groups[groupName] = []

    groups[groupName].push(action)
    return groups
  }, {})
})

const originalPermissionState = computed<Record<string, boolean>>(() => {
  const grantedIds = new Set(roleActions.value.filter(action => action.is_granted).map(action => action.action_id))

  return actions.value.reduce<Record<string, boolean>>((result, action) => {
    result[action.id] = grantedIds.has(action.id)
    return result
  }, {})
})

const canEditMetadata = computed(() => Boolean(role.value && canUpdate.value && !role.value.is_system_role))
const canEditPermissions = computed(() => Boolean(role.value && canManagePermissions.value && !role.value.is_system_role))
const hasMetadataChanges = computed(() => {
  if (!role.value)
    return false

  return roleForm.display_name.trim() !== (role.value.display_name ?? role.value.name)
    || roleForm.description.trim() !== (role.value.description ?? '')
})

const hasPermissionChanges = computed(() =>
  actions.value.some(action => Boolean(permissionState.value[action.id]) !== Boolean(originalPermissionState.value[action.id]))
)

const isSaveDisabled = computed(() => {
  if (isSaving.value || !role.value || role.value.is_system_role)
    return true

  if (!canEditMetadata.value && !canEditPermissions.value)
    return true

  if (canEditMetadata.value && !roleForm.display_name.trim())
    return true

  return !hasMetadataChanges.value && !hasPermissionChanges.value
})

function roleLabel(roleItem: RoleItem | null) {
  if (!roleItem)
    return 'Papel'

  return roleItem.display_name?.trim() || roleItem.name
}

function userLabel(user: AssignedUser) {
  return user.display_name?.trim() || user.full_name?.trim() || user.email || 'Usuario sem identificacao'
}

function syncForm() {
  if (!role.value)
    return

  roleForm.display_name = role.value.display_name ?? role.value.name
  roleForm.description = role.value.description ?? ''
  permissionState.value = { ...originalPermissionState.value }
}

function updatePermission(actionId: string, value: boolean | 'indeterminate') {
  permissionState.value = {
    ...permissionState.value,
    [actionId]: Boolean(value)
  }
}

async function saveRole() {
  if (isSaveDisabled.value || !role.value)
    return

  isSaving.value = true

  try {
    if (canEditMetadata.value && hasMetadataChanges.value) {
      await $fetch(`/api/roles/${role.value.id}`, {
        method: 'PUT',
        body: {
          display_name: roleForm.display_name.trim(),
          description: roleForm.description.trim() || null
        }
      })
    }

    if (canEditPermissions.value && hasPermissionChanges.value) {
      const changedActions = actions.value.filter(action =>
        Boolean(permissionState.value[action.id]) !== Boolean(originalPermissionState.value[action.id])
      )

      await Promise.all(changedActions.map(action => $fetch(`/api/roles/${role.value!.id}/actions`, {
        method: 'POST',
        body: {
          action_id: action.id,
          is_granted: Boolean(permissionState.value[action.id])
        }
      })))
    }

    toast.add({ title: 'Papel atualizado', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel salvar as alteracoes',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

watch([role, actions, roleActions], () => {
  syncForm()
}, { immediate: true })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Editar papel">
        <template #right>
          <UButton
            label="Voltar"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            to="/app/settings/roles"
          />
          <UButton
            label="Salvar alteracoes"
            color="neutral"
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="isSaveDisabled"
            @click="saveRole"
          />
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div v-if="!canView" class="p-4">
        <div class="rounded-xl border border-default/60 bg-elevated/30 p-6">
          <p class="text-sm text-muted">
            Voce nao tem permissao para visualizar papeis.
          </p>
        </div>
      </div>

      <div v-else-if="!canAccessEditPage" class="p-4">
        <div class="rounded-xl border border-default/60 bg-elevated/30 p-6">
          <p class="text-sm text-muted">
            Voce nao tem permissao para editar papeis ou gerenciar permissoes.
          </p>
        </div>
      </div>

      <div v-else class="space-y-4 p-4">
        <template v-if="status === 'pending' && !role">
          <USkeleton class="h-36 w-full rounded-2xl" />
          <USkeleton class="h-96 w-full rounded-2xl" />
        </template>

        <template v-else-if="error || !role">
          <div class="rounded-2xl border border-error/30 bg-error/10 p-6">
            <p class="text-sm font-medium text-error">
              Nao foi possivel carregar este papel.
            </p>
            <div class="mt-4 flex gap-2">
              <UButton label="Tentar novamente" color="neutral" @click="refresh" />
              <UButton label="Voltar para papeis" color="neutral" variant="ghost" to="/app/settings/roles" />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="overflow-hidden rounded-3xl border border-default bg-linear-to-br from-primary/10 via-elevated to-success/10">
            <div class="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
              <div class="space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="text-2xl font-semibold text-highlighted sm:text-3xl">
                    {{ roleLabel(role) }}
                  </h1>
                  <UBadge
                    :label="role.is_system_role ? 'Sistema' : 'Personalizado'"
                    :color="role.is_system_role ? 'warning' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  />
                </div>

                <p class="max-w-2xl text-sm text-muted">
                  Ajuste os dados principais do papel e marque, com checkbox, quais acoes ficam liberadas para esse perfil.
                </p>

                <div v-if="role.is_system_role" class="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-muted">
                  Este e um papel de sistema. Os dados e permissoes podem ser consultados, mas nao podem ser alterados.
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div class="rounded-2xl border border-default/70 bg-default/40 p-4">
                  <p class="text-xs uppercase tracking-widest text-muted">
                    Usuarios vinculados
                  </p>
                  <p class="mt-2 text-2xl font-semibold text-highlighted">
                    {{ summary.assigned_users_count }}
                  </p>
                </div>
                <div class="rounded-2xl border border-default/70 bg-default/40 p-4">
                  <p class="text-xs uppercase tracking-widest text-muted">
                    Permissoes liberadas
                  </p>
                  <p class="mt-2 text-2xl font-semibold text-highlighted">
                    {{ summary.granted_actions_count }}
                  </p>
                </div>
                <div class="rounded-2xl border border-default/70 bg-default/40 p-4">
                  <p class="text-xs uppercase tracking-widest text-muted">
                    Total de acoes
                  </p>
                  <p class="mt-2 text-2xl font-semibold text-highlighted">
                    {{ summary.total_actions_count }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <UPageCard title="Dados do papel" description="Atualize o nome exibido e a descricao usada pela equipe." variant="subtle">
              <div class="space-y-4">
                <UFormField label="Nome exibido" required>
                  <UInput
                    v-model="roleForm.display_name"
                    class="w-full"
                    :disabled="!canEditMetadata"
                    placeholder="Ex: Consultor tecnico"
                  />
                </UFormField>

                <UFormField label="Descricao">
                  <UTextarea
                    v-model="roleForm.description"
                    class="w-full"
                    :rows="4"
                    :disabled="!canEditMetadata"
                    placeholder="Explique quando este papel deve ser usado."
                  />
                </UFormField>

                <div class="rounded-xl border border-default/70 bg-default/30 px-4 py-3 text-sm text-muted">
                  <p>
                    Codigo interno: <strong class="text-highlighted">{{ role.name }}</strong>
                  </p>
                </div>
              </div>
            </UPageCard>

            <UPageCard title="Permissoes" description="Marque no checkbox cada acao que este papel pode executar." variant="subtle">
              <div class="space-y-4">
                <div
                  v-for="(groupItems, resource) in groupedActions"
                  :key="resource"
                  class="rounded-xl border border-default/70"
                >
                  <div class="border-b border-default/70 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-widest text-muted">
                      {{ resource }}
                    </p>
                  </div>

                  <div class="divide-y divide-default/60">
                    <div
                      v-for="action in groupItems"
                      :key="action.id"
                      class="flex items-start gap-3 px-4 py-3"
                    >
                      <UCheckbox
                        :model-value="Boolean(permissionState[action.id])"
                        :disabled="!canEditPermissions || isSaving"
                        color="neutral"
                        @update:model-value="updatePermission(action.id, $event)"
                      />

                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="text-sm font-medium text-highlighted">
                            {{ action.name || action.code }}
                          </p>
                          <UBadge
                            :label="permissionState[action.id] ? 'Permitido' : 'Bloqueado'"
                            :color="permissionState[action.id] ? 'success' : 'neutral'"
                            variant="subtle"
                            size="xs"
                          />
                        </div>
                        <p v-if="action.description" class="mt-1 text-xs text-muted">
                          {{ action.description }}
                        </p>
                        <p v-else class="mt-1 text-xs text-muted">
                          Codigo: {{ action.code }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </UPageCard>
          </div>

          <UPageCard title="Usuarios vinculados" description="Pessoas da organizacao que atualmente usam este papel." variant="subtle">
            <div v-if="assignedUsers.length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="user in assignedUsers"
                :key="user.id"
                class="rounded-xl border border-default/70 px-4 py-3"
              >
                <div class="flex items-center justify-between gap-2">
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
                <p v-if="user.email" class="mt-1 text-xs text-muted">
                  {{ user.email }}
                </p>
                <p v-if="user.employee_name" class="mt-1 text-xs text-muted">
                  Funcionario: {{ user.employee_name }}
                </p>
              </div>
            </div>

            <div v-else class="rounded-xl border border-dashed border-default px-4 py-8 text-center">
              <UIcon name="i-lucide-users" class="mx-auto mb-2 size-8 text-muted" />
              <p class="text-sm font-medium text-highlighted">
                Nenhum usuario vinculado
              </p>
              <p class="mt-1 text-sm text-muted">
                Quando alguem receber este papel, o usuario aparecera aqui.
              </p>
            </div>
          </UPageCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>