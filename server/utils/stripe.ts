import Stripe from 'stripe'

let stripeClient: Stripe | undefined

export function getStripe() {
  if (stripeClient)
    return stripeClient

  const config = useRuntimeConfig()
  const secretKey = config.stripeSecretKey
  if (!secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Stripe is not configured'
    })
  }

  stripeClient = new Stripe(secretKey)
  return stripeClient
}

export function getAllowedStripePriceIds() {
  const config = useRuntimeConfig()
  const raw = config.stripeAllowedPriceIds
  if (!raw)
    return null

  const ids = String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  return ids.length ? ids : null
}
