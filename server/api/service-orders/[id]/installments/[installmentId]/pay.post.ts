import { getSupabaseAdminClient } from '../../../../../utils/supabase'
import { requireAuthUser } from '../../../../../utils/require-auth'
import { resolveOrganizationId } from '../../../../../utils/organization'

/**
 * POST /api/service-orders/:id/installments/:installmentId/pay
 * Marks a single pending installment as paid, updates the linked financial
 * transaction, adjusts the bank account balance, and recalculates the
 * service order payment_status.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const orderId = getRouterParam(event, 'id')
  const installmentId = getRouterParam(event, 'installmentId')

  if (!orderId || !installmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Parâmetros obrigatórios ausentes' })
  }

  const body = await readBody(event)
  const paymentDate: string = body?.payment_date || new Date().toISOString().split('T')[0]

  // Load installment
  const { data: installment, error: installmentError } = await supabase
    .from('service_order_installments')
    .select('*')
    .eq('id', installmentId)
    .eq('service_order_id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (installmentError || !installment) {
    throw createError({ statusCode: 404, statusMessage: 'Parcela não encontrada' })
  }

  if (installment.status === 'paid') {
    throw createError({ statusCode: 409, statusMessage: 'Parcela já foi paga' })
  }

  // Mark installment as paid
  const { error: updateInstallmentError } = await supabase
    .from('service_order_installments')
    .update({
      status: 'paid',
      payment_date: paymentDate,
      updated_by: authUser.email
    })
    .eq('id', installmentId)

  if (updateInstallmentError) {
    throw createError({ statusCode: 500, statusMessage: updateInstallmentError.message })
  }

  // Update the linked financial transaction to paid
  if (installment.financial_transaction_id) {
    const { data: transaction, error: txError } = await supabase
      .from('financial_transactions')
      .update({
        status: 'paid',
        due_date: paymentDate,
        updated_by: authUser.email
      })
      .eq('id', installment.financial_transaction_id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (txError || !transaction) {
      throw createError({ statusCode: 500, statusMessage: txError?.message || 'Erro ao atualizar transação financeira' })
    }

    // Update bank account balance and create statement entry
    const bankAccountId = installment.bank_account_id
    if (bankAccountId) {
      const { data: account, error: accountError } = await supabase
        .from('bank_accounts')
        .select('id, current_balance')
        .eq('id', bankAccountId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (accountError || !account) {
        throw createError({ statusCode: 500, statusMessage: 'Conta bancária não encontrada' })
      }

      const previousBalance = Number(account.current_balance || 0)
      const amount = Number(installment.amount || 0)
      const nextBalance = previousBalance + amount

      const { error: balanceError } = await supabase
        .from('bank_accounts')
        .update({ current_balance: nextBalance, updated_by: authUser.email })
        .eq('id', bankAccountId)
        .eq('organization_id', organizationId)

      if (balanceError) {
        throw createError({ statusCode: 500, statusMessage: balanceError.message })
      }

      const { error: statementError } = await supabase
        .from('bank_account_statements')
        .insert({
          organization_id: organizationId,
          bank_account_id: bankAccountId,
          financial_transaction_id: installment.financial_transaction_id,
          transaction_date: paymentDate,
          description: transaction.description,
          transaction_type: 'income',
          amount,
          previous_balance: previousBalance,
          balance_after: nextBalance,
          created_by: authUser.email
        })

      if (statementError) {
        // Rollback balance
        await supabase
          .from('bank_accounts')
          .update({ current_balance: previousBalance, updated_by: authUser.email })
          .eq('id', bankAccountId)
          .eq('organization_id', organizationId)
        throw createError({ statusCode: 500, statusMessage: statementError.message })
      }
    }
  }

  // Recalculate service order payment_status from all installments
  const { data: allInstallments } = await supabase
    .from('service_order_installments')
    .select('status')
    .eq('service_order_id', orderId)
    .eq('organization_id', organizationId)

  const statuses = (allInstallments ?? []).map(i => i.status)
  const allPaid = statuses.every(s => s === 'paid')
  const somePaid = statuses.some(s => s === 'paid')

  await supabase
    .from('service_orders')
    .update({
      payment_status: allPaid ? 'paid' : somePaid ? 'partial' : 'pending',
      updated_by: authUser.email
    })
    .eq('id', orderId)
    .eq('organization_id', organizationId)

  return { success: true }
})
