<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Empresa' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canView = computed(() => workshop.can(ActionCode.SETTINGS_VIEW))
const canUpdate = computed(() => workshop.can(ActionCode.SETTINGS_UPDATE))

type OrgData = Record<string, any>

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  trade_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  mobile_phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  address_zip_code: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().max(2).optional().nullable(),
  address_country: z.string().optional().nullable(),
  municipal_registration: z.string().optional().nullable(),
  state_registration: z.string().optional().nullable(),
  fiscal_regime: z.string().optional().nullable(),
})

type Schema = z.output<typeof schema>

const { data: orgData, status, refresh } = await useAsyncData(
  'company-org',
  () => requestFetch<OrgData>('/api/organizations', { headers: requestHeaders })
)

const form = reactive<Partial<Schema>>({})

function fillForm(data: OrgData | null) {
  if (!data) return
  Object.assign(form, {
    name: data.name ?? '',
    trade_name: data.trade_name ?? '',
    tax_id: data.tax_id ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    mobile_phone: data.mobile_phone ?? '',
    website: data.website ?? '',
    description: data.description ?? '',
    address_zip_code: data.address_zip_code ?? '',
    address_street: data.address_street ?? '',
    address_number: data.address_number ?? '',
    address_complement: data.address_complement ?? '',
    address_neighborhood: data.address_neighborhood ?? '',
    address_city: data.address_city ?? '',
    address_state: data.address_state ?? '',
    address_country: data.address_country ?? 'BR',
    municipal_registration: data.municipal_registration ?? '',
    state_registration: data.state_registration ?? '',
    fiscal_regime: data.fiscal_regime ?? '',
  })
}

watch(orgData, fillForm, { immediate: true })

const isSaving = ref(false)
const isLoadingCep = ref(false)

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  if (isSaving.value || !canUpdate.value) return
  isSaving.value = true
  try {
    await $fetch('/api/organizations', {
      method: 'PUT',
      body: form
    })
    await refresh()
    toast.add({ title: 'Empresa atualizada', description: 'Dados salvos com sucesso.', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

async function lookupCep() {
  const cep = (form.address_zip_code ?? '').replace(/\D/g, '')
  if (cep.length !== 8) return
  isLoadingCep.value = true
  try {
    const res = await $fetch<any>(`https://viacep.com.br/ws/${cep}/json/`)
    if (res.erro) {
      toast.add({ title: 'CEP não encontrado', color: 'warning' })
      return
    }
    form.address_street = res.logradouro || form.address_street
    form.address_neighborhood = res.bairro || form.address_neighborhood
    form.address_city = res.localidade || form.address_city
    form.address_state = res.uf || form.address_state
  } catch {
    toast.add({ title: 'Erro ao buscar CEP', color: 'error' })
  } finally {
    isLoadingCep.value = false
  }
}

const fiscalRegimeOptions = [
  { label: 'Simples Nacional', value: 'simples_nacional' },
  { label: 'Lucro Presumido', value: 'lucro_presumido' },
  { label: 'Lucro Real', value: 'lucro_real' },
  { label: 'MEI', value: 'mei' },
]
</script>

<template>
  <div v-if="!canView" class="p-6">
    <p class="text-sm text-muted">
      Você não tem permissão para visualizar as configurações da empresa.
    </p>
  </div>

  <UForm
    v-else
    id="company-form"
    :schema="schema"
    :state="form"
    @submit="onSubmit"
  >
    <!-- Header -->
    <UPageCard
      title="Empresa"
      description="Informações gerais da sua oficina."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        v-if="canUpdate"
        form="company-form"
        label="Salvar alterações"
        color="neutral"
        type="submit"
        :loading="isSaving"
        :disabled="isSaving"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <div v-if="status === 'pending'" class="space-y-4">
      <USkeleton v-for="i in 6" :key="i" class="h-14 w-full" />
    </div>

    <template v-else>
      <!-- Dados básicos -->
      <UPageCard title="Identificação" variant="subtle" class="mb-4">
        <UFormField name="name" label="Razão social" required class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.name" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="trade_name" label="Nome fantasia" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.trade_name" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="tax_id" label="CNPJ / CPF" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.tax_id" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="description" label="Descrição" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UTextarea v-model="form.description" :disabled="!canUpdate" class="w-full" :rows="3" />
        </UFormField>
      </UPageCard>

      <!-- Contato -->
      <UPageCard title="Contato" variant="subtle" class="mb-4">
        <UFormField name="email" label="E-mail" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.email" type="email" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="phone" label="Telefone" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.phone" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="mobile_phone" label="Celular" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.mobile_phone" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="website" label="Website" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.website" :disabled="!canUpdate" class="w-full" placeholder="https://" />
        </UFormField>
      </UPageCard>

      <!-- Endereço -->
      <UPageCard title="Endereço" variant="subtle" class="mb-4">
        <UFormField name="address_zip_code" label="CEP" class="flex max-sm:flex-col justify-between items-start gap-4">
          <div class="flex gap-2 w-full">
            <UInput v-model="form.address_zip_code" :disabled="!canUpdate" placeholder="00000-000" class="flex-1" />
            <UButton
              v-if="canUpdate"
              label="Buscar"
              color="neutral"
              variant="outline"
              :loading="isLoadingCep"
              :disabled="isLoadingCep"
              @click="lookupCep"
            />
          </div>
        </UFormField>
        <USeparator />
        <UFormField name="address_street" label="Logradouro" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.address_street" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <div class="grid grid-cols-2 gap-4">
          <UFormField name="address_number" label="Número">
            <UInput v-model="form.address_number" :disabled="!canUpdate" class="w-full" />
          </UFormField>
          <UFormField name="address_complement" label="Complemento">
            <UInput v-model="form.address_complement" :disabled="!canUpdate" class="w-full" />
          </UFormField>
        </div>
        <USeparator />
        <UFormField name="address_neighborhood" label="Bairro" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.address_neighborhood" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <div class="grid grid-cols-2 gap-4">
          <UFormField name="address_city" label="Cidade">
            <UInput v-model="form.address_city" :disabled="!canUpdate" class="w-full" />
          </UFormField>
          <UFormField name="address_state" label="UF">
            <UInput v-model="form.address_state" :disabled="!canUpdate" maxlength="2" class="w-full uppercase" />
          </UFormField>
        </div>
      </UPageCard>

      <!-- Fiscal -->
      <UPageCard title="Fiscal" variant="subtle" class="mb-4">
        <UFormField name="fiscal_regime" label="Regime tributário" class="flex max-sm:flex-col justify-between items-start gap-4">
          <USelectMenu
            v-model="form.fiscal_regime"
            :items="fiscalRegimeOptions"
            value-key="value"
            :disabled="!canUpdate"
            class="w-full"
            placeholder="Selecionar..."
          />
        </UFormField>
        <USeparator />
        <UFormField name="municipal_registration" label="Inscrição municipal" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.municipal_registration" :disabled="!canUpdate" class="w-full" />
        </UFormField>
        <USeparator />
        <UFormField name="state_registration" label="Inscrição estadual" class="flex max-sm:flex-col justify-between items-start gap-4">
          <UInput v-model="form.state_registration" :disabled="!canUpdate" class="w-full" />
        </UFormField>
      </UPageCard>
    </template>
  </UForm>
</template>
