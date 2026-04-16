# Plano: Cobertura Completa de Eventos de Invoice no Stripe

## Contexto e Problemas Atuais

### Implementação atual (estado)
O sistema possui **duas implementações paralelas** de webhook:
1. **Supabase Edge Function** (`supabase/functions/stripe-webhook/index.ts`) — preferida, lida com org + subscription
2. **Nuxt Server API** (`server/api/stripe/webhook.post.ts`) — legada, parcialmente redundante

### Problemas identificados
1. **Clientes duplicados no Stripe**: Ao cancelar e assinar novamente, pode ser criado um novo `customer` no Stripe em vez de reutilizar o existente.
2. **Eventos de invoice não cobertos**: Apenas `invoice.paid`, `invoice.payment_succeeded` e `invoice.payment_failed` são tratados. Os demais 18 eventos são ignorados ou caem em um fallback genérico.
3. **Sincronização de status inconsistente**: Não há garantia que `billing_invoices` reflita todos os estados possíveis de uma fatura.

---

## Parte 1: Garantir Customer Único por Usuário

### O problema
O checkout atual verifica `user_profiles.stripe_customer_id`, mas:
- Se o campo estiver vazio (usuário cancelou e a coluna foi limpa), cria um novo customer.
- Não consulta a API do Stripe para verificar se já existe um customer com aquele e-mail.

### Solução: "Get or Create" com fallback na API do Stripe

**Arquivo a modificar**: `server/api/stripe/checkout.post.ts` (linhas 44–60)

```typescript
async function getOrCreateStripeCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  userId: string,
  email: string,
  displayName: string
): Promise<string> {
  // 1. Verificar na tabela local primeiro
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    // Validar que o customer ainda existe no Stripe
    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id)
      if (!customer.deleted) return profile.stripe_customer_id
    } catch {
      // Customer não encontrado no Stripe, continuar
    }
  }

  // 2. Buscar por e-mail no Stripe (evita duplicatas)
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) {
    const customerId = existing.data[0].id
    // Salvar localmente para próximas vezes
    await supabase
      .from('user_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId)
    return customerId
  }

  // 3. Criar novo customer apenas se não existir
  const customer = await stripe.customers.create({
    email,
    name: displayName,
    metadata: { user_id: userId, user_email: email },
  })
  await supabase
    .from('user_profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)
  return customer.id
}
```

**Regra**: `stripe_customer_id` em `user_profiles` NUNCA deve ser apagado, mesmo após cancelamento. O cancelamento é um estado da *subscription*, não do *customer*.

---

## Parte 2: Mapa Completo de Eventos de Invoice

### Eventos selecionados e o que cada um significa para o negócio

| Evento | Trigger | Ação no sistema |
|--------|---------|-----------------|
| `invoice.created` | Nova fatura criada (draft) | Registrar com status `draft` |
| `invoice.finalized` | Fatura finalizada (aberta para cobrança) | Atualizar status para `open` |
| `invoice.paid` | Pagamento bem-sucedido | Status `paid`, ativar org |
| `invoice.payment_succeeded` | Alias de `invoice.paid` em alguns planos | Idem |
| `invoice.payment_failed` | Cobrança falhou | Status `failed`, notificar usuário |
| `invoice.payment_action_required` | Requer ação do usuário (ex: 3DS) | Status `action_required`, notificar usuário |
| `invoice.payment_attempt_required` | Requer nova tentativa de cobrança | Status `pending`, notificar usuário |
| `invoice.upcoming` | Aviso N dias antes da próxima cobrança | Apenas notificação preventiva (sem salvar invoice — não tem ID) |
| `invoice.will_be_due` | Fatura vai vencer em breve | Notificar usuário |
| `invoice.overdue` | Fatura vencida | Status `overdue`, suspender org após grace period |
| `invoice.marked_uncollectible` | Marcada como incobrável | Status `uncollectible`, cancelar org |
| `invoice.voided` | Anulada manualmente | Status `voided` |
| `invoice.deleted` | Rascunho deletado | Remover registro (soft delete) |
| `invoice.finalization_failed` | Erro ao finalizar rascunho | Status `finalization_failed`, logar erro |
| `invoice.sent` | E-mail de fatura enviado ao cliente | Registrar `sent_at` timestamp |
| `invoice.updated` | Qualquer alteração na fatura | Sincronizar campos alterados |
| `invoice.overpaid` | Pagamento maior que o valor | Status `paid`, registrar `amount_overpaid` |
| `invoice_payment.paid` | InvoicePayment pago | Confirmar pagamento (complementar a `invoice.paid`) |
| `invoiceitem.created` | Item adicionado à fatura | Opcional: logar para auditoria |
| `invoiceitem.deleted` | Item removido da fatura | Opcional: logar para auditoria |
| `customer.subscription.pending_update_expired` | Update pendente expirou | Atualizar subscription, notificar admin |

---

## Parte 3: Schema da Tabela `billing_invoices` (revisão)

### Campos a adicionar na migração

```sql
ALTER TABLE public.billing_invoices
  -- Status expandido para cobrir todos os estados
  DROP CONSTRAINT billing_invoices_status_check,
  ADD CONSTRAINT billing_invoices_status_check
    CHECK (status IN (
      'draft',
      'open',
      'paid',
      'failed',
      'action_required',
      'pending',
      'overdue',
      'uncollectible',
      'voided',
      'finalization_failed'
    )),

  -- Novos campos
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(100),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_overpaid numeric(15,2),
  ADD COLUMN IF NOT EXISTS collection_method varchar(50),  -- charge_automatically | send_invoice
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_payment_attempt timestamptz,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url varchar(500),
  ADD COLUMN IF NOT EXISTS raw_data jsonb;  -- payload completo do Stripe para auditoria

CREATE INDEX IF NOT EXISTS billing_invoices_stripe_customer_id_idx
  ON public.billing_invoices (stripe_customer_id);
```

---

## Parte 4: Handler Unificado de Invoice (Supabase Edge Function)

### Estrutura proposta em `supabase/functions/stripe-webhook/index.ts`

```typescript
// Mapa: evento Stripe → status local
const INVOICE_STATUS_MAP: Record<string, string> = {
  'invoice.created':                 'draft',
  'invoice.finalized':               'open',
  'invoice.paid':                    'paid',
  'invoice.payment_succeeded':       'paid',
  'invoice.payment_failed':          'failed',
  'invoice.payment_action_required': 'action_required',
  'invoice.payment_attempt_required':'pending',
  'invoice.overdue':                 'overdue',
  'invoice.marked_uncollectible':    'uncollectible',
  'invoice.voided':                  'voided',
  'invoice.finalization_failed':     'finalization_failed',
  'invoice.sent':                    'open',      // mantém open, atualiza sent_at
  'invoice.updated':                 null,         // preserva status atual
  'invoice.overpaid':                'paid',
}

// Eventos que afetam o status da organização
const ORG_ACTIVATING_STATUSES = ['paid']
const ORG_SUSPENDING_STATUSES  = ['failed', 'overdue', 'action_required']
const ORG_CANCELLING_STATUSES  = ['uncollectible']

async function handleInvoiceEvent(
  supabase: SupabaseClient,
  eventType: string,
  invoice: Stripe.Invoice
) {
  // invoice.upcoming não tem ID — apenas notificar
  if (eventType === 'invoice.upcoming') {
    await sendUpcomingInvoiceNotification(supabase, invoice)
    return
  }

  // invoice.deleted — soft delete
  if (eventType === 'invoice.deleted') {
    await supabase
      .from('billing_invoices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('stripe_invoice_id', invoice.id)
    return
  }

  const newStatus = INVOICE_STATUS_MAP[eventType] ?? null

  // Upsert do registro
  await upsertInvoice(supabase, invoice, newStatus, eventType)

  // Efeitos colaterais na organização
  if (newStatus && ORG_ACTIVATING_STATUSES.includes(newStatus)) {
    await activateOrganization(supabase, invoice.customer as string)
  } else if (newStatus && ORG_SUSPENDING_STATUSES.includes(newStatus)) {
    await suspendOrganization(supabase, invoice.customer as string)
  } else if (newStatus && ORG_CANCELLING_STATUSES.includes(newStatus)) {
    await cancelOrganization(supabase, invoice.customer as string)
  }

  // Notificações ao usuário
  await sendInvoiceNotification(supabase, eventType, invoice)
}
```

### Dispatcher no switch principal

```typescript
// Substituir handlers individuais por um único bloco
case 'invoice.created':
case 'invoice.finalized':
case 'invoice.finalization_failed':
case 'invoice.paid':
case 'invoice.payment_succeeded':
case 'invoice.payment_failed':
case 'invoice.payment_action_required':
case 'invoice.payment_attempt_required':
case 'invoice.upcoming':
case 'invoice.will_be_due':
case 'invoice.overdue':
case 'invoice.overpaid':
case 'invoice.marked_uncollectible':
case 'invoice.voided':
case 'invoice.deleted':
case 'invoice.sent':
case 'invoice.updated':
  await handleInvoiceEvent(supabase, event.type, event.data.object as Stripe.Invoice)
  break

case 'invoice_payment.paid':
  // Complementar — confirmar pagamento se invoice.paid ainda não chegou
  await confirmInvoicePayment(supabase, event.data.object)
  break

case 'invoiceitem.created':
case 'invoiceitem.deleted':
  // Auditoria apenas — logar sem persistir em tabela principal
  console.log(`[audit] ${event.type}`, (event.data.object as Stripe.InvoiceItem).id)
  break

case 'customer.subscription.pending_update_expired':
  await handleSubscriptionPendingUpdateExpired(supabase, event.data.object)
  break
```

---

## Parte 5: Fluxo de Reativação (Cancel → Re-subscribe)

### Sequência garantida

```
1. Usuário cancela assinatura
   └─ customer.subscription.deleted → status = 'cancelled' na tabela subscriptions
   └─ stripe_customer_id em user_profiles: MANTIDO (não apagar)

2. Usuário clica em "Assinar novamente"
   └─ checkout.post.ts chama getOrCreateStripeCustomer()
   └─ Encontra stripe_customer_id existente → reutiliza
   └─ Cria nova checkout.session com o mesmo customer_id

3. Checkout concluído
   └─ checkout.session.completed → nova subscription criada no mesmo customer
   └─ Nova subscription ID registrada em subscriptions
   └─ Organização reativada

4. Faturas da nova assinatura
   └─ invoice.created → novo registro em billing_invoices
   └─ Vinculado à nova subscription_id, mesmo customer_id
```

### Validação no webhook `checkout.session.completed`

```typescript
// Garantir que a subscription criada está vinculada ao customer correto
const session = event.data.object as Stripe.Checkout.Session
const customerId = session.customer as string
const subscriptionId = session.subscription as string

// Verificar se o customer já tinha subscription cancelada — reativar org
const { data: existingOrg } = await supabase
  .from('subscriptions')
  .select('organization_id, status')
  .eq('stripe_customer_id', customerId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

if (existingOrg?.status === 'cancelled') {
  // Reativar a organização existente em vez de criar nova
  await reactivateOrganization(supabase, existingOrg.organization_id, subscriptionId)
} else {
  // Fluxo normal de criação
  await createNewOrganization(supabase, session)
}
```

---

## Parte 6: Checklist de Implementação

### Fase 1 — Customer deduplication (crítico)
- [ ] Refatorar `getOrCreateStripeCustomer()` com fallback na API do Stripe
- [ ] Garantir que `stripe_customer_id` nunca seja apagado no cancelamento
- [ ] Testar fluxo: criar conta → cancelar → assinar novamente → verificar 1 customer no Stripe

### Fase 2 — Schema da tabela
- [ ] Criar migração para novos campos em `billing_invoices`
- [ ] Expandir constraint de status
- [ ] Adicionar índice em `stripe_customer_id`

### Fase 3 — Handler unificado de invoice
- [ ] Implementar `handleInvoiceEvent()` na Edge Function
- [ ] Implementar `INVOICE_STATUS_MAP`
- [ ] Implementar lógica de ativação/suspensão/cancelamento de org por status
- [ ] Adicionar todos os casos no switch da Edge Function

### Fase 4 — Reativação de org existente
- [ ] Implementar `reactivateOrganization()` 
- [ ] Ajustar `checkout.session.completed` para detectar reativação vs. novo cadastro

### Fase 5 — Notificações
- [ ] Notificação: pagamento confirmado (invoice.paid)
- [ ] Notificação: falha no pagamento com link para atualizar cartão (invoice.payment_failed)
- [ ] Notificação: fatura próxima (invoice.upcoming)
- [ ] Notificação: ação necessária — autenticação 3DS (invoice.payment_action_required)
- [ ] Notificação: fatura vencida (invoice.overdue)

### Fase 6 — Webhook dashboard
- [ ] Configurar todos os 21 eventos no painel do Stripe (conforme lista fornecida)
- [ ] Remover handler duplicado em `server/api/stripe/webhook.post.ts` ou alinhar com a Edge Function

---

## Arquivos Principais Envolvidos

| Arquivo | Papel |
|---------|-------|
| `supabase/functions/stripe-webhook/index.ts` | Handler principal de webhooks (Edge Function) |
| `server/api/stripe/checkout.post.ts` | Criação de checkout — get-or-create customer |
| `server/api/stripe/webhook.post.ts` | Handler legado — avaliar remoção ou manutenção |
| `supabase/migrations/...create_billing_invoices.sql` | Schema atual da tabela de faturas |
| `supabase/migrations/NEW_expand_invoice_status.sql` | Nova migração a criar |
| `server/utils/stripe.ts` | Utilitários do SDK Stripe |
