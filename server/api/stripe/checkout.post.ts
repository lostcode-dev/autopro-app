import { readBody, getRequestHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { getAllowedStripePriceIds, getStripe } from '../../utils/stripe'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/stripe/checkout
 * Creates a Stripe checkout session for subscription.
 * Migrated from: supabase/functions/stripeCheckout
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const stripe = getStripe()

  const body = await readBody(event)
  const { priceId } = body || {}

  if (!priceId) {
    throw createError({ statusCode: 400, statusMessage: 'priceId é obrigatório' })
  }

  // Validate price ID against allowed list
  const allowedPriceIds = getAllowedStripePriceIds()
  if (allowedPriceIds && !allowedPriceIds.includes(priceId)) {
    throw createError({ statusCode: 400, statusMessage: 'priceId inválido' })
  }

  // Get or create user profile with organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', authUser.email!)
    .maybeSingle()

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado' })
  }

  let organizationId = profile.organization_id

  // If user has no organization, create one
  if (!organizationId) {
    const orgName = `${profile.display_name || profile.full_name || authUser.email!.split('@')[0]} - Oficina`

    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: orgName, email: authUser.email, active: true, created_by: authUser.email })
      .select()
      .single()

    if (org) {
      organizationId = org.id

      // Get admin role
      const { data: adminRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .eq('is_system_role', true)
        .maybeSingle()

      // Link organization and role to user
      await supabase
        .from('user_profiles')
        .update({
          organization_id: org.id,
          role_id: adminRole?.id || null,
          updated_by: authUser.email
        })
        .eq('id', profile.id)
    }
  }

  // Assign admin role if missing
  if (!profile.role_id) {
    const { data: adminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .eq('is_system_role', true)
      .maybeSingle()

    if (adminRole) {
      await supabase
        .from('user_profiles')
        .update({ role_id: adminRole.id })
        .eq('id', profile.id)
    }
  }

  // Check for existing subscription with Stripe customer
  const { data: existingSubs } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_email', authUser.email!)
    .limit(1)

  let customerId = existingSubs?.[0]?.stripe_customer_id || null

  // Create Stripe customer if needed
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: authUser.email!,
      name: profile.full_name || undefined,
      metadata: {
        user_email: authUser.email!,
        organization_id: organizationId || ''
      }
    })
    customerId = customer.id
  }

  // Create checkout session
  const origin = getRequestHeader(event, 'origin') || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    allow_promotion_codes: true,
    success_url: `${origin}/PagamentoSucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/PagamentoCancelado`,
    metadata: {
      user_email: authUser.email!,
      organization_id: organizationId || ''
    }
  })

  return {
    sessionId: session.id,
    url: session.url
  }
})
