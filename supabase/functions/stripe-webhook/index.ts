import Stripe from 'npm:stripe@20.4.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1'

// ---------------------------------------------------------------------------
// stripe-webhook — Supabase Edge Function
//
// Single authoritative webhook handler. Runs independently of the Nuxt app
// so payments are processed even during app deployments/restarts.
//
// Handles:
//   checkout.session.completed       → create org + link user + subscription
//   customer.subscription.*          → sync stripe_subscriptions table
//   invoice.paid                     → sync stripe_invoices + activate org
//   invoice.payment_failed           → sync stripe_invoices + suspend org
//   invoice.*  (other)               → sync stripe_invoices table
//
// Env vars required (set in Supabase dashboard → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
// ---------------------------------------------------------------------------

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
}

function getEnv(): Env {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET)
    throw new Error('Missing required environment variables')

  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET }
}

function toIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUserId(
  supabase: ReturnType<typeof createClient>,
  opts: { clientReferenceId?: string | null, userIdMeta?: string | null, stripeCustomerId?: string | null }
): Promise<string | null> {
  // 1. Prefer explicit user_id from session metadata / client_reference_id
  const explicit = opts.clientReferenceId || opts.userIdMeta
  if (explicit) return explicit

  // 2. Fallback: look up by stripe_customer_id stored in user_profiles
  if (opts.stripeCustomerId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('stripe_customer_id', opts.stripeCustomerId)
      .maybeSingle<{ user_id: string }>()

    if (data?.user_id) return data.user_id

    // 3. Fallback: legacy stripe_customers table (may exist from billing/checkout.post.ts)
    const { data: sc } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', opts.stripeCustomerId)
      .maybeSingle<{ user_id: string }>()

    if (sc?.user_id) return sc.user_id
  }

  return null
}

async function ensureOrganization(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string | null
): Promise<string | null> {
  // Load current profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, organization_id, role_id, display_name, email')
    .eq('user_id', userId)
    .maybeSingle<{
      id: string
      organization_id: string | null
      role_id: string | null
      display_name: string | null
      email: string | null
    }>()

  if (!profile) {
    console.error(`[stripe-webhook] User profile not found for user_id=${userId}`)
    return null
  }

  // Already has org — nothing to do
  if (profile.organization_id) return profile.organization_id

  // Create organization
  const email = profile.email || userEmail || null
  const displayName = profile.display_name || email?.split('@')[0] || 'Oficina'
  const orgName = `${displayName}`

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: orgName,
      email,
      active: true,
      created_by: 'stripe-webhook'
    })
    .select('id')
    .single<{ id: string }>()

  if (orgErr || !org) {
    console.error('[stripe-webhook] Failed to create organization:', orgErr?.message)
    return null
  }

  // Ensure admin role exists for this organization
  // roles.organization_id is NOT NULL, so every role must be org-scoped.
  let roleId = profile.role_id

  const { data: existingAdminRole } = await supabase
    .from('roles')
    .select('id')
    .eq('organization_id', org.id)
    .eq('name', 'admin')
    .maybeSingle<{ id: string }>()

  if (existingAdminRole) {
    roleId = existingAdminRole.id
  } else {
    const { data: newRole, error: roleErr } = await supabase
      .from('roles')
      .insert({
        organization_id: org.id,
        name: 'admin',
        display_name: 'Administrador',
        description: 'Acesso total ao sistema. Criado automaticamente na assinatura.',
        is_system_role: true,
        created_by: 'stripe-webhook'
      })
      .select('id')
      .single<{ id: string }>()

    if (roleErr || !newRole) {
      console.error('[stripe-webhook] Failed to create admin role:', roleErr?.message)
    } else {
      roleId = newRole.id

      // Grant all existing actions to the admin role
      const { data: allActions } = await supabase.from('actions').select('id')
      if (allActions?.length) {
        await supabase.from('role_actions').insert(
          (allActions as { id: string }[]).map(a => ({
            role_id: roleId!,
            action_id: a.id,
            is_granted: true,
            created_by: 'stripe-webhook'
          }))
        )
      }
    }
  }

  // Link org + role to user profile
  await supabase
    .from('user_profiles')
    .update({
      organization_id: org.id,
      role_id: roleId,
      updated_by: 'stripe-webhook'
    })
    .eq('id', profile.id)

  console.log(`[stripe-webhook] Organization created and linked: ${org.id} → user ${userId}`)
  return org.id
}

async function upsertOrgSubscription(
  supabase: ReturnType<typeof createClient>,
  opts: {
    organizationId: string
    userEmail: string | null
    status: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    planName: string | null
    monthlyAmount: number | null
    startDate: string | null
    nextPaymentDate: string | null
  }
) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('organization_id', opts.organizationId)
    .maybeSingle<{ id: string }>()

  if (existing) {
    await supabase
      .from('subscriptions')
      .update({
        status: opts.status,
        stripe_customer_id: opts.stripeCustomerId,
        stripe_subscription_id: opts.stripeSubscriptionId,
        plan_name: opts.planName,
        monthly_amount: opts.monthlyAmount,
        next_payment_date: opts.nextPaymentDate,
        updated_by: 'stripe-webhook'
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('subscriptions')
      .insert({
        organization_id: opts.organizationId,
        user_email: opts.userEmail || '',
        status: opts.status,
        stripe_customer_id: opts.stripeCustomerId,
        stripe_subscription_id: opts.stripeSubscriptionId,
        plan_name: opts.planName,
        monthly_amount: opts.monthlyAmount,
        start_date: opts.startDate,
        next_payment_date: opts.nextPaymentDate,
        created_by: 'stripe-webhook'
      })
  }
}

async function upsertStripeSubscription(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  userId: string | null
) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null

  const resolvedUserId = userId
    || (subscription.metadata?.user_id ?? null)
    || (subscription.metadata?.supabase_user_id ?? null)

  if (!resolvedUserId) return

  if (customerId) {
    // Best-effort: store in legacy stripe_customers table if it exists
    await supabase
      .from('stripe_customers')
      .upsert({ user_id: resolvedUserId, stripe_customer_id: customerId }, { onConflict: 'user_id' })
      .then(() => {/* ignore errors — table may not exist */})
  }

  const item = subscription.items.data?.[0]

  await supabase
    .from('stripe_subscriptions')
    .upsert({
      user_id: resolvedUserId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: item?.price?.id ?? null,
      quantity: item?.quantity ?? null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      current_period_start: toIso(subscription.current_period_start),
      current_period_end: toIso(subscription.current_period_end),
      canceled_at: toIso(subscription.canceled_at),
      metadata: subscription.metadata ?? {}
    }, { onConflict: 'stripe_subscription_id' })
}

async function upsertStripeInvoice(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id ?? null

  if (!customerId) return

  // Resolve user_id
  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<{ user_id: string }>()

  let userId = profileRow?.user_id ?? null

  if (!userId) {
    const { data: sc } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle<{ user_id: string }>()

    userId = sc?.user_id ?? null
  }

  if (!userId) return

  const subId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id ?? null

  const line = invoice.lines?.data?.[0]

  await supabase
    .from('stripe_invoices')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      stripe_invoice_id: invoice.id,
      status: invoice.status ?? null,
      currency: invoice.currency ?? null,
      total: invoice.total ?? null,
      amount_due: invoice.amount_due ?? null,
      amount_paid: invoice.amount_paid ?? null,
      amount_remaining: invoice.amount_remaining ?? null,
      invoice_number: invoice.number ?? null,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf: invoice.invoice_pdf ?? null,
      collection_method: invoice.collection_method ?? null,
      due_date: toIso(invoice.due_date),
      period_start: toIso(line?.period?.start),
      period_end: toIso(line?.period?.end),
      paid: invoice.paid ?? null,
      created: toIso(invoice.created),
      data: invoice as unknown as Record<string, unknown>
    }, { onConflict: 'stripe_invoice_id' })
}

async function sendNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: string,
  linkPath: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'system',
        body,
        link_path: linkPath,
        sender_name: 'beenk',
        metadata
      })
  } catch {
    // best-effort — notifications are non-critical
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function onCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe
) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null

  const userId = await resolveUserId(supabase, {
    clientReferenceId: session.client_reference_id,
    userIdMeta: session.metadata?.user_id,
    stripeCustomerId: customerId
  })

  if (!userId) {
    console.error('[stripe-webhook] checkout.session.completed: could not resolve user_id')
    return
  }

  const userEmail = session.metadata?.user_email ?? session.customer_email ?? null

  // Store stripe_customer_id on user_profiles for future lookups
  if (customerId) {
    await supabase
      .from('user_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId)
      .is('stripe_customer_id', null)
  }

  // Create organization if needed
  const organizationId = await ensureOrganization(supabase, userId, userEmail)
  if (!organizationId) return

  // Sync stripe_subscriptions table
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId, {
        expand: ['items.data.price.product']
      })

      await upsertStripeSubscription(supabase, sub, userId)

      // Upsert workshop subscriptions table
      const item = sub.items.data[0]
      const price = item?.price
      const product = price?.product
      const planName = typeof product === 'object' && product !== null && 'name' in product
        ? (product as { name: string }).name
        : null

      await upsertOrgSubscription(supabase, {
        organizationId,
        userEmail,
        status: 'active',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId,
        planName,
        monthlyAmount: price?.unit_amount ? price.unit_amount / 100 : null,
        startDate: toIso(sub.current_period_start),
        nextPaymentDate: toIso(sub.current_period_end)
      })
    } catch (err) {
      console.warn('[stripe-webhook] Could not retrieve subscription details:', err)
    }
  }

  await sendNotification(supabase, userId, 'Sua assinatura foi ativada. Bem-vindo!', '/app/settings/subscription', {
    stripe_subscription_id: subId,
    stripe_customer_id: customerId
  })
}

async function onSubscriptionEvent(
  subscription: Stripe.Subscription,
  eventType: string,
  supabase: ReturnType<typeof createClient>
) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null

  const userId = await resolveUserId(supabase, {
    userIdMeta: subscription.metadata?.user_id || subscription.metadata?.supabase_user_id,
    stripeCustomerId: customerId
  })

  await upsertStripeSubscription(supabase, subscription, userId)

  // Sync org subscription status
  const { data: orgSub } = await supabase
    .from('subscriptions')
    .select('id, organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle<{ id: string, organization_id: string }>()

  if (orgSub) {
    const statusMap: Record<string, string> = {
      active: 'active', trialing: 'active',
      past_due: 'suspended', unpaid: 'suspended',
      canceled: 'cancelled', incomplete: 'suspended',
      incomplete_expired: 'cancelled', paused: 'suspended'
    }

    const newStatus = statusMap[subscription.status] ?? 'suspended'
    const isActive = newStatus === 'active'

    await Promise.all([
      supabase.from('subscriptions').update({
        status: newStatus,
        next_payment_date: toIso(subscription.current_period_end),
        updated_by: 'stripe-webhook'
      }).eq('id', orgSub.id),
      supabase.from('organizations').update({
        active: isActive,
        updated_by: 'stripe-webhook'
      }).eq('id', orgSub.organization_id)
    ])
  }

  if (userId) {
    if (eventType === 'customer.subscription.deleted') {
      await sendNotification(supabase, userId, 'Sua assinatura foi cancelada.', '/app/settings/subscription', {
        stripe_subscription_id: subscription.id
      })
    }
    if (eventType === 'customer.subscription.updated' && subscription.cancel_at_period_end) {
      await sendNotification(supabase, userId, 'Cancelamento agendado para o fim do período de cobrança.', '/app/settings/subscription', {
        stripe_subscription_id: subscription.id
      })
    }
  }
}

async function onInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe
) {
  await upsertStripeInvoice(supabase, invoice)

  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null
  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId)
    const userId = await resolveUserId(supabase, {
      userIdMeta: sub.metadata?.user_id || sub.metadata?.supabase_user_id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
    })
    await upsertStripeSubscription(supabase, sub, userId)
  }

  // Ensure org stays active
  const { data: orgSub } = await supabase
    .from('subscriptions')
    .select('id, organization_id')
    .eq('stripe_subscription_id', subId ?? '')
    .maybeSingle<{ id: string, organization_id: string }>()

  if (orgSub) {
    await Promise.all([
      supabase.from('subscriptions').update({ status: 'active', updated_by: 'stripe-webhook' }).eq('id', orgSub.id),
      supabase.from('organizations').update({ active: true, updated_by: 'stripe-webhook' }).eq('id', orgSub.organization_id)
    ])
  }

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  const userId = await resolveUserId(supabase, { stripeCustomerId: customerId })
  if (userId) {
    await sendNotification(supabase, userId, 'Pagamento confirmado. Sua fatura está disponível.', '/app/settings/subscription', {
      stripe_invoice_id: invoice.id
    })
  }
}

async function onInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof createClient>
) {
  await upsertStripeInvoice(supabase, invoice)

  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null

  const { data: orgSub } = await supabase
    .from('subscriptions')
    .select('id, organization_id')
    .eq('stripe_subscription_id', subId ?? '')
    .maybeSingle<{ id: string, organization_id: string }>()

  if (orgSub) {
    await supabase
      .from('subscriptions')
      .update({ status: 'suspended', updated_by: 'stripe-webhook' })
      .eq('id', orgSub.id)
  }

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  const userId = await resolveUserId(supabase, { stripeCustomerId: customerId })
  if (userId) {
    await sendNotification(supabase, userId, 'Falha no pagamento. Atualize sua forma de pagamento.', '/app/settings/subscription', {
      stripe_invoice_id: invoice.id
    })
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const env = getEnv()

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      cryptoProvider: Stripe.createSubtleCryptoProvider()
    })

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const signature = req.headers.get('stripe-signature')
    if (!signature)
      return new Response('Missing stripe-signature', { status: 400 })

    const payload = await req.text()
    let event: Stripe.Event

    try {
      event = await stripe.webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch {
      return new Response('Invalid signature', { status: 400 })
    }

    console.log(`[stripe-webhook] Event: ${event.type} (${event.id})`)

    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase, stripe)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await onSubscriptionEvent(event.data.object as Stripe.Subscription, event.type, supabase)
        break

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await onInvoicePaid(event.data.object as Stripe.Invoice, supabase, stripe)
        break

      case 'invoice.payment_failed':
        await onInvoicePaymentFailed(event.data.object as Stripe.Invoice, supabase)
        break

      default:
        if (event.type.startsWith('invoice.')) {
          await upsertStripeInvoice(supabase, event.data.object as Stripe.Invoice)
        }
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (err) {
    console.error('[stripe-webhook] Unhandled error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
