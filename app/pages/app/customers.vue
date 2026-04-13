<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Clientes' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.CUSTOMERS_READ))
const canCreate = computed(() => workshop.can(ActionCode.CUSTOMERS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.CUSTOMERS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.CUSTOMERS_DELETE))

type Client = Record<string, any>

const search = ref('')
const personTypeFilter = ref('')
const page = ref(1)
const pageSize = 20
const isLoadingCep = ref(false)

const { data, status, refresh } = await useAsyncData(
  () => `clients-${page.value}-${search.value}-${personTypeFilter.value}`,
  () => requestFetch<{ items: Client[]; total: number; page: number; page_size: number }>(
    '/api/clients',
    {
      headers: requestHeaders,
      query: {
        search: search.value || undefined,
        person_type: personTypeFilter.value || undefined,
        page: page.value,
        page_size: pageSize,
      }
    }
  ),
  { watch: [page, search, personTypeFilter] }
)

// ─── Modal ───────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  person_type: 'PF' as string,
  tax_id: '',
  email: '',
  phone: '',
  mobile_phone: '',
  birth_date: '',
  address_zip_code: '',
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  notes: '',
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(client: Client) {
  Object.assign(form, {
    name: client.name ?? '',
    person_type: client.person_type ?? 'PF',
    tax_id: client.tax_id ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    mobile_phone: client.mobile_phone ?? '',
    birth_date: client.birth_date ? client.birth_date.split('T')[0] : '',
    address_zip_code: client.address_zip_code ?? '',
    address_street: client.address_street ?? '',
    address_number: client.address_number ?? '',
    address_complement: client.address_complement ?? '',
    address_neighborhood: client.address_neighborhood ?? '',
    address_city: client.address_city ?? '',
    address_state: client.address_state ?? '',
    notes: client.notes ?? '',
  })
  isEditing.value = true
  selectedId.value = client.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.name) {
    toast.add({ title: 'Nome obrigatório', color: 'warning' })
    return
  }
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      name: form.name,
      person_type: form.person_type,
      tax_id: form.tax_id || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      birth_date: form.birth_date || null,
      address_zip_code: form.address_zip_code || null,
      address_street: form.address_street || null,
      address_number: form.address_number || null,
      address_complement: form.address_complement || null,
      address_neighborhood: form.address_neighborhood || null,
      address_city: form.address_city || null,
      address_state: form.address_state || null,
      notes: form.notes || null,
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/clients/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Cliente atualizado', color: 'success' })
    } else {
      await $fetch('/api/clients', { method: 'POST', body })
      toast.add({ title: 'Cliente criado', color: 'success' })
    }
    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

async function remove(client: Client) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    toast.add({ title: 'Cliente removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

async function lookupCep() {
  const cep = form.address_zip_code.replace(/\D/g, '')
  if (cep.length !== 8) return
  isLoadingCep.value = true
  try {
    const res = await $fetch<any>(`https://viacep.com.br/ws/${cep}/json/`)
    if (res.erro) { toast.add({ title: 'CEP não encontrado', color: 'warning' }); return }
    form.address_street = res.logradouro || form.address_street
    form.address_neighborhood = res.bairro || form.address_neighborhood
    form.address_city = res.localidade || form.address_city
    form.address_state = res.uf || form.address_state
  } catch { toast.add({ title: 'Erro ao buscar CEP', color: 'error' }) }
  finally { isLoadingCep.value = false }
}

const personTypeOptions = [
  { label: 'Pessoa Física', value: 'PF' },
  { label: 'Pessoa Jurídica', value: 'PJ' },
]

const personTypeFilterOptions = [
  { label: 'Todos', value: '' },
  { label: 'Pessoa Física', value: 'PF' },
  { label: 'Pessoa Jurídica', value: 'PJ' },
]

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'person_type', header: 'Tipo' },
  { accessorKey: 'tax_id', header: 'CPF/CNPJ' },
  { accessorKey: 'phone', header: 'Telefone' },
  { accessorKey: 'email', header: 'E-mail' },
  { id: 'actions', header: '' },
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Clientes">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo cliente"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">Você não tem permissão para visualizar clientes.</p>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-wrap gap-3 p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
          icon="i-lucide-search"
          class="w-72"
          @update:model-value="page = 1"
        />
        <USelectMenu
          v-model="personTypeFilter"
          :items="personTypeFilterOptions"
          value-key="value"
          class="w-44"
          @update:model-value="page = 1"
        />
      </div>

      <!-- Table -->
      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="data?.items || []"
        class="min-h-0 flex-1"
      >
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-2 justify-end">
            <UButton
              v-if="canUpdate"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openEdit(row.original)"
            />
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :loading="isDeleting"
              @click="remove(row.original)"
            />
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div v-if="(data?.total || 0) > pageSize" class="flex justify-center p-4 border-t border-default">
        <UPagination v-model="page" :page-count="pageSize" :total="data?.total || 0" />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal -->
  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar cliente' : 'Novo cliente'"
    :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Nome" required class="sm:col-span-2">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <UFormField label="Tipo de pessoa">
            <USelectMenu v-model="form.person_type" :items="personTypeOptions" value-key="value" class="w-full" />
          </UFormField>
          <UFormField label="CPF / CNPJ">
            <UInput v-model="form.tax_id" class="w-full" />
          </UFormField>
          <UFormField label="E-mail">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>
          <UFormField label="Telefone">
            <UInput v-model="form.phone" class="w-full" />
          </UFormField>
          <UFormField label="Celular">
            <UInput v-model="form.mobile_phone" class="w-full" />
          </UFormField>
          <UFormField label="Data de nascimento">
            <UInput v-model="form.birth_date" type="date" class="w-full" />
          </UFormField>
        </div>

        <USeparator label="Endereço" />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="CEP" class="sm:col-span-2">
            <div class="flex gap-2">
              <UInput v-model="form.address_zip_code" placeholder="00000-000" class="flex-1" />
              <UButton label="Buscar" color="neutral" variant="outline" :loading="isLoadingCep" :disabled="isLoadingCep" @click="lookupCep" />
            </div>
          </UFormField>
          <UFormField label="Logradouro" class="sm:col-span-2">
            <UInput v-model="form.address_street" class="w-full" />
          </UFormField>
          <UFormField label="Número">
            <UInput v-model="form.address_number" class="w-full" />
          </UFormField>
          <UFormField label="Complemento">
            <UInput v-model="form.address_complement" class="w-full" />
          </UFormField>
          <UFormField label="Bairro">
            <UInput v-model="form.address_neighborhood" class="w-full" />
          </UFormField>
          <UFormField label="Cidade">
            <UInput v-model="form.address_city" class="w-full" />
          </UFormField>
          <UFormField label="UF">
            <UInput v-model="form.address_state" maxlength="2" class="w-full uppercase" />
          </UFormField>
        </div>

        <UFormField label="Observações">
          <UTextarea v-model="form.notes" class="w-full" :rows="3" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancelar" color="neutral" variant="ghost" @click="showModal = false" />
        <UButton label="Salvar" color="neutral" :loading="isSaving" :disabled="isSaving" @click="save" />
      </div>
    </template>
  </UModal>
</template>
