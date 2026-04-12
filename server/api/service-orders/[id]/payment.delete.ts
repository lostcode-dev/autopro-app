import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * DELETE /api/service-orders/:id/payment
 * Deletes all payment-related records for a service order and reverts bank balances.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  }

  const warnings: string[] = []

  // Verify order exists
  const { data: order } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Service order not found' })
  }

  let deletedStatements = 0
  let deletedTransactions = 0
  let deletedCommissions = 0
  let deletedInstallments = 0

  // Helper to delete bank statements and revert balances
  const deleteStatementsAndRevert = async (transactionId: string) => {
    const { data: statements } = await supabase
      .from('bank_account_statements')
      .select('*')
      .eq('financial_transaction_id', transactionId)
      .eq('organization_id', organizationId)

    for (const stmt of statements || []) {
      try {
        if (stmt.bank_account_id) {
          await supabase
            .from('bank_accounts')
            .update({ current_balance: stmt.previous_balance, updated_by: authUser.email })
            .eq('id', stmt.bank_account_id)
            .eq('organization_id', organizationId)
        }
        await supabase.from('bank_account_statements').delete().eq('id', stmt.id)
        deletedStatements++
      } catch (err: any) {
        warnings.push(`Failed to delete statement ${stmt.id}: ${err.message}`)
      }
    }
  }

  // 1. Delete commissions
  const { data: commissions } = await supabase
    .from('employee_financial_records')
    .select('*')
    .eq('service_order_id', orderId)
    .eq('record_type', 'commission')
    .eq('organization_id', organizationId)

  for (const commission of commissions || []) {
    if (commission.financial_transaction_id) {
      await deleteStatementsAndRevert(commission.financial_transaction_id)
      await supabase.from('financial_transactions').delete().eq('id', commission.financial_transaction_id)
      deletedTransactions++
    }
    await supabase.from('employee_financial_records').delete().eq('id', commission.id)
    deletedCommissions++
  }

  // 2. Delete installments
  const { data: installments } = await supabase
    .from('service_order_installments')
    .select('*')
    .eq('service_order_id', orderId)
    .eq('organization_id', organizationId)

  for (const installment of installments || []) {
    if (installment.financial_transaction_id) {
      await deleteStatementsAndRevert(installment.financial_transaction_id)
      await supabase.from('financial_transactions').delete().eq('id', installment.financial_transaction_id)
      deletedTransactions++
    }
    await supabase.from('service_order_installments').delete().eq('id', installment.id)
    deletedInstallments++
  }

  // 3. Delete direct financial entries for this order
  const { data: directTransactions } = await supabase
    .from('financial_transactions')
    .select('id')
    .eq('service_order_id', orderId)
    .eq('organization_id', organizationId)

  for (const tx of directTransactions || []) {
    await deleteStatementsAndRevert(tx.id)
    await supabase.from('financial_transactions').delete().eq('id', tx.id)
    deletedTransactions++
  }

  // 4. Reset order payment status
  await supabase
    .from('service_orders')
    .update({
      payment_status: 'pending',
      payment_method: null,
      is_installment: false,
      installment_count: 0,
      commission_amount: 0,
      terminal_fee_amount: 0,
      updated_by: authUser.email
    })
    .eq('id', orderId)

  const { data: updatedOrder } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  return {
    data: {
      orderId,
      orderNumber: order.number,
      deleted: {
        statements: deletedStatements,
        transactions: deletedTransactions,
        commissions: deletedCommissions,
        installments: deletedInstallments
      },
      updatedOrder,
      warnings
    }
  }
})
