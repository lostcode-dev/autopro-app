import { z } from 'zod'
import { getRequestURL } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { getAllowedStripePriceIds, getStripe } from '../../utils/stripe'

const schema = z.object({
  priceId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  successPath: z.string().min(1).optional(),
  cancelPath: z.string().min(1).optional()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
      data: parsed.error.flatten()
    })
  }

  const allowed = getAllowedStripePriceIds()
  if (allowed && !allowed.includes(parsed.data.priceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid priceId'
    })
  }

  const stripe = getStripe()
  const supabase = getSupabaseAdminClient()
  const quantity = parsed.data.quantity ?? 1

  const successPath = parsed.data.successPath
  const cancelPath = parsed.data.cancelPath

  if (successPath && !successPath.startsWith('/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid successPath'
    })
  }

  if (cancelPath && !cancelPath.startsWith('/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid cancelPath'
    })
  }

  const { data: existingCustomer } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle<{ stripe_customer_id: string }>()

  let customerId = existingCustomer?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id
      }
    })

    customerId = customer.id

    await supabase
      .from('stripe_customers')
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId
      }, { onConflict: 'user_id' })
  }

  const origin = getRequestURL(event).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    line_items: [{
      price: parsed.data.priceId,
      quantity
    }],
    success_url: `${origin}${successPath || '/app?checkout=success'}`,
    cancel_url: `${origin}${cancelPath || '/pricing?checkout=cancel'}`,
    subscription_data: {
      metadata: {
        supabase_user_id: user.id
      }
    },
    metadata: {
      supabase_user_id: user.id
    }
  })

  if (!session.url) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Stripe session did not return a URL'
    })
  }

  return { url: session.url }
})
