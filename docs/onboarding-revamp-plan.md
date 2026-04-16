# Plano: Revisão Completa dos Steps de Onboarding (Empresa + Endereço)

## Contexto

A tabela `organizations` **já possui todas as colunas necessárias** (criadas em `20240101000001_create_organizations.sql`). O que falta é:

1. O endpoint `complete-onboarding` não persiste `business_type`, `state_registration`, `website`, `address_complement`, `initial_service_order_number`, `notes`
2. O form do Step 1 não tem campos de logo, tipo de negócio, inscrição estadual, site
3. O form do Step 2 não tem complemento, UF como select real, nem integração de CEP
4. Não há infraestrutura de upload de logo (sem bucket no Supabase Storage, sem endpoint)

**Nenhuma migration é necessária** — todos os campos já existem na tabela.

---

## Campos por Step — Estado atual vs. Desejado

### Step 1: Dados da Empresa

| Campo | Coluna DB | Obrigatório | Situação atual |
|-------|-----------|-------------|----------------|
| Logo da oficina | `logo_url` | Não | Ausente no form |
| Nome da oficina | `name` | **Sim** | Presente |
| Tipo de pessoa | `person_type` | **Sim** | Presente |
| Tipo de negócio | `business_type` | Não | Ausente no form |
| CNPJ / CPF | `tax_id` | Não | Presente |
| Inscrição Estadual | `state_registration` | Não | Ausente no form |
| Telefone | `phone` | **Sim** | Presente |
| WhatsApp | `whatsapp` | Não | Presente |
| E-mail | `email` | Não | Presente |
| Site | `website` | Não | Ausente no form |

### Step 2: Endereço

| Campo | Coluna DB | Obrigatório | Situação atual |
|-------|-----------|-------------|----------------|
| CEP | `zip_code` | Não | Presente, sem lookup |
| Logradouro | `street` | Não | Presente |
| Número | `address_number` | Não | Presente |
| Complemento | `address_complement` | Não | Ausente no form |
| Bairro | `neighborhood` | Não | Presente |
| Cidade | `city` | Não | Presente |
| Estado (UF) | `state` | Não | Input livre, sem select |

### Step 3: Configurações do Sistema *(novo — inserido antes do marketing)*

| Campo | Coluna DB | Obrigatório | Situação atual |
|-------|-----------|-------------|----------------|
| Número Inicial das OS | `initial_service_order_number` | Não (default 1) | Ausente no form |
| Observações Gerais | `notes` | Não | Ausente no form |

> Step 3 (configurações) → Step 4 (marketing/personas, já documentado em `onboarding-marketing-step-plan.md`)

---

## Parte 1: Upload de Logo

### Infraestrutura necessária: Supabase Storage

**Criar bucket** `organization-logos` via migration de storage (ou manualmente no dashboard):

```sql
-- Em supabase/migrations/NEW_create_storage_organization_logos.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,                                           -- público: logo exibida sem auth
  5242880,                                        -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: apenas o dono da org pode fazer upload/delete no próprio prefixo
CREATE POLICY "org_logo_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );

CREATE POLICY "org_logo_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );

CREATE POLICY "org_logo_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'organization-logos');
```

**Convenção de path**: `organization-logos/{organization_id}/logo.{ext}`
- Sempre o mesmo nome → sobrescreve sem acumular arquivos
- Invalidação de cache via query string `?v={timestamp}` no frontend

### Endpoint de upload

**Arquivo**: `server/api/organizations/upload-logo.post.ts`

```typescript
// POST /api/organizations/upload-logo
// Recebe multipart/form-data com campo "logo" (File)
// Faz upload para Supabase Storage e atualiza organizations.logo_url

import { requireAuthUser } from '../../utils/require-auth'
import { getSupabaseAdminClient } from '../../utils/supabase'

const BUCKET = 'organization-logos'
const MAX_SIZE = 5 * 1024 * 1024   // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const formData = await readFormData(event)
  const file = formData.get('logo') as File | null

  if (!file)
    throw createError({ statusCode: 400, statusMessage: 'Arquivo não enviado' })
  if (!ALLOWED_TYPES.includes(file.type))
    throw createError({ statusCode: 400, statusMessage: 'Formato inválido. Use JPEG, PNG ou WebP.' })
  if (file.size > MAX_SIZE)
    throw createError({ statusCode: 400, statusMessage: 'Arquivo muito grande. Máximo: 5MB.' })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Organização não encontrada' })

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${profile.organization_id}/logo.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true   // sobrescreve logo anterior
    })

  if (uploadError)
    throw createError({ statusCode: 500, statusMessage: 'Erro ao fazer upload: ' + uploadError.message })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const logoUrl = `${publicUrl}?v=${Date.now()}`

  await supabase
    .from('organizations')
    .update({ logo_url: logoUrl, updated_by: authUser.email })
    .eq('id', profile.organization_id)

  return { logo_url: logoUrl }
})
```

### Endpoint de remoção

**Arquivo**: `server/api/organizations/remove-logo.delete.ts`

```typescript
// DELETE /api/organizations/remove-logo
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403 })

  const extensions = ['jpg', 'png', 'webp']
  for (const ext of extensions) {
    await supabase.storage
      .from('organization-logos')
      .remove([`${profile.organization_id}/logo.${ext}`])
  }

  await supabase
    .from('organizations')
    .update({ logo_url: null, updated_by: authUser.email })
    .eq('id', profile.organization_id)

  return { ok: true }
})
```

### UI do componente de logo no onboarding

```html
<!-- LogoUpload.vue ou inline no onboarding.vue -->
<div class="flex items-center gap-6">
  <!-- Preview -->
  <div class="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted">
    <img v-if="logoPreview" :src="logoPreview" class="w-full h-full object-cover" alt="Logo" />
    <UIcon v-else name="i-lucide-image" class="w-8 h-8 text-muted" />
  </div>

  <!-- Ações -->
  <div class="space-y-2">
    <div class="flex gap-2">
      <UButton size="sm" variant="outline" @click="$refs.logoInput.click()">
        Selecionar Logo
      </UButton>
      <UButton v-if="logoPreview" size="sm" variant="ghost" color="error" @click="removeLogo">
        Remover
      </UButton>
    </div>
    <p class="text-xs text-muted">
      Formatos aceitos: JPEG, PNG, WebP · Máximo: 5MB · Recomendado: 200×200px ou maior
    </p>
    <input ref="logoInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onLogoSelected" />
  </div>
</div>
```

```typescript
// Estado e handlers do logo
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)   // URL para exibição local (FileReader)
const logoUploading = ref(false)

function onLogoSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Validação cliente (UX rápida antes do upload)
  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'Arquivo muito grande', description: 'Máximo: 5MB', color: 'error' })
    return
  }

  logoFile.value = file
  // Preview local via FileReader
  const reader = new FileReader()
  reader.onload = (e) => { logoPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

async function uploadLogoIfNeeded(): Promise<string | null> {
  if (!logoFile.value) return null

  logoUploading.value = true
  try {
    const formData = new FormData()
    formData.append('logo', logoFile.value)
    const result = await $fetch<{ logo_url: string }>('/api/organizations/upload-logo', {
      method: 'POST',
      body: formData
    })
    return result.logo_url
  } finally {
    logoUploading.value = false
  }
}

async function removeLogo() {
  await $fetch('/api/organizations/remove-logo', { method: 'DELETE' })
  logoFile.value = null
  logoPreview.value = null
}
```

> **Timing do upload**: o logo é enviado **durante o submit do Step 1** (antes de chamar `/complete-onboarding`), ou de forma assíncrona ao selecionar. A abordagem mais simples: fazer o upload no submit do Step 1 e usar a URL retornada no payload do onboarding.

---

## Parte 2: Integração de CEP (ViaCEP)

### API usada: ViaCEP (gratuita, sem autenticação)

URL: `https://viacep.com.br/ws/{cep}/json/`

### Implementação no composable

**Arquivo**: `app/composables/useCepLookup.ts`

```typescript
export interface CepResult {
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  ibge: string    // código do município — já temos municipality_code na tabela!
  erro?: boolean
}

export function useCepLookup() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function lookup(cep: string): Promise<CepResult | null> {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return null

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<CepResult>(`https://viacep.com.br/ws/${digits}/json/`)
      if (data.erro) {
        error.value = 'CEP não encontrado'
        return null
      }
      return data
    } catch {
      error.value = 'Erro ao buscar CEP'
      return null
    } finally {
      loading.value = false
    }
  }

  return { lookup, loading, error }
}
```

### Uso no Step 2 do onboarding

```typescript
const { lookup: lookupCep, loading: cepLoading, error: cepError } = useCepLookup()

async function onCepChange(value: string) {
  if (value.replace(/\D/g, '').length !== 8) return

  const result = await lookupCep(value)
  if (!result) return

  // Auto-preencher campos — só sobrescreve se o campo estiver vazio
  if (!form.street)       form.street       = result.logradouro
  if (!form.neighborhood) form.neighborhood = result.bairro
  if (!form.city)         form.city         = result.localidade
  if (!form.state)        form.state        = result.uf
  // Bonus: salvar código IBGE para uso futuro em NFS-e
  form.municipality_code = result.ibge
}
```

```html
<!-- No template, campo CEP com indicador de loading -->
<UFormField label="CEP">
  <UInput
    v-model="form.zip_code"
    placeholder="00000-000"
    :loading="cepLoading"
    :trailing-icon="cepLoading ? 'i-lucide-loader' : undefined"
    class="w-full"
    @update:model-value="onCepChange"
  />
  <p v-if="cepError" class="mt-1 text-xs text-error">{{ cepError }}</p>
</UFormField>
```

---

## Parte 3: Select de UF (todos os estados)

Substituir o `UInput` de `state` por um `USelectMenu` com as 27 UFs:

```typescript
const UF_OPTIONS = [
  { label: 'AC — Acre',                value: 'AC' },
  { label: 'AL — Alagoas',             value: 'AL' },
  { label: 'AP — Amapá',               value: 'AP' },
  { label: 'AM — Amazonas',            value: 'AM' },
  { label: 'BA — Bahia',               value: 'BA' },
  { label: 'CE — Ceará',               value: 'CE' },
  { label: 'DF — Distrito Federal',    value: 'DF' },
  { label: 'ES — Espírito Santo',      value: 'ES' },
  { label: 'GO — Goiás',               value: 'GO' },
  { label: 'MA — Maranhão',            value: 'MA' },
  { label: 'MT — Mato Grosso',         value: 'MT' },
  { label: 'MS — Mato Grosso do Sul',  value: 'MS' },
  { label: 'MG — Minas Gerais',        value: 'MG' },
  { label: 'PA — Pará',                value: 'PA' },
  { label: 'PB — Paraíba',             value: 'PB' },
  { label: 'PR — Paraná',              value: 'PR' },
  { label: 'PE — Pernambuco',          value: 'PE' },
  { label: 'PI — Piauí',               value: 'PI' },
  { label: 'RJ — Rio de Janeiro',      value: 'RJ' },
  { label: 'RN — Rio Grande do Norte', value: 'RN' },
  { label: 'RS — Rio Grande do Sul',   value: 'RS' },
  { label: 'RO — Rondônia',            value: 'RO' },
  { label: 'RR — Roraima',             value: 'RR' },
  { label: 'SC — Santa Catarina',      value: 'SC' },
  { label: 'SP — São Paulo',           value: 'SP' },
  { label: 'SE — Sergipe',             value: 'SE' },
  { label: 'TO — Tocantins',           value: 'TO' },
]
```

---

## Parte 4: Tipos de Negócio

Campo `business_type` no Step 1 como `USelectMenu`:

```typescript
const BUSINESS_TYPE_OPTIONS = [
  { label: 'Mecânica Geral',          value: 'mecanica_geral' },
  { label: 'Funilaria e Pintura',     value: 'funilaria_pintura' },
  { label: 'Elétrica Automotiva',     value: 'eletrica' },
  { label: 'Multimarcas',             value: 'multimarcas' },
  { label: 'Concessionária',          value: 'concessionaria' },
  { label: 'Retificadora de Motor',   value: 'retificadora' },
  { label: 'Pneus e Alinhamento',     value: 'pneus' },
  { label: 'Ar Condicionado',         value: 'ar_condicionado' },
  { label: 'Injeção Eletrônica',      value: 'injecao_eletronica' },
  { label: 'Outro',                   value: 'outro' },
]
```

---

## Parte 5: Validações por Campo

### Step 1 — Regras de validação (cliente + servidor)

| Campo | Regra | Mensagem de erro |
|-------|-------|-----------------|
| Nome | Obrigatório, mín 2 chars | "Nome da oficina obrigatório (mínimo 2 caracteres)" |
| Tipo de pessoa | Obrigatório, enum `pf|pj` | "Selecione o tipo de pessoa" |
| Tipo de negócio | Opcional | — |
| CNPJ/CPF | Opcional; se preenchido: 14 dígitos (PJ) ou 11 dígitos (PF) | "CNPJ inválido" / "CPF inválido" |
| Inscrição Estadual | Opcional | — |
| Telefone | Obrigatório, mín 10 dígitos | "Informe um telefone válido" |
| WhatsApp | Opcional; se preenchido: mín 10 dígitos | "WhatsApp inválido" |
| E-mail | Opcional; se preenchido: formato válido | "E-mail inválido" |
| Site | Opcional | — |

### Step 2 — Regras de validação

| Campo | Regra | Mensagem de erro |
|-------|-------|-----------------|
| CEP | Opcional; se preenchido: 8 dígitos | "CEP inválido" |
| Logradouro | Opcional | — |
| Número | Opcional | — |
| Complemento | Opcional | — |
| Bairro | Opcional | — |
| Cidade | Opcional | — |
| Estado (UF) | Opcional; se preenchido: valor da lista | "Selecione um estado válido" |

### Step 3 (Configurações) — Regras de validação

| Campo | Regra | Mensagem de erro |
|-------|-------|-----------------|
| Número inicial das OS | Opcional; se preenchido: inteiro positivo ≥ 1 | "Número deve ser maior que zero" |
| Observações | Opcional, máx 1000 chars | "Limite de 1000 caracteres" |

---

## Parte 6: Atualizar Endpoint `complete-onboarding`

O endpoint atual (`server/api/organizations/complete-onboarding.post.ts`) precisa incluir os campos ausentes no schema Zod e no update:

```typescript
// Schema atualizado
const schema = z.object({
  // Campos já existentes
  name:            z.string().min(2),
  person_type:     z.enum(['pf', 'pj']),
  tax_id:          z.string().optional().nullable(),
  phone:           z.string().min(10, 'Telefone inválido'),
  whatsapp:        z.string().min(10).optional().nullable(),
  email:           z.string().email().optional().nullable().or(z.literal('')),

  // Campos novos a adicionar
  business_type:                z.string().optional().nullable(),
  state_registration:           z.string().optional().nullable(),
  website:                      z.string().url().optional().nullable().or(z.literal('')),

  // Endereço
  zip_code:                     z.string().optional().nullable(),
  street:                       z.string().optional().nullable(),
  address_number:               z.string().optional().nullable(),
  address_complement:           z.string().optional().nullable(),   // NOVO
  neighborhood:                 z.string().optional().nullable(),
  city:                         z.string().optional().nullable(),
  state:                        z.string().length(2).optional().nullable(),
  municipality_code:            z.string().optional().nullable(),   // NOVO (vindo do ViaCEP)

  // Configurações do sistema
  initial_service_order_number: z.number().int().min(1).optional().nullable(),
  notes:                        z.string().max(1000).optional().nullable(),
})
```

---

## Parte 7: Fluxo Completo Revisado

```
Step 1: Dados da Empresa
  ├─ Logo (upload ao selecionar ou no submit)
  ├─ Nome * | Tipo de pessoa * | Tipo de negócio
  ├─ CNPJ/CPF | Inscrição Estadual
  ├─ Telefone * | WhatsApp | E-mail | Site
  └─ [Continuar]
        ↓
Step 2: Endereço
  ├─ CEP (→ auto-preenche logradouro, bairro, cidade, UF, código IBGE)
  ├─ Logradouro | Número | Complemento
  ├─ Bairro | Cidade | Estado (select)
  └─ [Voltar] [Continuar]
        ↓
Step 3: Configurações do Sistema
  ├─ Número inicial das OS (hint: "a partir de qual número criar as próximas OSs")
  ├─ Observações gerais
  └─ [Voltar] [Continuar]
        ↓ POST /api/organizations/complete-onboarding (todos os campos)
        ↓
Step 4: Perfil de Marketing (opcional)
  └─ ver onboarding-marketing-step-plan.md
        ↓ POST /api/organizations/save-marketing
        ↓
/app
```

---

## Parte 8: Checklist de Implementação

### Fase 1 — Infraestrutura de logo
- [ ] Criar migration `NEW_create_storage_organization_logos.sql` (bucket + RLS)
- [ ] Criar endpoint `POST /api/organizations/upload-logo`
- [ ] Criar endpoint `DELETE /api/organizations/remove-logo`

### Fase 2 — Atualizar endpoint de onboarding
- [ ] Adicionar campos ausentes ao schema Zod em `complete-onboarding.post.ts`
- [ ] Garantir que todos os campos novos são passados no `.update()`

### Fase 3 — Composable de CEP
- [ ] Criar `app/composables/useCepLookup.ts`
- [ ] Tratar erro "CEP não encontrado" com toast informativo (não bloquear)

### Fase 4 — Atualizar `onboarding.vue`
- [ ] Step 1: adicionar LogoUpload, business_type, state_registration, website
- [ ] Step 1: adicionar validação de CPF/CNPJ (formato) se preenchido
- [ ] Step 2: integrar useCepLookup no campo CEP
- [ ] Step 2: substituir input de UF por USelectMenu com 27 estados
- [ ] Step 2: adicionar campo `address_complement`
- [ ] Step 3 (novo): adicionar campos `initial_service_order_number` e `notes`
- [ ] Atualizar progress indicator de 2 para 4 steps (empresa, endereço, configurações, marketing)
- [ ] Mover submit final para após Step 3 (Step 4 — marketing — é opcional)

### Fase 5 — Pré-carregamento de dados existentes
- [ ] Garantir que `onMounted` também pré-preenche `business_type`, `state_registration`, `website`, `address_complement`, `initial_service_order_number`, `notes`, `logo_url`

---

## Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/NEW_create_storage_organization_logos.sql` | Criar |
| `server/api/organizations/upload-logo.post.ts` | Criar |
| `server/api/organizations/remove-logo.delete.ts` | Criar |
| `server/api/organizations/complete-onboarding.post.ts` | Modificar — schema + campos |
| `app/composables/useCepLookup.ts` | Criar |
| `app/pages/onboarding.vue` | Modificar — Steps 1, 2 e novo Step 3 |

> **Sem novas migrations de tabela** — todos os campos já existem em `organizations`.
