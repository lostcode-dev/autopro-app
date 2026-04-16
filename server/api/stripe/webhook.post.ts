import type { H3Event } from 'h3'
import type Stripe from 'stripe'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { getStripe, getStripeWebhookSecret } from '../../utils/stripe'

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription
  if (!subscription)
    return null

  return typeof subscription === 'string'
    ? subscription
    : subscription.id
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.current_period_end ?? null
}

/**
 * POST /api/stripe/webhook
 * Receives and processes Stripe webhook events.
 *
 * Handled events:
 *   checkout.session.completed    → create org + link user + create subscription
 *   invoice.payment_succeeded     → ensure subscription/org is active
 *   invoice.payment_failed        → suspend subscription
 *   customer.subscription.updated → sync subscription status
 *   customer.subscription.deleted → cancel subscription + deactivate org
 *
 * Security: Stripe-Signature header is verified with STRIPE_WEBHOOK_SECRET.
 * The raw request body must NOT be parsed before signature verification.
 */
export default defineEventHandler(async (event: H3Event) => {
  // ── Read raw body before any parsing ──────────────────────────────────────
  const rawBody = await readRawBody(event)
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Empty webhook body' })
  }

  const signature = getRequestHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Stripe-Signature header' })
  }

  // ── Verify signature ──────────────────────────────────────────────────────
  const stripe = getStripe()
  const webhookSecret = getStripeWebhookSecret()

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Stripe webhook signature' })
  }

  const supabase = getSupabaseAdminClient()

  // ── Route events ──────────────────────────────────────────────────────────
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session, supabase, stripe)
        break

      case 'invoice.payment_succeeded':
      case 'invoice.paid':
        await handleInvoicePaid(stripeEvent.data.object as Stripe.Invoice, supabase)
        break

      case 'invoice.payment_failed':
        await handleInvoiceFailed(stripeEvent.data.object as Stripe.Invoice, supabase)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription, supabase)
        break

      default:
        // Ignore unhandled event types
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error processing event ${stripeEvent.type}:`, err)
    throw createError({ statusCode: 500, statusMessage: 'Webhook processing failed' })
  }

  return { received: true }
})

// =============================================================================
// Handlers
// =============================================================================

/**
 * checkout.session.completed
 * Creates the organization for the user (if they don't have one yet),
 * assigns the admin role, and creates the subscription record.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  stripe: ReturnType<typeof getStripe>
) {
  const userId = session.metadata?.user_id
  const userEmail = session.metadata?.user_email

  if (!userId && !userEmail) {
    console.warn('[stripe/webhook] checkout.session.completed: no user_id/user_email in metadata')
    return
  }

  // ── Load user profile ────────────────────────────────────────────────────
  const profileQuery = supabase
    .from('user_profiles')
    .select('id, user_id, display_name, organization_id, role_id, email')

  const { data: profile } = userId
    ? await profileQuery.eq('user_id', userId).maybeSingle()
    : await profileQuery.eq('email', userEmail!).maybeSingle()

  if (!profile) {
    console.error(`[stripe/webhook] User profile not found for user_id=${userId} email=${userEmail}`)
    return
  }

  let organizationId = profile.organization_id as string | null

  // ── Create organization if the user doesn't have one yet ─────────────────
  if (!organizationId) {
    const orgName = `${(profile.display_name as string | null) || (profile.email as string | null) || userEmail || 'Oficina'}`

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        email: (profile.email as string | null) || userEmail || null,
        active: true,
        created_by: (profile.email as string | null) || userEmail || 'webhook'
      })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('[stripe/webhook] Failed to create organization:', orgError)
      return
    }

    organizationId = org.id
  }

  // ── Ensure admin role exists for this organization ──────────────────────
  // roles.organization_id is NOT NULL, so every role must be org-scoped.
  // We upsert the admin role to avoid duplicates on retries.
  let roleId = profile.role_id as string | null

  const { data: existingAdminRole } = await supabase
    .from('roles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', 'admin')
    .maybeSingle()

  if (existingAdminRole) {
    roleId = existingAdminRole.id
  } else {
    const { data: newRole, error: roleError } = await supabase
      .from('roles')
      .insert({
        organization_id: organizationId,
        name: 'admin',
        display_name: 'Administrador',
        description: 'Acesso total ao sistema. Criado automaticamente na assinatura.',
        is_system_role: true,
        created_by: 'stripe-webhook'
      })
      .select('id')
      .single()

    if (roleError || !newRole) {
      console.error('[stripe/webhook] Failed to create admin role:', roleError)
    } else {
      roleId = newRole.id

      // Grant all existing actions to the admin role
      const { data: allActions } = await supabase.from('actions').select('id')
      if (allActions?.length) {
        await supabase.from('role_actions').insert(
          allActions.map(a => ({
            role_id: roleId!,
            action_id: a.id,
            is_granted: true,
            created_by: 'stripe-webhook'
          }))
        )
      }
    }
  }

  // ── Link org + role to user profile ─────────────────────────────────────
  await supabase
    .from('user_profiles')
    .update({
      organization_id: organizationId,
      role_id: roleId,
      updated_by: 'stripe-webhook'
    })
    .eq('id', profile.id)

  // ── Activate organization ────────────────────────────────────────────────
  await supabase
    .from('organizations')
    .update({ active: true })
    .eq('id', organizationId)

  // ── Resolve subscription details from Stripe ─────────────────────────────
  let stripeSubscriptionId: string | null = null
  let planName: string | null = null
  let monthlyAmount: number | null = null
  let nextPaymentDate: string | null = null
  let customerId = typeof session.customer === 'string' ? session.customer : null

  if (session.subscription) {
    const subId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id

    stripeSubscriptionId = subId

    try {
      const sub = await stripe.subscriptions.retrieve(subId, {
        expand: ['items.data.price.product']
      })

      const item = sub.items.data[0]
      const price = item?.price
      const product = price?.product

      planName = typeof product === 'object' && product !== null && 'name' in product
        ? (product as { name: string }).name
        : null

      monthlyAmount = price?.unit_amount ? price.unit_amount / 100 : null
      const periodEnd = getSubscriptionPeriodEnd(sub)
      nextPaymentDate = periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null

      if (!customerId) {
        customerId = typeof sub.customer === 'string' ? sub.customer : null
      }
    } catch (err) {
      console.warn('[stripe/webhook] Could not retrieve subscription details:', err)
    }
  }

  // ── Create subscription record ────────────────────────────────────────────
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (existingSub) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan_name: planName,
        monthly_amount: monthlyAmount,
        next_payment_date: nextPaymentDate,
        updated_by: 'stripe-webhook'
      })
      .eq('id', existingSub.id)
  } else {
    await supabase
      .from('subscriptions')
      .insert({
        organization_id: organizationId,
        user_email: (profile.email as string | null) || userEmail || '',
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan_name: planName,
        monthly_amount: monthlyAmount,
        start_date: new Date().toISOString(),
        next_payment_date: nextPaymentDate,
        created_by: 'stripe-webhook'
      })
  }
}

/**
 * invoice.payment_succeeded / invoice.paid
 * Ensures the organization stays active when a payment goes through.
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)

  if (!subscriptionId) return

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, organization_id, status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (!sub) return

  await Promise.all([
    supabase
      .from('subscriptions')
      .update({ status: 'active', updated_by: 'stripe-webhook' })
      .eq('id', sub.id),
    supabase
      .from('organizations')
      .update({ active: true, updated_by: 'stripe-webhook' })
      .eq('id', sub.organization_id)
  ])
}

/**
 * invoice.payment_failed
 * Suspends the subscription when a payment fails.
 */
async function handleInvoiceFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)

  if (!subscriptionId) return

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, organization_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (!sub) return

  await supabase
    .from('subscriptions')
    .update({ status: 'suspended', updated_by: 'stripe-webhook' })
    .eq('id', sub.id)
}

/**
 * customer.subscription.updated
 * Syncs subscription status with Stripe.
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!sub) return

  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'active',
    past_due: 'suspended',
    unpaid: 'suspended',
    canceled: 'cancelled',
    incomplete: 'suspended',
    incomplete_expired: 'cancelled',
    paused: 'suspended'
  }

  const newStatus = statusMap[subscription.status] ?? 'suspended'
  const isActive = newStatus === 'active'

  await Promise.all([
    supabase
      .from('subscriptions')
      .update({
        status: newStatus,
        next_payment_date: getSubscriptionPeriodEnd(subscription)
          ? new Date(getSubscriptionPeriodEnd(subscription)! * 1000).toISOString()
          : null,
        updated_by: 'stripe-webhook'
      })
      .eq('id', sub.id),
    supabase
      .from('organizations')
      .update({ active: isActive, updated_by: 'stripe-webhook' })
      .eq('id', sub.organization_id)
  ])
}

/**
 * customer.subscription.deleted
 * Marks subscription as cancelled and deactivates the organization.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!sub) return

  await Promise.all([
    supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancellation_date: new Date().toISOString(),
        updated_by: 'stripe-webhook'
      })
      .eq('id', sub.id),
    supabase
      .from('organizations')
      .update({ active: false, updated_by: 'stripe-webhook' })
      .eq('id', sub.organization_id)
  ])
}
