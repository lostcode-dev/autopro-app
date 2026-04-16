# Plano: Novo Step de Onboarding — Perfil de Marketing e Personas

## Objetivo

Coletar, durante o onboarding, informações que permitam entender o perfil de negócio e o público-alvo da oficina. Esses dados serão usados para:

- Personalizar dicas e sugestões dentro do sistema
- Segmentar a base de clientes para ações de marketing do produto
- Entender quais módulos são mais relevantes por perfil de oficina
- Alimentar relatórios internos de persona (product analytics)

---

## Contexto da implementação atual

O onboarding hoje tem **2 steps**:

```
Step 1: Dados da empresa  →  Step 2: Endereço  →  /api/organizations/complete-onboarding  →  /app
```

O step novo será o **Step 3** (opcional), inserido entre o Endereço e o redirecionamento final:

```
Step 1: Dados da empresa  →  Step 2: Endereço  →  Step 3: Perfil de marketing  →  /app
```

- Step 3 é **opcional** — haverá botão "Pular por agora"
- A flag `onboarding_completed = true` continua sendo setada no Step 2 (ou junto ao Step 3)
- Os dados de marketing são salvos em uma **tabela separada** para não poluir `organizations`

---

## Parte 1: Dados a Coletar no Step 3

### Bloco A — Quem são seus clientes principais
Campo: `main_customer_profiles` — múltipla escolha (array)

| Valor | Label |
|-------|-------|
| `individual_owner` | Proprietários de veículos (pessoa física) |
| `small_fleet` | Pequenas frotas (2 a 10 veículos) |
| `large_fleet` | Frotas corporativas (11+ veículos) |
| `car_dealers` | Revendedoras de veículos |
| `insurance` | Seguradoras / sinistros |

---

### Bloco B — Tipos de veículos atendidos
Campo: `vehicle_types` — múltipla escolha (array)

| Valor | Label |
|-------|-------|
| `cars` | Carros de passeio |
| `motorcycles` | Motocicletas |
| `light_commercial` | Utilitários leves (Fiorino, Kombi, vans) |
| `trucks` | Caminhões |
| `heavy` | Ônibus / veículos pesados |

---

### Bloco C — Serviços principais oferecidos
Campo: `primary_services` — múltipla escolha (array)

| Valor | Label |
|-------|-------|
| `mechanical` | Mecânica geral |
| `bodywork` | Funilaria e pintura |
| `electrical` | Elétrica automotiva |
| `tires` | Pneus, alinhamento e balanceamento |
| `preventive` | Revisão preventiva e troca de óleo |
| `air_conditioning` | Ar condicionado |

---

### Bloco D — Volume mensal
Campo: `monthly_vehicle_volume` — seleção única (string)

| Valor | Label |
|-------|-------|
| `up_to_20` | Até 20 veículos/mês |
| `21_to_50` | De 21 a 50 veículos/mês |
| `51_to_100` | De 51 a 100 veículos/mês |
| `above_100` | Acima de 100 veículos/mês |

---

### Bloco E — Como seus clientes te encontram (canais)
Campo: `acquisition_channels` — múltipla escolha (array)

| Valor | Label |
|-------|-------|
| `referral` | Indicação de clientes |
| `social_media` | Redes sociais (Instagram, Facebook) |
| `google` | Google / buscadores |
| `whatsapp` | WhatsApp |
| `physical_signage` | Fachada / sinalização física |
| `partnerships` | Parcerias (seguradoras, concessionárias) |

---

### Bloco F — Como conheceu o sistema (para nosso marketing interno)
Campo: `acquisition_source` — seleção única (string)

| Valor | Label |
|-------|-------|
| `google` | Google / pesquisa online |
| `social_media` | Redes sociais |
| `referral` | Indicação de colega / conhecido |
| `event` | Evento ou feira do setor |
| `other` | Outro |

---

## Parte 2: Schema — Nova Tabela `organization_marketing`

Criar tabela separada para não poluir `organizations`. Permite evoluir o questionário sem migrations na tabela principal.

```sql
-- Migration: NEW_create_organization_marketing.sql
CREATE TABLE public.organization_marketing (
  id                      uuid          NOT NULL DEFAULT gen_random_uuid(),
  organization_id         uuid          NOT NULL,

  -- Personas / clientes
  main_customer_profiles  text[]        DEFAULT '{}',   -- ['individual_owner', 'small_fleet', ...]
  vehicle_types           text[]        DEFAULT '{}',   -- ['cars', 'motorcycles', ...]
  primary_services        text[]        DEFAULT '{}',   -- ['mechanical', 'bodywork', ...]

  -- Volume e alcance
  monthly_vehicle_volume  varchar(20),                  -- 'up_to_20' | '21_to_50' | ...

  -- Canais e objetivos
  acquisition_channels    text[]        DEFAULT '{}',   -- ['referral', 'google', ...]
  marketing_goal          varchar(50),                  -- 'attract_new' | ...

  -- Para analytics interno do produto
  acquisition_source      varchar(50),                  -- 'google' | 'referral' | ...

  -- Audit
  created_at              timestamptz   NOT NULL DEFAULT now(),
  created_by              varchar(200),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  updated_by              varchar(200),

  CONSTRAINT organization_marketing_pkey
    PRIMARY KEY (id),
  CONSTRAINT organization_marketing_org_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE CASCADE,
  CONSTRAINT organization_marketing_org_unique
    UNIQUE (organization_id)   -- 1 linha por org
);

COMMENT ON TABLE  public.organization_marketing IS 'Perfil de marketing e personas da oficina. Coletado no onboarding, usado para personalização e analytics.';
COMMENT ON COLUMN public.organization_marketing.main_customer_profiles IS 'Perfil dos clientes principais: individual_owner, small_fleet, large_fleet, car_dealers, insurance.';
COMMENT ON COLUMN public.organization_marketing.vehicle_types          IS 'Tipos de veículos atendidos: cars, motorcycles, light_commercial, trucks, heavy.';
COMMENT ON COLUMN public.organization_marketing.primary_services       IS 'Serviços principais: mechanical, bodywork, electrical, tires, preventive, air_conditioning.';
COMMENT ON COLUMN public.organization_marketing.monthly_vehicle_volume IS 'Volume mensal: up_to_20, 21_to_50, 51_to_100, above_100.';
COMMENT ON COLUMN public.organization_marketing.acquisition_channels   IS 'Canais de aquisição de clientes: referral, social_media, google, whatsapp, physical_signage, partnerships.';
COMMENT ON COLUMN public.organization_marketing.marketing_goal         IS 'Objetivo principal de marketing da oficina.';
COMMENT ON COLUMN public.organization_marketing.acquisition_source     IS 'Como o dono da oficina conheceu o sistema (uso interno).';

CREATE TRIGGER trg_organization_marketing_updated_at
  BEFORE UPDATE ON public.organization_marketing
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS: leitura apenas pela própria org; escrita apenas por service_role (API)
ALTER TABLE public.organization_marketing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_marketing_select_own_org"
  ON public.organization_marketing
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());
```

---

## Parte 3: Novo Endpoint de API

**Arquivo**: `server/api/organizations/save-marketing.post.ts`

```typescript
// POST /api/organizations/save-marketing
// Salva perfil de marketing da organização — chamado ao concluir o Step 3.
// Todos os campos são opcionais (step pode ser pulado).

import { z } from 'zod'
import { requireAuthUser } from '../../utils/require-auth'
import { getSupabaseAdminClient } from '../../utils/supabase'

const schema = z.object({
  main_customer_profiles:  z.array(z.string()).optional().default([]),
  vehicle_types:           z.array(z.string()).optional().default([]),
  primary_services:        z.array(z.string()).optional().default([]),
  monthly_vehicle_volume:  z.string().nullable().optional(),
  acquisition_channels:    z.array(z.string()).optional().default([]),
  marketing_goal:          z.string().nullable().optional(),
  acquisition_source:      z.string().nullable().optional(),
})

export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const body = await readBody(event)
  const data = schema.parse(body)

  // Buscar organization_id do usuário
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 400, statusMessage: 'Organização não encontrada' })

  // Upsert — pode ser chamado várias vezes (idempotente)
  const { error } = await supabase
    .from('organization_marketing')
    .upsert({
      organization_id: profile.organization_id,
      ...data,
      updated_by: authUser.email,
      created_by: authUser.email,
    }, { onConflict: 'organization_id' })

  if (error)
    throw createError({ statusCode: 500, statusMessage: 'Erro ao salvar perfil de marketing' })

  return { ok: true }
})
```

---

## Parte 4: Alterações no `onboarding.vue`

### 4.1 Tipo do step

```typescript
// Antes
const step = ref<'company' | 'address'>('company')

// Depois
const step = ref<'company' | 'address' | 'marketing'>('company')
```

### 4.2 Novo estado do formulário de marketing

```typescript
const marketingForm = reactive({
  main_customer_profiles:  [] as string[],
  vehicle_types:           [] as string[],
  primary_services:        [] as string[],
  monthly_vehicle_volume:  null as string | null,
  acquisition_channels:    [] as string[],
  marketing_goal:          null as string | null,
  acquisition_source:      null as string | null,
})
```

### 4.3 Fluxo de submit em duas chamadas

```typescript
async function submit() {
  loading.value = true
  try {
    // 1. Salvar dados da empresa + endereço (já existente)
    await $fetch('/api/organizations/complete-onboarding', {
      method: 'POST',
      body: { /* campos atuais */ }
    })

    // 2. Avançar para step de marketing
    step.value = 'marketing'
  } catch (err) {
    // toast de erro
  } finally {
    loading.value = false
  }
}

async function submitMarketing(skip = false) {
  loading.value = true
  try {
    if (!skip) {
      await $fetch('/api/organizations/save-marketing', {
        method: 'POST',
        body: marketingForm
      })
    }

    await bootstrap.fetchBootstrap(true)
    toast.add({ title: 'Configuração concluída!', description: 'Bem-vindo ao sistema.', color: 'success' })
    await router.push('/app')
  } catch {
    toast.add({ title: 'Erro ao salvar', description: 'Tente novamente.', color: 'error' })
  } finally {
    loading.value = false
  }
}
```

### 4.4 Progress indicator — de 2 para 3 steps

```html
<!-- Step 1 → Step 2 → Step 3 -->
<div class="flex items-center gap-3">
  <!-- Step 1: Dados da empresa -->
  <StepIndicator number="1" :done="step !== 'company'" :active="step === 'company'" label="Dados da empresa" />
  <div class="flex-1 h-px bg-border" />

  <!-- Step 2: Endereço -->
  <StepIndicator number="2" :done="step === 'marketing'" :active="step === 'address'" label="Endereço" />
  <div class="flex-1 h-px bg-border" />

  <!-- Step 3: Perfil de marketing -->
  <StepIndicator number="3" :active="step === 'marketing'" label="Seu negócio" />
</div>
```

### 4.5 UI do Step 3 — estrutura dos campos

```html
<!-- Step 3: Marketing -->
<div v-if="step === 'marketing'" class="space-y-6">

  <!-- Bloco A: Clientes principais -->
  <UFormField label="Quem são seus principais clientes?" hint="Selecione todos que se aplicam">
    <CheckboxGroup v-model="marketingForm.main_customer_profiles" :options="mainCustomerOptions" />
  </UFormField>

  <!-- Bloco B: Tipos de veículos -->
  <UFormField label="Quais tipos de veículos você atende?">
    <CheckboxGroup v-model="marketingForm.vehicle_types" :options="vehicleTypeOptions" />
  </UFormField>

  <!-- Bloco C: Serviços -->
  <UFormField label="Quais são seus principais serviços?">
    <CheckboxGroup v-model="marketingForm.primary_services" :options="primaryServiceOptions" />
  </UFormField>

  <!-- Bloco D: Volume -->
  <UFormField label="Quantos veículos você atende por mês?" hint="Estimativa aproximada">
    <RadioGroup v-model="marketingForm.monthly_vehicle_volume" :options="volumeOptions" />
  </UFormField>

  <!-- Bloco E: Canais de aquisição -->
  <UFormField label="Como seus clientes te encontram?">
    <CheckboxGroup v-model="marketingForm.acquisition_channels" :options="acquisitionChannelOptions" />
  </UFormField>

  <!-- Bloco F: Objetivo de marketing -->
  <UFormField label="Qual é seu principal objetivo com clientes?">
    <RadioGroup v-model="marketingForm.marketing_goal" :options="marketingGoalOptions" />
  </UFormField>

  <!-- Bloco G: Como conheceu o sistema -->
  <UFormField label="Como você ficou sabendo do sistema?">
    <RadioGroup v-model="marketingForm.acquisition_source" :options="acquisitionSourceOptions" />
  </UFormField>
</div>
```

### 4.6 Footer do Step 3

```html
<template #footer>
  <div class="flex items-center justify-between gap-3">
    <UButton variant="ghost" color="neutral" leading-icon="i-lucide-arrow-left" @click="step = 'address'">
      Voltar
    </UButton>

    <div class="flex gap-2">
      <UButton variant="ghost" color="neutral" @click="submitMarketing(true)">
        Pular por agora
      </UButton>
      <UButton color="primary" trailing-icon="i-lucide-check" :loading="loading" @click="submitMarketing(false)">
        Concluir
      </UButton>
    </div>
  </div>
</template>
```

---

## Parte 5: Uso Futuro dos Dados

### Personalização no sistema
```typescript
// Exemplo: adaptar boas-vindas com base no perfil
const { data: marketing } = await supabase
  .from('organization_marketing')
  .select('primary_services, monthly_vehicle_volume, marketing_goal')
  .eq('organization_id', orgId)
  .maybeSingle()

// Se atende frotas → mostrar módulo de gestão de frotas em destaque
// Se objetivo é fidelização → mostrar módulo de histórico do cliente em destaque
// Se volume alto → sugerir integração com peças / fornecedores
```

### Analytics interno (Supabase Dashboard / BI)
```sql
-- Distribuição por objetivo de marketing
SELECT marketing_goal, count(*) as total
FROM organization_marketing
GROUP BY marketing_goal
ORDER BY total DESC;

-- Serviços mais comuns entre oficinas ativas
SELECT unnest(primary_services) AS service, count(*) AS total
FROM organization_marketing
  JOIN organizations o ON o.id = organization_id
  JOIN subscriptions s ON s.organization_id = o.id
WHERE s.status = 'active'
GROUP BY service
ORDER BY total DESC;
```

---

## Parte 6: Checklist de Implementação

### Fase 1 — Backend
- [ ] Criar migração `organization_marketing` com todos os campos, constraints e RLS
- [ ] Criar endpoint `POST /api/organizations/save-marketing` com Zod schema
- [ ] Adicionar `organization_marketing` ao retorno do endpoint `/api/users/initial-data` (para saber se já foi preenchido)

### Fase 2 — Frontend
- [ ] Adicionar `step = 'marketing'` ao tipo do `step` ref
- [ ] Criar `marketingForm` reactive com todos os campos
- [ ] Atualizar progress indicator de 2 para 3 steps
- [ ] Implementar template HTML do Step 3 com os 7 blocos de pergunta
- [ ] Criar constantes de opções (arrays `label + value`) para cada campo
- [ ] Ajustar `submit()` do Step 2 para avançar ao Step 3 em vez de redirecionar
- [ ] Implementar `submitMarketing(skip: boolean)`
- [ ] Adicionar botão "Pular por agora" no footer do Step 3

### Fase 3 — Qualidade
- [ ] Garantir que pular o Step 3 não bloqueia acesso ao `/app`
- [ ] Testar que re-entrar no onboarding (se disponível) não duplica o registro (upsert garante isso)
- [ ] Verificar RLS: usuário só lê os dados da própria org

---

## Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/NEW_create_organization_marketing.sql` | Criar |
| `server/api/organizations/save-marketing.post.ts` | Criar |
| `server/api/users/initial-data.post.ts` | Modificar — incluir dados de marketing no retorno |
| `app/pages/onboarding.vue` | Modificar — adicionar Step 3 completo |
| `app/types/onboarding.ts` | Modificar — adicionar tipos do perfil de marketing |
