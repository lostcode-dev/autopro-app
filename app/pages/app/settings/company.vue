<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Empresa' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server
  ? useRequestHeaders(['cookie'])
  : undefined

const canView = computed(() => workshop.can(ActionCode.SETTINGS_VIEW))
const canUpdate = computed(() => workshop.can(ActionCode.SETTINGS_UPDATE))

type OrgData = Record<string, any>

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  trade_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal('')),
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
  logo_url: z.string().optional().nullable(),
  initial_service_order_number: z.number().int().min(1).optional().nullable()
})

type Schema = z.output<typeof schema>

const {
  data: orgData,
  status,
  refresh
} = await useAsyncData('company-org', () =>
  requestFetch<OrgData>('/api/organizations', { headers: requestHeaders })
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
    logo_url: data.logo_url ?? null,
    initial_service_order_number: data.initial_service_order_number ?? 1
  })
}

watch(orgData, fillForm, { immediate: true })

const isSaving = ref(false)
const isLoadingCep = ref(false)
const isUploadingLogo = ref(false)
const logoFileRef = ref<HTMLInputElement>()

async function onLogoFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]!
  isUploadingLogo.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const result = await $fetch<{ logo_url: string }>(
      '/api/organizations/logo',
      {
        method: 'POST',
        body
      }
    )
    form.logo_url = result.logo_url
    toast.add({ title: 'Logo atualizado', color: 'success' })
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string }
      statusMessage?: string
    }
    toast.add({
      title: 'Erro ao enviar logo',
      description:
        err?.data?.statusMessage
        || err?.statusMessage
        || 'Não foi possível enviar',
      color: 'error'
    })
  } finally {
    isUploadingLogo.value = false
    if (input) input.value = ''
  }
}

async function removeLogo() {
  if (!canUpdate.value) return
  try {
    await $fetch('/api/organizations', {
      method: 'PUT',
      body: { logo_url: null }
    })
    form.logo_url = null
    toast.add({ title: 'Logo removido', color: 'success' })
  } catch {
    toast.add({ title: 'Erro ao remover logo', color: 'error' })
  }
}

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  if (isSaving.value || !canUpdate.value) return
  isSaving.value = true
  try {
    await $fetch('/api/organizations', {
      method: 'PUT',
      body: form
    })
    await refresh()
    toast.add({
      title: 'Empresa atualizada',
      description: 'Dados salvos com sucesso.',
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string }
      statusMessage?: string
    }
    toast.add({
      title: 'Erro',
      description:
        err?.data?.statusMessage
        || err?.statusMessage
        || 'Não foi possível salvar',
      color: 'error'
    })
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
  { label: 'MEI', value: 'mei' }
]
</script>

<template>
  <div
    v-if="!canView"
    class="rounded-xl border border-default/60 bg-elevated/30 p-6"
  >
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
    <UPageCard
      title="Empresa"
      description="Dados cadastrais, contato e endereço da sua oficina."
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
      <USkeleton v-for="i in 8" :key="i" class="h-14 w-full" />
    </div>

    <template v-else>
      <!-- Logo -->
      <UPageCard variant="subtle" class="mb-4">
        <UFormField
          name="logo_url"
          label="Logo da oficina"
          description="JPEG, PNG ou WebP. Máx. 5 MB. Recomendado 200×200 px."
          class="grid gap-4"
        >
          <div class="flex flex-col flex-wrap items-center gap-3">
            <div class="relative shrink-0">
              <img
                v-if="form.logo_url"
                :src="form.logo_url"
                alt="Logo"
                class="size-32 rounded-xl object-contain border border-default bg-white p-1"
              >
              <div
                v-else
                class="size-32 rounded-xl border-2 border-dashed border-default/70 flex items-center justify-center bg-elevated/40"
              >
                <UIcon name="i-lucide-building-2" class="size-20 text-muted" />
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <UTooltip text="Enviar logo">
                <UButton
                  color="neutral"
                  icon="i-lucide-upload"
                  :loading="isUploadingLogo"
                  :disabled="!canUpdate || isUploadingLogo"
                  @click="logoFileRef?.click()"
                />
              </UTooltip>

              <UTooltip text="Remover">
                <UButton
                  v-if="form.logo_url && canUpdate"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="removeLogo"
                />
              </UTooltip>
            </div>
            <input
              ref="logoFileRef"
              type="file"
              class="hidden"
              accept=".jpg,.jpeg,.png,.webp"
              @change="onLogoFileChange"
            >
          </div>
        </UFormField>
      </UPageCard>

      <!-- Identificação -->
      <UPageCard variant="subtle" class="mb-4">
        <p
          class="text-xs font-semibold uppercase tracking-widest text-muted mb-4"
        >
          Identificação
        </p>

        <div class="grid gap-4 grid-cols-2">
          <UFormField
            name="name"
            label="Razão social"
            description="Nome jurídico registrado da empresa."
            required
            class="grid gap-2"
          >
            <UInput
              v-model="form.name"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="Ex: Oficina Silva LTDA"
            />
          </UFormField>

          <UFormField
            name="trade_name"
            label="Nome fantasia"
            description="Como a oficina é conhecida pelos clientes."
            class="grid gap-2"
          >
            <UInput
              v-model="form.trade_name"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="Ex: Oficina do Silva"
            />
          </UFormField>

          <UFormField
            name="tax_id"
            label="CNPJ / CPF"
            description="Documento de identificação fiscal."
            class="grid gap-2"
          >
            <UInput
              v-model="form.tax_id"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="00.000.000/0001-00"
            />
          </UFormField>

          <UFormField
            name="description"
            label="Descrição"
            description="Breve apresentação da oficina"
            class="grid gap-2"
          >
            <UTextarea
              v-model="form.description"
              :disabled="!canUpdate"
              class="w-full"
              :rows="3"
              placeholder="Ex: Especializada em veículos leves e pesados desde 2005."
            />
          </UFormField>
        </div>
      </UPageCard>

      <!-- Contato -->
      <UPageCard variant="subtle" class="mb-4">
        <p
          class="text-xs font-semibold uppercase tracking-widest text-muted mb-4"
        >
          Contato
        </p>

        <div class="gap-4 grid grid-cols-2">
          <UFormField name="email" label="E-mail" class="grid gap-2">
            <UInput
              v-model="form.email"
              type="email"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="contato@oficina.com.br"
            />
          </UFormField>

          <UFormField name="phone" label="Telefone fixo" class="grid gap-2">
            <UInput
              v-model="form.phone"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="(00) 0000-0000"
            />
          </UFormField>

          <UFormField
            name="mobile_phone"
            label="Celular / WhatsApp"
            class="grid gap-2"
          >
            <UInput
              v-model="form.mobile_phone"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="(00) 90000-0000"
            />
          </UFormField>

          <UFormField name="website" label="Website" class="grid gap-2">
            <UInput
              v-model="form.website"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="https://suaoficina.com.br"
            />
          </UFormField>
        </div>
      </UPageCard>

      <!-- Endereço -->
      <UPageCard variant="subtle" class="mb-4">
        <p
          class="text-xs font-semibold uppercase tracking-widest text-muted mb-4"
        >
          Endereço
        </p>

        <div class="gap-4 grid grid-cols-2">
          <UFormField name="address_zip_code" label="CEP" class="grid gap-2">
            <div class="flex gap-2 w-full">
              <UInput
                v-model="form.address_zip_code"
                :disabled="!canUpdate"
                placeholder="00000-000"
                class="flex-1"
              />
              <UButton
                v-if="canUpdate"
                label="Buscar CEP"
                color="neutral"
                variant="outline"
                icon="i-lucide-search"
                :loading="isLoadingCep"
                :disabled="isLoadingCep"
                @click="lookupCep"
              />
            </div>
          </UFormField>

          <UFormField
            name="address_street"
            label="Logradouro"
            class="grid gap-2"
          >
            <UInput
              v-model="form.address_street"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="Rua, Avenida..."
            />
          </UFormField>

          <div class="grid gap-4 grid-cols-2">
            <UFormField name="address_number" label="Número" class="grid gap-2">
              <UInput
                v-model="form.address_number"
                :disabled="!canUpdate"
                class="w-full"
                placeholder="Nº"
              />
            </UFormField>

            <UFormField
              name="address_complement"
              label="Complemento"
              class="grid gap-2"
            >
              <UInput
                v-model="form.address_complement"
                :disabled="!canUpdate"
                class="w-full"
                placeholder="Apto, sala..."
              />
            </UFormField>
          </div>

          <UFormField
            name="address_neighborhood"
            label="Bairro"
            class="grid gap-2"
          >
            <UInput
              v-model="form.address_neighborhood"
              :disabled="!canUpdate"
              class="w-full"
            />
          </UFormField>

          <div class="grid gap-4 grid-cols-2">
            <UFormField name="address_city" label="Cidade" class="grid gap-2">
              <UInput
                v-model="form.address_city"
                :disabled="!canUpdate"
                class="w-full"
                placeholder="Cidade"
              />
            </UFormField>

            <UFormField name="address_state" label="Estado" class="grid gap-2">
              <UInput
                v-model="form.address_state"
                :disabled="!canUpdate"
                maxlength="2"
                class="w-full uppercase"
                placeholder="UF"
              />
            </UFormField>
          </div>
        </div>
      </UPageCard>

      <!-- Fiscal -->
      <UPageCard variant="subtle" class="mb-4">
        <p
          class="text-xs font-semibold uppercase tracking-widest text-muted mb-4"
        >
          Fiscal
        </p>

        <div class="gap-4 grid grid-cols-2">
          <UFormField
            name="fiscal_regime"
            label="Regime tributário"
            class="grid gap-2"
          >
            <USelectMenu
              v-model="form.fiscal_regime"
              :items="fiscalRegimeOptions"
              value-key="value"
              :disabled="!canUpdate"
              class="w-full"
              placeholder="Selecionar..."
            />
          </UFormField>

          <UFormField
            name="municipal_registration"
            label="Inscrição municipal"
            class="grid gap-2"
          >
            <UInput
              v-model="form.municipal_registration"
              :disabled="!canUpdate"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="state_registration"
            label="Inscrição estadual"
            class="grid gap-2"
          >
            <UInput
              v-model="form.state_registration"
              :disabled="!canUpdate"
              class="w-full"
            />
          </UFormField>
        </div>
      </UPageCard>

      <!-- Sistema -->
      <UPageCard variant="subtle" class="mb-4">
        <p
          class="text-xs font-semibold uppercase tracking-widest text-muted mb-4"
        >
          Sistema
        </p>

        <UFormField
          name="initial_service_order_number"
          label="Número inicial de OS"
          description="As novas ordens de serviço serão numeradas a partir deste valor."
          class="grid gap-2"
        >
          <UInput
            v-model.number="form.initial_service_order_number"
            type="number"
            min="1"
            :disabled="!canUpdate"
            class="w-full sm:max-w-32"
          />
        </UFormField>
      </UPageCard>
    </template>
  </UForm>
</template>
