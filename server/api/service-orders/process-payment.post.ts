import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/service-orders/process-payment
 * Creates payment entries, installments and commissions for a service order.
 * Migrated from: supabase/functions/processServiceOrderPayment
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)
  const {
    orderId,
    paymentMethod,
    bankAccountId,
    paymentTerminalId,
    installments: installmentsData,
    paymentDate
  } = body || {}

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId é obrigatório' })
  }

  const warnings: string[] = []

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Ordem de serviço não encontrada' })
  }

  if (order.payment_status === 'paid') {
    throw createError({ statusCode: 409, statusMessage: 'OS já possui pagamento registrado' })
  }

  const totalAmount = Number(order.total_amount || 0)
  const effectiveDate = paymentDate || new Date().toISOString().split('T')[0]

  // Handle installment payments
  if (Array.isArray(installmentsData) && installmentsData.length > 0) {
    for (let i = 0; i < installmentsData.length; i++) {
      const inst = installmentsData[i]
      const installmentNumber = i + 1

      // Create financial transaction for each installment
      const { data: transaction } = await supabase
        .from('financial_transactions')
        .insert({
          organization_id: organizationId,
          description: `Parcela ${installmentNumber}/${installmentsData.length} - OS #${order.number}`,
          type: 'income',
          amount: Number(inst.amount || 0),
          date: inst.due_date || effectiveDate,
          status: inst.status === 'paid' ? 'paid' : 'pending',
          payment_method: inst.payment_method || paymentMethod,
          service_order_id: orderId,
          bank_account_id: inst.bank_account_id || bankAccountId || null,
          payment_terminal_id: inst.payment_terminal_id || paymentTerminalId || null,
          created_by: authUser.email
        })
        .select()
        .single()

      // Create installment record
      await supabase
        .from('service_order_installments')
        .insert({
          organization_id: organizationId,
          service_order_id: orderId,
          installment_number: installmentNumber,
          amount: Number(inst.amount || 0),
          due_date: inst.due_date || effectiveDate,
          status: inst.status || 'pending',
          payment_method: inst.payment_method || paymentMethod,
          financial_transaction_id: transaction?.id || null,
          bank_account_id: inst.bank_account_id || bankAccountId || null,
          payment_terminal_id: inst.payment_terminal_id || paymentTerminalId || null,
          created_by: authUser.email
        })

      // Update bank account balance if paid
      if (inst.status === 'paid' && (inst.bank_account_id || bankAccountId) && transaction) {
        const accountId = inst.bank_account_id || bankAccountId
        try {
          const { data: account } = await supabase
            .from('bank_accounts')
            .select('current_balance')
            .eq('id', accountId)
            .maybeSingle()

          if (account) {
            const previousBalance = Number(account.current_balance || 0)
            const newBalance = previousBalance + Number(inst.amount || 0)

            await supabase
              .from('bank_accounts')
              .update({ current_balance: newBalance, updated_by: authUser.email })
              .eq('id', accountId)

            await supabase
              .from('bank_account_statements')
              .insert({
                organization_id: organizationId,
                bank_account_id: accountId,
                financial_transaction_id: transaction.id,
                type: 'credit',
                amount: Number(inst.amount || 0),
                previous_balance: previousBalance,
                current_balance: newBalance,
                date: inst.due_date || effectiveDate,
                description: `Parcela ${installmentNumber}/${installmentsData.length} - OS #${order.number}`,
                created_by: authUser.email
              })
          }
        } catch (err: any) {
          warnings.push(`Falha ao atualizar saldo bancário para parcela ${installmentNumber}: ${err.message}`)
        }
      }
    }

    // Update order status
    const allPaid = installmentsData.every((inst: any) => inst.status === 'paid')
    const somePaid = installmentsData.some((inst: any) => inst.status === 'paid')

    await supabase
      .from('service_orders')
      .update({
        payment_status: allPaid ? 'paid' : somePaid ? 'partial' : 'pending',
        payment_method: paymentMethod,
        is_installment: true,
        installment_count: installmentsData.length,
        updated_by: authUser.email
      })
      .eq('id', orderId)
  } else {
    // Single (cash) payment
    const { data: transaction } = await supabase
      .from('financial_transactions')
      .insert({
        organization_id: organizationId,
        description: `Recebimento OS #${order.number}`,
        type: 'income',
        amount: totalAmount,
        date: effectiveDate,
        status: 'paid',
        payment_method: paymentMethod,
        service_order_id: orderId,
        bank_account_id: bankAccountId || null,
        payment_terminal_id: paymentTerminalId || null,
        created_by: authUser.email
      })
      .select()
      .single()

    // Update bank account balance
    if (bankAccountId && transaction) {
      try {
        const { data: account } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', bankAccountId)
          .maybeSingle()

        if (account) {
          const previousBalance = Number(account.current_balance || 0)
          const newBalance = previousBalance + totalAmount

          await supabase
            .from('bank_accounts')
            .update({ current_balance: newBalance, updated_by: authUser.email })
            .eq('id', bankAccountId)

          await supabase
            .from('bank_account_statements')
            .insert({
              organization_id: organizationId,
              bank_account_id: bankAccountId,
              financial_transaction_id: transaction.id,
              type: 'credit',
              amount: totalAmount,
              previous_balance: previousBalance,
              current_balance: newBalance,
              date: effectiveDate,
              description: `Recebimento OS #${order.number}`,
              created_by: authUser.email
            })
        }
      } catch (err: any) {
        warnings.push(`Falha ao atualizar saldo bancário: ${err.message}`)
      }
    }

    // Update order as paid
    await supabase
      .from('service_orders')
      .update({
        payment_status: 'paid',
        payment_method: paymentMethod,
        is_installment: false,
        updated_by: authUser.email
      })
      .eq('id', orderId)
  }

  // Fetch updated order
  const { data: updatedOrder } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  return {
    data: {
      order: updatedOrder,
      warnings
    }
  }
})
