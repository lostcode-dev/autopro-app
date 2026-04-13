// @ts-nocheck
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21'
import Stripe from 'npm:stripe@14.11.0'

/**
 * Helper function to ensure user has an organization
 * Creates organization if it doesn't exist and links it to the user
 *
 * @param {any} base44 - Base44 SDK client
 * @param {string} userEmail - User email address
 * @returns {Promise<string>} Organization ID
 */
async function ensureUserHasOrganization(base44, userEmail) {
  console.log(`[ensureUserHasOrganization] Starting check for user: ${userEmail}`)

  // Get user entity by email
  console.log(`[ensureUserHasOrganization] Fetching user entity by email...`)
  const users = await base44.asServiceRole.entities.User.filter({
    email: userEmail
  })

  if (users.length === 0) {
    console.error(`[ensureUserHasOrganization] ERROR: User not found with email: ${userEmail}`)
    throw new Error('User not found')
  }

  const user = users[0]
  console.log(`[ensureUserHasOrganization] User found: ${user.id} (${user.nome_exibicao || user.full_name || userEmail})`)

  // If user already has organization_id, return it
  if (user.organization_id) {
    console.log(`[ensureUserHasOrganization] User already has organization_id: ${user.organization_id}`)
    return user.organization_id
  }

  // Create new organization
  const organizationName = `${user.nome_exibicao || user.full_name || userEmail.split('@')[0]} - Oficina`
  console.log(`[ensureUserHasOrganization] User does not have organization. Creating new organization: "${organizationName}"`)

  const organization = await base44.asServiceRole.entities.Organization.create({
    name: organizationName,
    email: userEmail,
    active: true
  })

  console.log(`[ensureUserHasOrganization] Organization created successfully: ${organization.id} (${organization.name})`)

  // Link organization to user
  console.log(`[ensureUserHasOrganization] Linking organization ${organization.id} to user ${user.id}...`)
  await base44.asServiceRole.entities.User.update(user.id, {
    organization_id: organization.id
  })

  console.log(`[ensureUserHasOrganization] SUCCESS: Organization ${organization.id} linked to user ${userEmail}`)
  return organization.id
}

/**
 * Helper function to get organization_id from user email
 * Used when we need organization_id but don't want to create if it doesn't exist
 *
 * @param {any} base44 - Base44 SDK client
 * @param {string} userEmail - User email address
 * @returns {Promise<string|null>} Organization ID or null if not found
 */
async function getOrganizationIdFromUser(base44, userEmail) {
  console.log(`[getOrganizationIdFromUser] Getting organization_id for user: ${userEmail}`)

  const users = await base44.asServiceRole.entities.User.filter({
    email: userEmail
  })

  if (users.length === 0) {
    console.warn(`[getOrganizationIdFromUser] User not found: ${userEmail}`)
    return null
  }

  const organizationId = users[0].organization_id
  if (organizationId) {
    console.log(`[getOrganizationIdFromUser] Found organization_id: ${organizationId}`)
  } else {
    console.warn(`[getOrganizationIdFromUser] User ${userEmail} does not have organization_id`)
  }

  return organizationId
}

/**
 * Helper function to update organization active status
 * Manages organization status based on Stripe subscription/payment status
 *
 * @param {any} base44 - Base44 SDK client
 * @param {string} organizationId - Organization ID
 * @param {boolean} active - Whether organization should be active
 * @param {string} reason - Reason for the status change (for logging)
 * @returns {Promise<void>}
 */
async function updateOrganizationStatus(base44, organizationId, active, reason) {
  if (!organizationId) {
    console.warn(`[updateOrganizationStatus] WARNING: organizationId is null or undefined. Cannot update status.`)
    return
  }

  console.log(`[updateOrganizationStatus] Updating organization ${organizationId} status to: ${active ? 'ACTIVE' : 'INACTIVE'}`)
  console.log(`[updateOrganizationStatus] Reason: ${reason}`)

  try {
    // Get current organization to check current status
    const organization = await base44.asServiceRole.entities.Organization.get(organizationId)

    if (!organization) {
      console.error(`[updateOrganizationStatus] ERROR: Organization not found with ID: ${organizationId}`)
      return
    }

    // Only update if status is different
    if (organization.active === active) {
      console.log(`[updateOrganizationStatus] Organization already has status: ${active ? 'ACTIVE' : 'INACTIVE'}. No update needed.`)
      return
    }

    // Update organization status
    await base44.asServiceRole.entities.Organization.update(organizationId, {
      active: active
    })

    console.log(`[updateOrganizationStatus] SUCCESS: Organization ${organizationId} status updated to: ${active ? 'ACTIVE' : 'INACTIVE'}`)
    console.log(`[updateOrganizationStatus] Previous status: ${organization.active ? 'ACTIVE' : 'INACTIVE'}`)
    console.log(`[updateOrganizationStatus] New status: ${active ? 'ACTIVE' : 'INACTIVE'}`)
  } catch (error) {
    console.error(`[updateOrganizationStatus] ERROR: Failed to update organization status`)
    console.error(`[updateOrganizationStatus] Error message: ${error.message}`)
    console.error(`[updateOrganizationStatus] Error stack: ${error.stack}`)
    throw error
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now()
  console.log('='.repeat(80))
  console.log('[stripeWebhook] Starting webhook processing')
  console.log(`[stripeWebhook] Timestamp: ${new Date().toISOString()}`)
  console.log('='.repeat(80))

  const base44 = createClientFromRequest(req)

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY'))
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    // Verify webhook signature
    console.log('[stripeWebhook] Step 1: Verifying webhook signature...')
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('[stripeWebhook] ERROR: Missing stripe-signature header')
      return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    let event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      )
      console.log('[stripeWebhook] Webhook signature verified successfully')
    } catch (err) {
      console.error('[stripeWebhook] ERROR: Webhook signature verification failed')
      console.error('[stripeWebhook] Error details:', err.message)
      return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    console.log(`[stripeWebhook] Step 2: Webhook event received: ${event.type}`)
    console.log(`[stripeWebhook] Event ID: ${event.id}`)

    // Process different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('[stripeWebhook] Processing checkout.session.completed event...')
        const session = event.data.object
        const userEmail = session.metadata?.user_email || session.customer_email

        if (!userEmail) {
          console.error('[stripeWebhook] ERROR: User email not found in session metadata or customer_email')
          console.error('[stripeWebhook] Session metadata:', JSON.stringify(session.metadata, null, 2))
          return Response.json({ error: 'User email not found' }, { status: 400 })
        }

        console.log(`[stripeWebhook] Step 3: Processing checkout for user: ${userEmail}`)
        console.log(`[stripeWebhook] Session ID: ${session.id}`)
        console.log(`[stripeWebhook] Customer ID: ${session.customer}`)
        console.log(`[stripeWebhook] Subscription ID: ${session.subscription}`)

        // Ensure user has an organization
        console.log('[stripeWebhook] Step 4: Ensuring user has organization...')
        const organizationId = await ensureUserHasOrganization(base44, userEmail)
        console.log(`[stripeWebhook] Organization ID confirmed: ${organizationId}`)

        // Retrieve subscription details from Stripe
        console.log('[stripeWebhook] Step 5: Retrieving subscription details from Stripe...')
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        console.log(`[stripeWebhook] Subscription status: ${subscription.status}`)
        console.log(`[stripeWebhook] Subscription period: ${new Date(subscription.current_period_start * 1000).toISOString()} to ${new Date(subscription.current_period_end * 1000).toISOString()}`)

        // Check for existing subscription
        console.log('[stripeWebhook] Step 6: Checking for existing subscription...')
        const assinaturasExistentes = await base44.asServiceRole.entities.Assinatura.filter({
          user_email: userEmail
        })
        console.log(`[stripeWebhook] Found ${assinaturasExistentes.length} existing subscription(s)`)

        const assinaturaData = {
          user_email: userEmail,
          organization_id: organizationId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plano: 'AutoPro Beenk',
          status: 'ativa',
          valor_mensal: 399.90,
          data_inicio: new Date(subscription.current_period_start * 1000).toISOString(),
          data_proximo_pagamento: new Date(subscription.current_period_end * 1000).toISOString()
        }

        console.log('[stripeWebhook] Step 7: Subscription data prepared:')
        console.log(`[stripeWebhook] - user_email: ${assinaturaData.user_email}`)
        console.log(`[stripeWebhook] - organization_id: ${assinaturaData.organization_id}`)
        console.log(`[stripeWebhook] - stripe_customer_id: ${assinaturaData.stripe_customer_id}`)
        console.log(`[stripeWebhook] - stripe_subscription_id: ${assinaturaData.stripe_subscription_id}`)
        console.log(`[stripeWebhook] - status: ${assinaturaData.status}`)
        console.log(`[stripeWebhook] - valor_mensal: ${assinaturaData.valor_mensal}`)

        if (assinaturasExistentes.length > 0) {
          console.log(`[stripeWebhook] Step 8: Updating existing subscription ID: ${assinaturasExistentes[0].id}`)
          await base44.asServiceRole.entities.Assinatura.update(
            assinaturasExistentes[0].id,
            assinaturaData
          )
          console.log(`[stripeWebhook] SUCCESS: Subscription updated for user: ${userEmail}`)
        } else {
          console.log('[stripeWebhook] Step 8: Creating new subscription...')
          const createdAssinatura = await base44.asServiceRole.entities.Assinatura.create(assinaturaData)
          console.log(`[stripeWebhook] SUCCESS: New subscription created with ID: ${createdAssinatura.id}`)
        }

        // Activate organization when payment is successful
        console.log('[stripeWebhook] Step 9: Activating organization due to successful payment...')
        await updateOrganizationStatus(
          base44,
          organizationId,
          true,
          'Checkout session completed - payment successful'
        )

        break
      }

      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        console.log(`[stripeWebhook] Processing paid invoice event: ${event.type}...`)
        const invoice = event.data.object
        const paidAtTimestamp = invoice?.status_transitions?.paid_at || invoice?.created

        console.log(`[stripeWebhook] Invoice ID: ${invoice.id}`)
        console.log(`[stripeWebhook] Invoice amount: ${(invoice.amount_paid / 100).toFixed(2)}`)
        console.log(`[stripeWebhook] Invoice subscription: ${invoice.subscription}`)

        // Get customer from Stripe to get email
        console.log('[stripeWebhook] Step 3: Retrieving customer from Stripe...')
        const customer = await stripe.customers.retrieve(invoice.customer)
        const userEmail = customer.email

        if (!userEmail) {
          console.error(`[stripeWebhook] ERROR: Customer email not found for invoice: ${invoice.id}`)
          return Response.json({ error: 'Customer email not found' }, { status: 400 })
        }

        console.log(`[stripeWebhook] Invoice for user: ${userEmail}`)

        // Get organization_id from user or subscription
        console.log('[stripeWebhook] Step 4: Getting organization_id...')
        let organizationId = await getOrganizationIdFromUser(base44, userEmail)

        // If not found in user, try to get from subscription
        if (!organizationId && invoice.subscription) {
          console.log('[stripeWebhook] Organization_id not found in user, trying to get from subscription...')
          const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
            user_email: userEmail,
            stripe_subscription_id: invoice.subscription
          })

          if (assinaturas.length > 0 && assinaturas[0].organization_id) {
            organizationId = assinaturas[0].organization_id
            console.log(`[stripeWebhook] Found organization_id from subscription: ${organizationId}`)
          }
        }

        if (!organizationId) {
          console.warn(`[stripeWebhook] WARNING: organization_id not found for user ${userEmail}. Creating organization...`)
          organizationId = await ensureUserHasOrganization(base44, userEmail)
        }

        // Check if invoice already exists
        console.log('[stripeWebhook] Step 5: Checking if invoice already exists...')
        const faturasExistentes = await base44.asServiceRole.entities.Fatura.filter({
          stripe_invoice_id: invoice.id
        })

        if (faturasExistentes.length > 0) {
          // Update existing invoice
          console.log(`[stripeWebhook] Step 6: Updating existing invoice ID: ${faturasExistentes[0].id}`)
          await base44.asServiceRole.entities.Fatura.update(faturasExistentes[0].id, {
            status: 'paga',
            data_pagamento: new Date(paidAtTimestamp * 1000).toISOString(),
            url_pdf: invoice.invoice_pdf,
            valor: (invoice.amount_paid / 100),
            organization_id: organizationId // Ensure organization_id is set
          })
          console.log(`[stripeWebhook] SUCCESS: Invoice updated for user: ${userEmail}`)
        } else {
          // Create new invoice
          console.log('[stripeWebhook] Step 6: Creating new invoice...')

          // Get subscription for user
          const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
            user_email: userEmail,
            stripe_subscription_id: invoice.subscription
          })

          const assinaturaId = assinaturas.length > 0 ? assinaturas[0].id : null
          console.log(`[stripeWebhook] Subscription ID: ${assinaturaId || 'Not found'}`)

          const faturaData = {
            user_email: userEmail,
            organization_id: organizationId,
            assinatura_id: assinaturaId,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription,
            numero_fatura: invoice.number || `INV-${Date.now()}`,
            valor: (invoice.amount_paid / 100),
            status: 'paga',
            data_emissao: new Date(invoice.created * 1000).toISOString(),
            data_vencimento: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : new Date(invoice.created * 1000).toISOString(),
            data_pagamento: new Date(paidAtTimestamp * 1000).toISOString(),
            url_pdf: invoice.invoice_pdf,
            descricao: 'Assinatura AutoPro Beenk'
          }

          console.log('[stripeWebhook] Invoice data prepared:')
          console.log(`[stripeWebhook] - user_email: ${faturaData.user_email}`)
          console.log(`[stripeWebhook] - organization_id: ${faturaData.organization_id}`)
          console.log(`[stripeWebhook] - valor: ${faturaData.valor}`)
          console.log(`[stripeWebhook] - status: ${faturaData.status}`)

          const createdFatura = await base44.asServiceRole.entities.Fatura.create(faturaData)
          console.log(`[stripeWebhook] SUCCESS: New invoice created with ID: ${createdFatura.id}`)
        }

        // Activate organization when invoice payment succeeds
        console.log('[stripeWebhook] Step 7: Activating organization due to successful invoice payment...')
        await updateOrganizationStatus(
          base44,
          organizationId,
          true,
          'Invoice payment succeeded'
        )

        break
      }

      case 'invoice.payment_failed': {
        console.log('[stripeWebhook] Processing invoice.payment_failed event...')
        const invoice = event.data.object

        console.log(`[stripeWebhook] Invoice ID: ${invoice.id}`)
        console.log(`[stripeWebhook] Invoice amount due: ${(invoice.amount_due / 100).toFixed(2)}`)
        console.log(`[stripeWebhook] Invoice subscription: ${invoice.subscription}`)

        // Get customer from Stripe to get email
        console.log('[stripeWebhook] Step 3: Retrieving customer from Stripe...')
        const customer = await stripe.customers.retrieve(invoice.customer)
        const userEmail = customer.email

        if (!userEmail) {
          console.error(`[stripeWebhook] ERROR: Customer email not found for failed invoice: ${invoice.id}`)
          break
        }

        console.log(`[stripeWebhook] Failed invoice for user: ${userEmail}`)

        // Get organization_id from user or subscription
        console.log('[stripeWebhook] Step 4: Getting organization_id...')
        let organizationId = await getOrganizationIdFromUser(base44, userEmail)

        // If not found in user, try to get from subscription
        if (!organizationId && invoice.subscription) {
          console.log('[stripeWebhook] Organization_id not found in user, trying to get from subscription...')
          const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
            user_email: userEmail,
            stripe_subscription_id: invoice.subscription
          })

          if (assinaturas.length > 0 && assinaturas[0].organization_id) {
            organizationId = assinaturas[0].organization_id
            console.log(`[stripeWebhook] Found organization_id from subscription: ${organizationId}`)
          }
        }

        if (!organizationId) {
          console.warn(`[stripeWebhook] WARNING: organization_id not found for user ${userEmail}. Creating organization...`)
          organizationId = await ensureUserHasOrganization(base44, userEmail)
        }

        // Check if invoice already exists
        console.log('[stripeWebhook] Step 5: Checking if invoice already exists...')
        const faturasExistentes = await base44.asServiceRole.entities.Fatura.filter({
          stripe_invoice_id: invoice.id
        })

        if (faturasExistentes.length > 0) {
          console.log(`[stripeWebhook] Step 6: Updating existing invoice ID: ${faturasExistentes[0].id}`)
          await base44.asServiceRole.entities.Fatura.update(faturasExistentes[0].id, {
            status: 'falhada',
            organization_id: organizationId // Ensure organization_id is set
          })
          console.log(`[stripeWebhook] Invoice status updated to 'falhada'`)
        } else {
          // Create invoice as failed
          console.log('[stripeWebhook] Step 6: Creating new invoice as failed...')
          const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
            user_email: userEmail,
            stripe_subscription_id: invoice.subscription
          })

          const assinaturaId = assinaturas.length > 0 ? assinaturas[0].id : null
          console.log(`[stripeWebhook] Subscription ID: ${assinaturaId || 'Not found'}`)

          const faturaData = {
            user_email: userEmail,
            organization_id: organizationId,
            assinatura_id: assinaturaId,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription,
            numero_fatura: invoice.number || `INV-${Date.now()}`,
            valor: (invoice.amount_due / 100),
            status: 'falhada',
            data_emissao: new Date(invoice.created * 1000).toISOString(),
            data_vencimento: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : new Date(invoice.created * 1000).toISOString(),
            url_pdf: invoice.invoice_pdf,
            descricao: 'Assinatura AutoPro Beenk'
          }

          console.log('[stripeWebhook] Invoice data prepared:')
          console.log(`[stripeWebhook] - user_email: ${faturaData.user_email}`)
          console.log(`[stripeWebhook] - organization_id: ${faturaData.organization_id}`)
          console.log(`[stripeWebhook] - valor: ${faturaData.valor}`)
          console.log(`[stripeWebhook] - status: ${faturaData.status}`)

          const createdFatura = await base44.asServiceRole.entities.Fatura.create(faturaData)
          console.log(`[stripeWebhook] SUCCESS: New failed invoice created with ID: ${createdFatura.id}`)
        }

        // Update subscription status to suspended
        console.log('[stripeWebhook] Step 7: Updating subscription status to suspended...')
        const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
          user_email: userEmail,
          stripe_subscription_id: invoice.subscription
        })

        if (assinaturas.length > 0) {
          console.log(`[stripeWebhook] Updating subscription ID: ${assinaturas[0].id}`)
          await base44.asServiceRole.entities.Assinatura.update(assinaturas[0].id, {
            status: 'suspensa'
          })
          console.log(`[stripeWebhook] SUCCESS: Subscription status updated to 'suspensa'`)

          // Deactivate organization when payment fails
          if (assinaturas[0].organization_id) {
            console.log('[stripeWebhook] Step 8: Deactivating organization due to payment failure...')
            await updateOrganizationStatus(
              base44,
              assinaturas[0].organization_id,
              false,
              'Invoice payment failed'
            )
          } else {
            console.warn(`[stripeWebhook] WARNING: Subscription does not have organization_id. Cannot deactivate organization.`)
          }
        } else {
          console.warn(`[stripeWebhook] WARNING: Subscription not found for user ${userEmail} and subscription ${invoice.subscription}`)

          // Try to deactivate organization using organizationId from earlier
          if (organizationId) {
            console.log('[stripeWebhook] Step 8: Deactivating organization due to payment failure (using organizationId from user)...')
            await updateOrganizationStatus(
              base44,
              organizationId,
              false,
              'Invoice payment failed - subscription not found'
            )
          }
        }

        break
      }

      case 'customer.subscription.updated': {
        console.log('[stripeWebhook] Processing customer.subscription.updated event...')
        const subscription = event.data.object

        console.log(`[stripeWebhook] Subscription ID: ${subscription.id}`)
        console.log(`[stripeWebhook] Subscription status: ${subscription.status}`)
        console.log(`[stripeWebhook] Current period end: ${new Date(subscription.current_period_end * 1000).toISOString()}`)

        // Find subscription by stripe_subscription_id
        console.log('[stripeWebhook] Step 3: Finding subscription in database...')
        const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
          stripe_subscription_id: subscription.id
        })

        if (assinaturas.length > 0) {
          const status = subscription.status === 'active'
            ? 'ativa'
            : subscription.status === 'canceled' ? 'cancelada' : 'suspensa'

          console.log(`[stripeWebhook] Step 4: Updating subscription status to: ${status}`)
          console.log(`[stripeWebhook] Subscription database ID: ${assinaturas[0].id}`)

          await base44.asServiceRole.entities.Assinatura.update(assinaturas[0].id, {
            status: status,
            data_proximo_pagamento: new Date(subscription.current_period_end * 1000).toISOString()
          })
          console.log(`[stripeWebhook] SUCCESS: Subscription status updated to '${status}'`)

          // Update organization status based on subscription status
          const organizationId = assinaturas[0].organization_id
          if (organizationId) {
            console.log('[stripeWebhook] Step 5: Updating organization status based on subscription status...')

            // Active statuses: 'active'
            // Inactive statuses: 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing' (if past trial)
            const shouldBeActive = subscription.status === 'active'

            await updateOrganizationStatus(
              base44,
              organizationId,
              shouldBeActive,
              `Subscription status changed to: ${subscription.status}`
            )
          } else {
            console.warn(`[stripeWebhook] WARNING: Subscription does not have organization_id. Cannot update organization status.`)
          }
        } else {
          console.warn(`[stripeWebhook] WARNING: Subscription not found in database for Stripe subscription: ${subscription.id}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        console.log('[stripeWebhook] Processing customer.subscription.deleted event...')
        const subscription = event.data.object

        console.log(`[stripeWebhook] Subscription ID: ${subscription.id}`)
        console.log(`[stripeWebhook] Subscription status: ${subscription.status}`)

        // Find subscription by stripe_subscription_id
        console.log('[stripeWebhook] Step 3: Finding subscription in database...')
        const assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
          stripe_subscription_id: subscription.id
        })

        if (assinaturas.length > 0) {
          console.log(`[stripeWebhook] Step 4: Marking subscription as cancelled`)
          console.log(`[stripeWebhook] Subscription database ID: ${assinaturas[0].id}`)
          await base44.asServiceRole.entities.Assinatura.update(assinaturas[0].id, {
            status: 'cancelada',
            data_cancelamento: new Date().toISOString()
          })
          console.log(`[stripeWebhook] SUCCESS: Subscription marked as 'cancelada'`)

          // Deactivate organization when subscription is deleted/cancelled
          const organizationId = assinaturas[0].organization_id
          if (organizationId) {
            console.log('[stripeWebhook] Step 5: Deactivating organization due to subscription cancellation...')
            await updateOrganizationStatus(
              base44,
              organizationId,
              false,
              'Subscription deleted/cancelled'
            )
          } else {
            console.warn(`[stripeWebhook] WARNING: Subscription does not have organization_id. Cannot deactivate organization.`)
          }
        } else {
          console.warn(`[stripeWebhook] WARNING: Subscription not found in database for Stripe subscription: ${subscription.id}`)
        }
        break
      }

      default: {
        console.log(`[stripeWebhook] Unhandled event type: ${event.type}`)
        console.log(`[stripeWebhook] Event ID: ${event.id}`)
        break
      }
    }

    const duration = Date.now() - startTime
    console.log('='.repeat(80))
    console.log('[stripeWebhook] SUCCESS: Webhook processed successfully')
    console.log(`[stripeWebhook] Event type: ${event.type}`)
    console.log(`[stripeWebhook] Duration: ${duration}ms`)
    console.log('='.repeat(80))

    return Response.json({ received: true })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('='.repeat(80))
    console.error('[stripeWebhook] ERROR: Failed to process webhook')
    console.error(`[stripeWebhook] Error message: ${error.message}`)
    console.error(`[stripeWebhook] Error stack: ${error.stack}`)
    console.error(`[stripeWebhook] Duration: ${duration}ms`)
    console.error('='.repeat(80))

    return Response.json({ error: error.message }, { status: 500 })
  }
})
