<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Permissoes' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canView = computed(() => workshop.can(ActionCode.ROLES_VIEW))
const canCreate = computed(() => workshop.can(ActionCode.ROLES_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.ROLES_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.ROLES_DELETE))
const canManagePermissions = computed(() => workshop.can(ActionCode.ROLES_MANAGE_PERMISSIONS))

type Role = {
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

type RolesResponse = {
  items: Role[]
}

type RoleActionsResponse = {
  actions: ActionItem[]
  role_actions: RoleAction[]
}

const { data, status, refresh } = await useAsyncData(
  'roles-list',
  () => requestFetch<RolesResponse>('/api/roles', { headers: requestHeaders })
)

const roles = computed(() => data.value?.items ?? [])

const showRoleModal = ref(false)
const isEditingRole = ref(false)
const isSavingRole = ref(false)
const selectedRoleId = ref<string | null>(null)

const roleForm = reactive({
  display_name: '',
  description: ''
})

const showDeleteConfirm = ref(false)
const deletingRoleId = ref<string | null>(null)
const pendingDeleteRole = ref<Role | null>(null)

const selectedPermissionsRoleId = ref<string | null>(null)
const actionsData = ref<RoleActionsResponse | null>(null)
const isLoadingActions = ref(false)
const isSavingPermission = ref(false)

const selectedRole = computed(() =>
  roles.value.find(role => role.id === selectedPermissionsRoleId.value) ?? null
)

const selectedRoleCanBeManaged = computed(() =>
  Boolean(selectedRole.value && canManagePermissions.value && !selectedRole.value.is_system_role)
)

const groupedActions = computed<Record<string, ActionItem[]>>(() => {
  if (!actionsData.value?.actions?.length)
    return {}

  return actionsData.value.actions.reduce<Record<string, ActionItem[]>>((groups, action) => {
    const groupName = action.resource || 'Geral'
    if (!groups[groupName])
      groups[groupName] = []

    groups[groupName].push(action)
    return groups
  }, {})
})

function roleLabel(role: Role) {
  return role.display_name?.trim() || role.name
}

function slugifyRoleName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'papel_personalizado'
}

function resetRoleForm() {
  roleForm.display_name = ''
  roleForm.description = ''
}

function openCreateRole() {
  resetRoleForm()
  isEditingRole.value = false
  selectedRoleId.value = null
  showRoleModal.value = true
}

function openEditRole(role: Role) {
  roleForm.display_name = role.display_name ?? role.name
  roleForm.description = role.description ?? ''
  isEditingRole.value = true
  selectedRoleId.value = role.id
  showRoleModal.value = true
}

async function saveRole() {
  if (isSavingRole.value)
    return

  const displayName = roleForm.display_name.trim()
  if (!displayName)
    return

  isSavingRole.value = true

  try {
    const body = {
      display_name: displayName,
      description: roleForm.description.trim() || null,
      ...(isEditingRole.value ? {} : { name: slugifyRoleName(displayName) })
    }

    if (isEditingRole.value && selectedRoleId.value) {
      await $fetch(`/api/roles/${selectedRoleId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Papel atualizado', color: 'success' })
    } else {
      await $fetch('/api/roles', { method: 'POST', body })
      toast.add({ title: 'Papel criado', color: 'success' })
    }

    showRoleModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel salvar',
      color: 'error'
    })
  } finally {
    isSavingRole.value = false
  }
}

function requestDeleteRole(role: Role) {
  pendingDeleteRole.value = role
  showDeleteConfirm.value = true
}

async function confirmDeleteRole() {
  if (!pendingDeleteRole.value || deletingRoleId.value)
    return

  deletingRoleId.value = pendingDeleteRole.value.id

  try {
    await $fetch(`/api/roles/${pendingDeleteRole.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Papel removido', color: 'success' })

    if (selectedPermissionsRoleId.value === pendingDeleteRole.value.id) {
      selectedPermissionsRoleId.value = null
      actionsData.value = null
    }

    showDeleteConfirm.value = false
    pendingDeleteRole.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel remover',
      color: 'error'
    })
  } finally {
    deletingRoleId.value = null
  }
}

async function fetchRolePermissions(roleId: string) {
  const response = await $fetch<RoleActionsResponse>(`/api/roles/${roleId}/actions`)
  actionsData.value = response
}

async function openPermissions(role: Role) {
  if (selectedPermissionsRoleId.value === role.id) {
    selectedPermissionsRoleId.value = null
    actionsData.value = null
    return
  }

  selectedPermissionsRoleId.value = role.id
  isLoadingActions.value = true

  try {
    await fetchRolePermissions(role.id)
  } catch (error: unknown) {
    selectedPermissionsRoleId.value = null
    actionsData.value = null

    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel carregar permissoes',
      color: 'error'
    })
  } finally {
    isLoadingActions.value = false
  }
}

function isGranted(actionId: string) {
  return actionsData.value?.role_actions.find(roleAction => roleAction.action_id === actionId)?.is_granted ?? false
}

async function togglePermission(actionId: string) {
  if (isSavingPermission.value || !selectedPermissionsRoleId.value || !selectedRoleCanBeManaged.value)
    return

  isSavingPermission.value = true

  try {
    await $fetch(`/api/roles/${selectedPermissionsRoleId.value}/actions`, {
      method: 'POST',
      body: {
        action_id: actionId,
        is_granted: !isGranted(actionId)
      }
    })

    await fetchRolePermissions(selectedPermissionsRoleId.value)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel atualizar permissao',
      color: 'error'
    })
  } finally {
    isSavingPermission.value = false
  }
}
</script>

<template>
  <div v-if="!canView" class="rounded-xl border border-default/60 bg-elevated/30 p-6">
    <p class="text-sm text-muted">
      Voce nao tem permissao para visualizar papeis.
    </p>
  </div>

  <template v-else>
    <UPageCard
      title="Papeis e permissoes"
      description="Gerencie os perfis da equipe e o acesso de cada um no sistema."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        v-if="canCreate"
        label="Novo papel"
        icon="i-lucide-plus"
        color="neutral"
        class="w-fit lg:ms-auto"
        @click="openCreateRole"
      />
    </UPageCard>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <UPageCard title="Papeis" description="Perfis disponiveis para vincular aos usuarios." variant="subtle">
        <div v-if="status === 'pending'" class="space-y-3">
          <USkeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-lg" />
        </div>

        <div v-else-if="roles.length" class="space-y-2">
          <button
            v-for="role in roles"
            :key="role.id"
            type="button"
            class="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
            :class="selectedPermissionsRoleId === role.id ? 'border-primary bg-primary/5' : 'border-default hover:bg-elevated/60'"
            @click="openPermissions(role)"
          >
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-highlighted">
                  {{ roleLabel(role) }}
                </p>
                <UBadge
                  v-if="role.is_system_role"
                  label="Sistema"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
              </div>

              <p v-if="role.description" class="text-xs text-muted">
                {{ role.description }}
              </p>

              <p v-else class="text-xs text-muted">
                Sem descricao.
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <UButton
                :icon="selectedPermissionsRoleId === role.id ? 'i-lucide-panel-right-close' : 'i-lucide-shield-check'"
                :color="selectedPermissionsRoleId === role.id ? 'primary' : 'neutral'"
                variant="ghost"
                size="xs"
                @click.stop="openPermissions(role)"
              />
              <UButton
                v-if="canUpdate && !role.is_system_role"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                @click.stop="openEditRole(role)"
              />
              <UButton
                v-if="canDelete && !role.is_system_role"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :loading="deletingRoleId === role.id"
                @click.stop="requestDeleteRole(role)"
              />
            </div>
          </button>
        </div>

        <div v-else class="rounded-lg border border-dashed border-default px-4 py-8 text-center">
          <UIcon name="i-lucide-shield-off" class="mx-auto mb-2 size-8 text-muted" />
          <p class="text-sm font-medium text-highlighted">
            Nenhum papel cadastrado
          </p>
          <p class="mt-1 text-sm text-muted">
            Crie um papel para organizar o acesso da equipe.
          </p>
        </div>
      </UPageCard>

      <UPageCard
        :title="selectedRole ? `Permissoes: ${roleLabel(selectedRole)}` : 'Permissoes'"
        :description="selectedRole ? 'Defina quais acoes esse perfil pode executar.' : 'Selecione um papel para visualizar ou editar as permissoes.'"
        variant="subtle"
      >
        <div v-if="isLoadingActions" class="space-y-3">
          <USkeleton v-for="i in 7" :key="i" class="h-12 w-full rounded-lg" />
        </div>

        <div v-else-if="!selectedRole" class="flex items-center justify-center py-12 text-muted">
          <div class="text-center">
            <UIcon name="i-lucide-shield" class="mx-auto mb-2 size-10 opacity-30" />
            <p class="text-sm">
              Selecione um papel ao lado para continuar.
            </p>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div
            v-if="selectedRole.is_system_role"
            class="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-muted"
          >
            Este e um papel de sistema. As permissoes podem ser consultadas aqui, mas nao podem ser alteradas nesta tela.
          </div>

          <div
            v-else-if="!canManagePermissions"
            class="rounded-lg border border-default/60 bg-elevated/40 px-4 py-3 text-sm text-muted"
          >
            Voce pode visualizar os perfis, mas nao tem permissao para editar as permissoes deles.
          </div>

          <div v-if="Object.keys(groupedActions).length" class="space-y-4">
            <div
              v-for="(actions, resource) in groupedActions"
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
                  v-for="action in actions"
                  :key="action.id"
                  class="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-highlighted">
                      {{ action.name || action.code }}
                    </p>
                    <p v-if="action.description" class="text-xs text-muted">
                      {{ action.description }}
                    </p>
                    <p v-else class="text-xs text-muted">
                      Codigo: {{ action.code }}
                    </p>
                  </div>

                  <UToggle
                    :model-value="isGranted(action.id)"
                    :disabled="!selectedRoleCanBeManaged || isSavingPermission"
                    @update:model-value="togglePermission(action.id)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-else class="rounded-lg border border-dashed border-default px-4 py-8 text-center">
            <UIcon name="i-lucide-list-x" class="mx-auto mb-2 size-8 text-muted" />
            <p class="text-sm font-medium text-highlighted">
              Nenhuma permissao encontrada
            </p>
            <p class="mt-1 text-sm text-muted">
              Ainda nao existem acoes cadastradas para este perfil.
            </p>
          </div>
        </div>
      </UPageCard>
    </div>
  </template>

  <UModal
    v-model:open="showRoleModal"
    :title="isEditingRole ? 'Editar papel' : 'Novo papel'"
    :description="isEditingRole ? 'Atualize o nome exibido e a descricao do perfil.' : 'Crie um novo perfil para organizar o acesso da equipe.'"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          label="Nome exibido"
          description="Esse nome aparece na selecao de perfis e nas configuracoes da equipe."
          required
        >
          <UInput
            v-model="roleForm.display_name"
            class="w-full"
            placeholder="Ex: Consultor tecnico"
          />
        </UFormField>

        <UFormField label="Descricao" description="Opcional. Use para explicar quando esse papel deve ser usado.">
          <UTextarea
            v-model="roleForm.description"
            class="w-full"
            :rows="3"
            placeholder="Ex: Perfil para atendimento, abertura de OS e acompanhamento de clientes."
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="showRoleModal = false"
        />
        <UButton
          :label="isEditingRole ? 'Salvar alteracoes' : 'Criar papel'"
          color="neutral"
          :loading="isSavingRole"
          :disabled="isSavingRole || !roleForm.display_name.trim()"
          @click="saveRole"
        />
      </div>
    </template>
  </UModal>

  <AppConfirmModal
    :open="showDeleteConfirm"
    title="Remover papel"
    confirm-label="Remover"
    confirm-color="error"
    :loading="Boolean(deletingRoleId)"
    @update:open="
      (value: boolean) => {
        showDeleteConfirm = value
        if (!value && !deletingRoleId) pendingDeleteRole = null
      }
    "
    @confirm="confirmDeleteRole"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja remover o papel
        <strong class="text-highlighted">{{ pendingDeleteRole ? roleLabel(pendingDeleteRole) : 'selecionado' }}</strong>?
        Esta acao nao pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>
</template>
