<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Fornecedores' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.SUPPLIERS_READ))
const canCreate = computed(() => workshop.can(ActionCode.SUPPLIERS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.SUPPLIERS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.SUPPLIERS_DELETE))

type Supplier = Record<string, any>

const search = ref('')
const isLoadingCep = ref(false)

const { data, status, refresh } = await useAsyncData(
  () => `suppliers-${search.value}`,
  () => requestFetch<Supplier[]>('/api/suppliers', {
    headers: requestHeaders,
    query: { search: search.value || undefined }
  }),
  { watch: [search] }
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  trade_name: '',
  person_type: 'PJ' as string,
  tax_id: '',
  email: '',
  phone: '',
  mobile_phone: '',
  website: '',
  address_zip_code: '',
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  notes: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(s: Supplier) {
  Object.assign(form, {
    name: s.name ?? '',
    trade_name: s.trade_name ?? '',
    person_type: s.person_type ?? 'PJ',
    tax_id: s.tax_id ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    mobile_phone: s.mobile_phone ?? '',
    website: s.website ?? '',
    address_zip_code: s.address_zip_code ?? '',
    address_street: s.address_street ?? '',
    address_number: s.address_number ?? '',
    address_complement: s.address_complement ?? '',
    address_neighborhood: s.address_neighborhood ?? '',
    address_city: s.address_city ?? '',
    address_state: s.address_state ?? '',
    notes: s.notes ?? ''
  })
  isEditing.value = true
  selectedId.value = s.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.name) { toast.add({ title: 'Nome obrigatório', color: 'warning' }); return }
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      name: form.name,
      trade_name: form.trade_name || null,
      person_type: form.person_type,
      tax_id: form.tax_id || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      website: form.website || null,
      address_zip_code: form.address_zip_code || null,
      address_street: form.address_street || null,
      address_number: form.address_number || null,
      address_complement: form.address_complement || null,
      address_neighborhood: form.address_neighborhood || null,
      address_city: form.address_city || null,
      address_state: form.address_state || null,
      notes: form.notes || null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/suppliers/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Fornecedor atualizado', color: 'success' })
    } else {
      await $fetch('/api/suppliers', { method: 'POST', body })
      toast.add({ title: 'Fornecedor criado', color: 'success' })
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

async function remove(s: Supplier) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/suppliers/${s.id}`, { method: 'DELETE' })
    toast.add({ title: 'Fornecedor removido', color: 'success' })
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
  } catch { toast.add({ title: 'Erro ao buscar CEP', color: 'error' }) } finally { isLoadingCep.value = false }
}

const personTypeOptions = [
  { label: 'Pessoa Jurídica', value: 'PJ' },
  { label: 'Pessoa Física', value: 'PF' }
]

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'trade_name', header: 'Nome fantasia' },
  { accessorKey: 'tax_id', header: 'CNPJ/CPF' },
  { accessorKey: 'phone', header: 'Telefone' },
  { accessorKey: 'email', header: 'E-mail' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Fornecedores">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo fornecedor"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </AppPageHeader>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">
        Você não tem permissão para visualizar fornecedores.
      </p>
    </div>

    <template v-else>
      <div class="flex flex-wrap gap-3 p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar por nome ou CNPJ..."
          icon="i-lucide-search"
          class="w-72"
        />
      </div>

      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="data || []"
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
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showModal" :title="isEditing ? 'Editar fornecedor' : 'Novo fornecedor'" :ui="{ body: 'overflow-y-auto max-h-[70vh]' }">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Razão social / Nome" required class="sm:col-span-2">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <UFormField label="Nome fantasia">
            <UInput v-model="form.trade_name" class="w-full" />
          </UFormField>
          <UFormField label="Tipo de pessoa">
            <USelectMenu
              v-model="form.person_type"
              :items="personTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="CNPJ / CPF">
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
          <UFormField label="Website" class="sm:col-span-2">
            <UInput v-model="form.website" class="w-full" placeholder="https://" />
          </UFormField>
        </div>

        <USeparator label="Endereço" />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="CEP" class="sm:col-span-2">
            <div class="flex gap-2">
              <UInput v-model="form.address_zip_code" placeholder="00000-000" class="flex-1" />
              <UButton
                label="Buscar"
                color="neutral"
                variant="outline"
                :loading="isLoadingCep"
                :disabled="isLoadingCep"
                @click="lookupCep"
              />
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
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="showModal = false"
        />
        <UButton
          label="Salvar"
          color="neutral"
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>


