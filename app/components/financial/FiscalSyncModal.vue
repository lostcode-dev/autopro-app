<script setup lang="ts">
import type { SyncStatusOrganization } from '~/types/nfse'

type CnpjLookupResult = {
  business_id: string
  company_name: string
  registration_status: string
  address: {
    municipality_code: string
    municipality_name: string
    street: string
    complement: string
    number: string
    neighborhood: string
    zip_code: string
    state: string
  }
}

type SyncForm = {
  business_id: string
  name: string
  trade_name: string
  state_registration: string
  municipal_registration: string
  street: string
  address_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zip_code: string
  municipality_code: string
  phone: string
  email: string
  nfse_enabled: boolean
}

const props = defineProps<{
  open: boolean
  organization: SyncStatusOrganization | null
  organizationId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'synced': []
}>()

const toast = useToast()
const isFetchingCnpj = ref(false)
const isSyncing = ref(false)
const syncFormError = ref<string | null>(null)

const syncForm = ref<SyncForm>({
  business_id: '',
  name: '',
  trade_name: '',
  state_registration: '',
  municipal_registration: '',
  street: '',
  address_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  municipality_code: '',
  phone: '',
  email: '',
  nfse_enabled: true
})

function stripMask(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

function initForm() {
  syncFormError.value = null
  const org = props.organization
  syncForm.value = {
    business_id: stripMask(org?.tax_id),
    name: org?.name ?? '',
    trade_name: '',
    state_registration: stripMask(org?.state_registration),
    municipal_registration: '',
    street: org?.street ?? '',
    address_number: org?.address_number ?? '',
    complement: org?.address_complement ?? '',
    neighborhood: org?.neighborhood ?? '',
    city: org?.city ?? '',
    state: org?.state ?? '',
    zip_code: stripMask(org?.zip_code),
    municipality_code: org?.municipality_code ?? '',
    phone: stripMask(org?.phone),
    email: org?.email ?? '',
    nfse_enabled: true
  }
  const cnpj = stripMask(org?.tax_id)
  if (cnpj && cnpj.length === 14) lookupCnpj(cnpj)
}

watch(() => props.open, (val) => {
  if (val) initForm()
})

async function lookupCnpj(cnpj: string) {
  if (!cnpj || cnpj.length !== 14) return
  isFetchingCnpj.value = true
  try {
    const res = await $fetch<{ success: boolean, data: CnpjLookupResult }>(`/api/fiscal/business_id/${encodeURIComponent(cnpj)}`)
    if (res?.data) {
      const d = res.data
      if (d.company_name && !syncForm.value.name) syncForm.value.name = d.company_name
      if (d.address.street) syncForm.value.street = d.address.street
      if (d.address.number) syncForm.value.address_number = d.address.number
      if (d.address.complement) syncForm.value.complement = d.address.complement
      if (d.address.neighborhood) syncForm.value.neighborhood = d.address.neighborhood
      if (d.address.municipality_name) syncForm.value.city = d.address.municipality_name
      if (d.address.state) syncForm.value.state = d.address.state
      if (d.address.zip_code) syncForm.value.zip_code = stripMask(d.address.zip_code)
      if (d.address.municipality_code) syncForm.value.municipality_code = d.address.municipality_code
    }
  } catch {
    // CNPJ lookup failure is non-fatal — user can fill manually
  } finally {
    isFetchingCnpj.value = false
  }
}

async function submit() {
  if (isSyncing.value) return
  syncFormError.value = null

  if (!syncForm.value.business_id) { syncFormError.value = 'CNPJ é obrigatório'; return }
  if (!syncForm.value.name.trim()) { syncFormError.value = 'Razão social é obrigatória'; return }

  isSyncing.value = true
  try {
    await $fetch('/api/fiscal/company/sync', {
      method: 'POST',
      body: {
        organization_id: props.organizationId,
        business_id: syncForm.value.business_id,
        name: syncForm.value.name,
        trade_name: syncForm.value.trade_name || undefined,
        state_registration: syncForm.value.state_registration ? Number(syncForm.value.state_registration) : undefined,
        municipal_registration: syncForm.value.municipal_registration ? Number(syncForm.value.municipal_registration) : undefined,
        street: syncForm.value.street || undefined,
        address_number: syncForm.value.address_number ? Number(syncForm.value.address_number) : undefined,
        complement: syncForm.value.complement || undefined,
        neighborhood: syncForm.value.neighborhood || undefined,
        municipality: syncForm.value.municipality_code || undefined,
        state: syncForm.value.state || undefined,
        zip_code: syncForm.value.zip_code ? Number(syncForm.value.zip_code) : undefined,
        phone: syncForm.value.phone || undefined,
        email: syncForm.value.email || undefined,
        nfse_enabled: syncForm.value.nfse_enabled
      }
    })
    toast.add({ title: 'Empresa sincronizada com sucesso na Focus NFe', color: 'success' })
    emit('update:open', false)
    emit('synced')
  } catch (err: any) {
    const msg = err?.data?.data?.details?.message
      || err?.data?.data?.error
      || err?.data?.statusMessage
      || 'Erro ao sincronizar. Verifique os dados e tente novamente.'
    syncFormError.value = msg
    toast.add({ title: 'Erro ao sincronizar empresa', description: msg, color: 'error' })
  } finally {
    isSyncing.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="Configurar integração fiscal (Focus NFe)"
    :description="isFetchingCnpj ? 'Buscando dados do CNPJ...' : 'Preencha os dados para registrar sua empresa na Focus NFe e habilitar a emissão de NFS-e.'"
    :ui="{ overlay: 'z-30', content: 'z-40 max-w-2xl' }"
    @update:open="(v) => !v && !isSyncing && $emit('update:open', false)"
  >
    <template #body>
      <div class="space-y-5">
        <div v-if="isFetchingCnpj" class="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          <UIcon name="i-lucide-loader" class="h-4 w-4 animate-spin" />
          Buscando dados do CNPJ na Receita Federal...
        </div>

        <UAlert
          v-if="syncFormError"
          color="error"
          variant="subtle"
          :title="syncFormError"
          icon="i-lucide-alert-circle"
        />

        <!-- Identity -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="CNPJ" class="col-span-2 sm:col-span-1" required>
            <UInput
              v-model="syncForm.business_id"
              placeholder="00000000000000"
              :disabled="isSyncing"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField label="Razão Social" class="col-span-2 sm:col-span-1" required>
            <UInput
              v-model="syncForm.name"
              placeholder="Razão social da empresa"
              :disabled="isSyncing"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Nome Fantasia" class="col-span-2">
            <UInput
              v-model="syncForm.trade_name"
              placeholder="Nome fantasia (opcional)"
              :disabled="isSyncing"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Tax registrations -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Inscrição Estadual">
            <UInput
              v-model="syncForm.state_registration"
              placeholder="Apenas números"
              :disabled="isSyncing"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Inscrição Municipal">
            <UInput
              v-model="syncForm.municipal_registration"
              placeholder="Apenas números"
              :disabled="isSyncing"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Address -->
        <fieldset class="space-y-3">
          <legend class="text-xs font-semibold uppercase tracking-wide text-muted">
            Endereço
          </legend>
          <div class="grid grid-cols-3 gap-4">
            <UFormField label="Logradouro" class="col-span-2">
              <UInput
                v-model="syncForm.street"
                placeholder="Nome da rua/avenida"
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Número">
              <UInput
                v-model="syncForm.address_number"
                placeholder="Nº"
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Complemento">
              <UInput
                v-model="syncForm.complement"
                placeholder="Apto, sala..."
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Bairro">
              <UInput
                v-model="syncForm.neighborhood"
                placeholder="Bairro"
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <UFormField label="Cidade" class="col-span-2">
              <UInput
                v-model="syncForm.city"
                placeholder="Nome do município"
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
            <UFormField label="UF">
              <UInput
                v-model="syncForm.state"
                placeholder="SP"
                maxlength="2"
                :disabled="isSyncing"
                class="w-full uppercase"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="CEP">
              <UInput
                v-model="syncForm.zip_code"
                placeholder="00000000"
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Código IBGE do Município">
              <UInput
                v-model="syncForm.municipality_code"
                placeholder="Ex: 3550308"
                :disabled="isSyncing"
                class="w-full"
              />
            </UFormField>
          </div>
        </fieldset>

        <!-- Contact -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Telefone">
            <UInput
              v-model="syncForm.phone"
              placeholder="11999999999"
              :disabled="isSyncing"
              class="w-full"
            />
          </UFormField>
          <UFormField label="E-mail">
            <UInput
              v-model="syncForm.email"
              type="email"
              placeholder="contato@empresa.com.br"
              :disabled="isSyncing"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- NFS-e flag -->
        <div class="flex items-center gap-3 rounded-md border border-default bg-muted/30 px-4 py-3">
          <UToggle v-model="syncForm.nfse_enabled" :disabled="isSyncing" />
          <div>
            <p class="text-sm font-medium text-highlighted">
              Habilitar emissão de NFS-e
            </p>
            <p class="text-xs text-muted">
              Ativa a funcionalidade de emissão de Notas Fiscais de Serviço Eletrônicas
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 border-t border-default pt-4">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="ghost"
            :disabled="isSyncing"
            @click="$emit('update:open', false)"
          />
          <UButton
            label="Sincronizar empresa"
            icon="i-lucide-cloud-upload"
            :loading="isSyncing"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
