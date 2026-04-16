import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

type GetOrCreateStripeCustomerParams = {
  stripe: Stripe
  supabase: SupabaseClient
  userId: string
  email?: string | null
  displayName?: string | null
  profileId?: string | null
  knownCustomerId?: string | null
}

async function persistStripeCustomerId(
  supabase: SupabaseClient,
  userId: string,
  customerId: string,
  profileId?: string | null
) {
  const profileQuery = supabase
    .from('user_profiles')
    .update({ stripe_customer_id: customerId })

  if (profileId)
    await profileQuery.eq('id', profileId)
  else
    await profileQuery.eq('user_id', userId)

  try {
    await supabase
      .from('stripe_customers')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId
      }, { onConflict: 'user_id' })
  } catch {
    // Best effort for legacy compatibility.
  }
}

async function resolveExistingStripeCustomer(
  stripe: Stripe,
  customerIds: Iterable<string>
) {
  for (const customerId of customerIds) {
    if (!customerId)
      continue

    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!('deleted' in customer) || !customer.deleted)
        return customerId
    } catch {
      // Ignore stale local references and keep searching.
    }
  }

  return null
}

export async function getOrCreateStripeCustomer({
  stripe,
  supabase,
  userId,
  email,
  displayName,
  profileId,
  knownCustomerId
}: GetOrCreateStripeCustomerParams): Promise<string> {
  const candidateIds = new Set<string>()

  if (knownCustomerId)
    candidateIds.add(knownCustomerId)

  if (!knownCustomerId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq(profileId ? 'id' : 'user_id', profileId ?? userId)
      .maybeSingle<{ stripe_customer_id: string | null }>()

    if (profile?.stripe_customer_id)
      candidateIds.add(profile.stripe_customer_id)
  }

  try {
    const { data: legacyCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle<{ stripe_customer_id: string | null }>()

    if (legacyCustomer?.stripe_customer_id)
      candidateIds.add(legacyCustomer.stripe_customer_id)
  } catch {
    // Best effort for environments that do not expose the legacy table.
  }

  const existingCustomerId = await resolveExistingStripeCustomer(stripe, candidateIds)
  if (existingCustomerId) {
    await persistStripeCustomerId(supabase, userId, existingCustomerId, profileId)
    return existingCustomerId
  }

  if (email) {
    const existingCustomers = await stripe.customers.list({ email, limit: 10 })
    const matchedCustomer = existingCustomers.data.find((customer) => {
      const metadataUserId = customer.metadata?.user_id || customer.metadata?.supabase_user_id
      return metadataUserId === userId
    }) ?? existingCustomers.data[0]

    if (matchedCustomer) {
      await persistStripeCustomerId(supabase, userId, matchedCustomer.id, profileId)
      return matchedCustomer.id
    }
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: displayName ?? undefined,
    metadata: {
      user_id: userId,
      supabase_user_id: userId,
      user_email: email ?? ''
    }
  })

  await persistStripeCustomerId(supabase, userId, customer.id, profileId)
  return customer.id
}
