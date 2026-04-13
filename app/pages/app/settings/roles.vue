<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Permissões' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canView = computed(() => workshop.can(ActionCode.ROLES_VIEW))
const canCreate = computed(() => workshop.can(ActionCode.ROLES_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.ROLES_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.ROLES_DELETE))
const canManagePermissions = computed(() => workshop.can(ActionCode.ROLES_MANAGE_PERMISSIONS))

type Role = Record<string, any>
type ActionItem = { id: string; code: string; name: string | null; description: string | null; resource: string | null }
type RoleAction = { id: string; role_id: string; action_id: string; is_granted: boolean }

const { data: roles, status, refresh } = await useAsyncData(
  'roles-list',
  () => requestFetch<Role[]>('/api/roles', { headers: requestHeaders })
)

// ─── Role create/edit modal ───────────────────────
const showRoleModal = ref(false)
const isEditingRole = ref(false)
const isSavingRole = ref(false)
const isDeletingRole = ref(false)
const selectedRoleId = ref<string | null>(null)

const roleForm = reactive({ name: '', description: '' })

function openCreateRole() {
  roleForm.name = ''
  roleForm.description = ''
  isEditingRole.value = false
  selectedRoleId.value = null
  showRoleModal.value = true
}

function openEditRole(role: Role) {
  roleForm.name = role.name ?? ''
  roleForm.description = role.description ?? ''
  isEditingRole.value = true
  selectedRoleId.value = role.id
  showRoleModal.value = true
}

async function saveRole() {
  if (isSavingRole.value) return
  isSavingRole.value = true
  try {
    const body = { name: roleForm.name, description: roleForm.description || null }
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
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSavingRole.value = false
  }
}

async function deleteRole(role: Role) {
  if (isDeletingRole.value) return
  isDeletingRole.value = true
  try {
    await $fetch(`/api/roles/${role.id}`, { method: 'DELETE' })
    toast.add({ title: 'Papel removido', color: 'success' })
    if (selectedPermissionsRoleId.value === role.id) {
      selectedPermissionsRoleId.value = null
      actionsData.value = null
    }
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeletingRole.value = false
  }
}

// ─── Permissions panel ────────────────────────────
const selectedPermissionsRoleId = ref<string | null>(null)
const actionsData = ref<{ actions: ActionItem[]; roleActions: RoleAction[] } | null>(null)
const isLoadingActions = ref(false)
const isSavingPermission = ref(false)

async function openPermissions(role: Role) {
  if (selectedPermissionsRoleId.value === role.id) {
    selectedPermissionsRoleId.value = null
    actionsData.value = null
    return
  }
  selectedPermissionsRoleId.value = role.id
  isLoadingActions.value = true
  try {
    const res = await $fetch<{ actions: ActionItem[]; roleActions: RoleAction[] }>(
      `/api/roles/${role.id}/actions`
    )
    actionsData.value = res
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível carregar permissões', color: 'error' })
  } finally {
    isLoadingActions.value = false
  }
}

function isGranted(actionId: string): boolean {
  if (!actionsData.value) return false
  const ra = actionsData.value.roleActions.find(r => r.action_id === actionId)
  return ra?.is_granted ?? false
}

async function togglePermission(actionId: string, current: boolean) {
  if (isSavingPermission.value || !selectedPermissionsRoleId.value) return
  isSavingPermission.value = true
  try {
    const res = await $fetch<{ actions: ActionItem[]; roleActions: RoleAction[] }>(
      `/api/roles/${selectedPermissionsRoleId.value}/actions`,
      {
        method: 'POST',
        body: { action_id: actionId, is_granted: !current }
      }
    )
    actionsData.value = res
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível atualizar permissão', color: 'error' })
  } finally {
    isSavingPermission.value = false
  }
}

// Group actions by resource
const groupedActions = computed(() => {
  if (!actionsData.value?.actions) return {}
  return actionsData.value.actions.reduce<Record<string, ActionItem[]>>((acc, action) => {
    const group = action.resource || 'Geral'
    if (!acc[group]) acc[group] = []
    acc[group]!.push(action)
    return acc
  }, {})
})

const selectedRole = computed(() =>
  roles.value?.find(r => r.id === selectedPermissionsRoleId.value) ?? null
)
</script>

<template>
  <div v-if="!canView" class="p-6">
    <p class="text-sm text-muted">Você não tem permissão para visualizar papéis.</p>
  </div>

  <template v-else>
    <UPageCard
      title="Papéis e permissões"
      description="Gerencie os papéis da equipe e suas permissões."
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

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Roles list -->
      <UPageCard title="Papéis" variant="subtle">
        <div v-if="status === 'pending'" class="space-y-3">
          <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="role in roles"
            :key="role.id"
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="selectedPermissionsRoleId === role.id ? 'border-primary bg-primary/5' : 'border-default hover:bg-elevated'"
            @click="canManagePermissions && openPermissions(role)"
          >
            <div>
              <p class="text-sm font-medium">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted">{{ role.description }}</p>
              <UBadge v-if="role.is_system_role" label="Sistema" color="neutral" variant="subtle" size="xs" class="mt-1" />
            </div>
            <div class="flex items-center gap-1">
              <UButton
                v-if="canManagePermissions"
                icon="i-lucide-shield-check"
                color="neutral"
                variant="ghost"
                size="xs"
                :color="selectedPermissionsRoleId === role.id ? 'primary' : 'neutral'"
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
                :loading="isDeletingRole"
                @click.stop="deleteRole(role)"
              />
            </div>
          </div>
          <p v-if="!roles?.length" class="text-sm text-muted text-center py-4">
            Nenhum papel cadastrado.
          </p>
        </div>
      </UPageCard>

      <!-- Permissions panel -->
      <UPageCard
        :title="selectedRole ? `Permissões: ${selectedRole.name}` : 'Permissões'"
        :description="selectedRole ? 'Clique nas permissões para ativar ou desativar.' : 'Selecione um papel para gerenciar permissões.'"
        variant="subtle"
      >
        <div v-if="isLoadingActions" class="space-y-3">
          <USkeleton v-for="i in 6" :key="i" class="h-8 w-full" />
        </div>

        <div v-else-if="!selectedPermissionsRoleId" class="flex items-center justify-center py-12 text-muted">
          <div class="text-center">
            <UIcon name="i-lucide-shield" class="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p class="text-sm">Selecione um papel à esquerda</p>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div v-for="(actions, resource) in groupedActions" :key="resource">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{{ resource }}</p>
            <div class="space-y-1">
              <div
                v-for="action in actions"
                :key="action.id"
                class="flex items-center justify-between p-2 rounded hover:bg-elevated"
              >
                <div>
                  <p class="text-sm">{{ action.name || action.code }}</p>
                  <p v-if="action.description" class="text-xs text-muted">{{ action.description }}</p>
                </div>
                <UToggle
                  :model-value="isGranted(action.id)"
                  :disabled="!canManagePermissions || isSavingPermission"
                  @update:model-value="togglePermission(action.id, isGranted(action.id))"
                />
              </div>
            </div>
          </div>
        </div>
      </UPageCard>
    </div>
  </template>

  <!-- Role Modal -->
  <UModal v-model:open="showRoleModal" :title="isEditingRole ? 'Editar papel' : 'Novo papel'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required>
          <UInput v-model="roleForm.name" class="w-full" />
        </UFormField>
        <UFormField label="Descrição">
          <UTextarea v-model="roleForm.description" class="w-full" :rows="3" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancelar" color="neutral" variant="ghost" @click="showRoleModal = false" />
        <UButton label="Salvar" color="neutral" :loading="isSavingRole" :disabled="isSavingRole" @click="saveRole" />
      </div>
    </template>
  </UModal>
</template>
