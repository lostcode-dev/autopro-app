<script setup lang="ts">
import type { Client, PersonType } from '~/types/clients'

const props = defineProps<{
  open: boolean
  client: Client | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()

const isLoadingCep = ref(false)
const isSaving = ref(false)

const isEditing = computed(() => props.client !== null)
const title = computed(() => isEditing.value ? 'Editar cliente' : 'Novo cliente')

const personTypeOptions = [
  { label: 'Pessoa Física', value: 'pf' },
  { label: 'Pessoa Jurídica', value: 'pj' }
]

function emptyForm() {
  return {
    name: '',
    person_type: 'pf' as PersonType,
    tax_id: '',
    email: '',
    phone: '',
    mobile_phone: '',
    birth_date: '',
    zip_code: '',
    street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    notes: ''
  }
}

const form = reactive(emptyForm())

watch(
  () => props.open,
  (opened) => {
    if (!opened)
      return

    if (props.client) {
      Object.assign(form, {
        name: props.client.name ?? '',
        person_type: props.client.person_type ?? 'pf',
        tax_id: props.client.tax_id ?? '',
        email: props.client.email ?? '',
        phone: props.client.phone ?? '',
        mobile_phone: props.client.mobile_phone ?? '',
        birth_date: props.client.birth_date ? props.client.birth_date.split('T')[0] : '',
        zip_code: props.client.zip_code ?? '',
        street: props.client.street ?? '',
        address_number: props.client.address_number ?? '',
        address_complement: props.client.address_complement ?? '',
        neighborhood: props.client.neighborhood ?? '',
        city: props.client.city ?? '',
        state: props.client.state ?? '',
        notes: props.client.notes ?? ''
      })
    } else {
      Object.assign(form, emptyForm())
    }
  },
  { immediate: true }
)

async function save() {
  if (isSaving.value)
    return

  if (!form.name.trim()) {
    toast.add({ title: 'Nome obrigatório', color: 'warning' })
    return
  }

  if (!form.phone.trim()) {
    toast.add({ title: 'Telefone obrigatório', color: 'warning' })
    return
  }

  isSaving.value = true
  try {
    const body = {
      name: form.name,
      person_type: form.person_type,
      tax_id: form.tax_id || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      birth_date: form.birth_date || null,
      zip_code: form.zip_code || null,
      street: form.street || null,
      address_number: form.address_number || null,
      address_complement: form.address_complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      notes: form.notes || null
    }

    if (isEditing.value && props.client) {
      await $fetch(`/api/clients/${props.client.id}`, { method: 'PUT', body })
      toast.add({ title: 'Cliente atualizado', color: 'success' })
    } else {
      await $fetch('/api/clients', { method: 'POST', body })
      toast.add({ title: 'Cliente criado', color: 'success' })
    }

    emit('update:open', false)
    emit('saved')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

async function lookupCep() {
  const cep = form.zip_code.replace(/\D/g, '')
  if (cep.length !== 8)
    return

  isLoadingCep.value = true
  try {
    const res = await $fetch<Record<string, string | boolean>>(`https://viacep.com.br/ws/${cep}/json/`)
    if (res.erro) {
      toast.add({ title: 'CEP não encontrado', color: 'warning' })
      return
    }

    form.street = String(res.logradouro || form.street)
    form.neighborhood = String(res.bairro || form.neighborhood)
    form.city = String(res.localidade || form.city)
    form.state = String(res.uf || form.state)
  } catch {
    toast.add({ title: 'Erro ao buscar CEP', color: 'error' })
  } finally {
    isLoadingCep.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Nome" required class="sm:col-span-2">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>

          <UFormField label="Tipo de pessoa">
            <USelectMenu
              v-model="form.person_type"
              :items="personTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="CPF / CNPJ">
            <UInput v-model="form.tax_id" class="w-full" />
          </UFormField>

          <UFormField label="E-mail">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>

          <UFormField label="Telefone" required>
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

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="CEP" class="sm:col-span-2">
            <div class="flex gap-2">
              <UInput v-model="form.zip_code" placeholder="00000-000" class="flex-1" />
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
            <UInput v-model="form.street" class="w-full" />
          </UFormField>

          <UFormField label="Número">
            <UInput v-model="form.address_number" class="w-full" />
          </UFormField>

          <UFormField label="Complemento">
            <UInput v-model="form.address_complement" class="w-full" />
          </UFormField>

          <UFormField label="Bairro">
            <UInput v-model="form.neighborhood" class="w-full" />
          </UFormField>

          <UFormField label="Cidade">
            <UInput v-model="form.city" class="w-full" />
          </UFormField>

          <UFormField label="UF">
            <UInput v-model="form.state" maxlength="2" class="w-full uppercase" />
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
          @click="emit('update:open', false)"
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
