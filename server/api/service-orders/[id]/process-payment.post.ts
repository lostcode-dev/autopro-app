import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'
import { generateServiceOrderCommissions } from '../../../utils/service-order-commissions'

/**
 * POST /api/service-orders/:id/process-payment
 * Creates payment entries, installments and commissions for a service order.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  }

  const body = await readBody(event)
  const {
    paymentMethod,
    bankAccountId,
    paymentTerminalId,
    installments: installmentsData,
    paymentDate
  } = body || {}

  type InstallmentInput = {
    status?: string | null
  }

  const warnings: string[] = []

  function amountOf(value: unknown) {
    const parsed = Number(value || 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  async function createIncomeTransaction({
    description,
    amount,
    dueDate,
    status,
    bankAccountId,
    paymentMethod,
    paymentTerminalId,
    isInstallment,
    installmentCount,
    currentInstallment,
    parentTransactionId,
    notes
  }: {
    description: string
    amount: number
    dueDate: string
    status: 'paid' | 'pending'
    bankAccountId: string | null
    paymentMethod: string | null
    paymentTerminalId: string | null
    isInstallment: boolean
    installmentCount: number | null
    currentInstallment: number | null
    parentTransactionId: string | null
    notes: string
  }) {
    const { data: transaction, error: transactionError } = await supabase
      .from('financial_transactions')
      .insert({
        organization_id: organizationId,
        description,
        amount,
        due_date: dueDate,
        type: 'income',
        status,
        category: 'services',
        recurrence: null,
        is_installment: isInstallment,
        installment_count: installmentCount,
        current_installment: currentInstallment,
        parent_transaction_id: parentTransactionId,
        payment_method: paymentMethod,
        service_order_id: orderId,
        bank_account_id: bankAccountId,
        payment_terminal_id: paymentTerminalId,
        notes,
        created_by: authUser.email,
        updated_by: authUser.email
      })
      .select()
      .single()

    if (transactionError || !transaction) {
      throw createError({ statusCode: 500, statusMessage: transactionError?.message || 'Failed to create financial transaction' })
    }

    if (status === 'paid' && bankAccountId) {
      const { data: account, error: accountError } = await supabase
        .from('bank_accounts')
        .select('id, current_balance')
        .eq('id', bankAccountId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (accountError || !account) {
        await supabase.from('financial_transactions').delete().eq('id', transaction.id)
        throw createError({ statusCode: 500, statusMessage: accountError?.message || 'Failed to load bank account' })
      }

      const previousBalance = amountOf(account.current_balance)
      const nextBalance = previousBalance + amount

      const { error: accountUpdateError } = await supabase
        .from('bank_accounts')
        .update({ current_balance: nextBalance, updated_by: authUser.email })
        .eq('id', bankAccountId)
        .eq('organization_id', organizationId)

      if (accountUpdateError) {
        await supabase.from('financial_transactions').delete().eq('id', transaction.id)
        throw createError({ statusCode: 500, statusMessage: accountUpdateError.message })
      }

      const { error: statementError } = await supabase
        .from('bank_account_statements')
        .insert({
          organization_id: organizationId,
          bank_account_id: bankAccountId,
          financial_transaction_id: transaction.id,
          transaction_date: dueDate,
          description,
          transaction_type: 'income',
          amount,
          previous_balance: previousBalance,
          balance_after: nextBalance,
          notes,
          created_by: authUser.email
        })

      if (statementError) {
        await supabase
          .from('bank_accounts')
          .update({ current_balance: previousBalance, updated_by: authUser.email })
          .eq('id', bankAccountId)
          .eq('organization_id', organizationId)
        await supabase.from('financial_transactions').delete().eq('id', transaction.id)
        throw createError({ statusCode: 500, statusMessage: statementError.message })
      }
    }

    return transaction
  }

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Service order not found' })
  }

  if (order.status !== 'completed') {
    throw createError({ statusCode: 409, statusMessage: 'Only completed service orders can receive payment' })
  }

  if (order.payment_status === 'paid') {
    throw createError({ statusCode: 409, statusMessage: 'Service order already has registered payment' })
  }

  const totalAmount = Number(order.total_amount || 0)
  const effectiveDate = paymentDate || new Date().toISOString().split('T')[0]

  // Handle installment payments
  if (Array.isArray(installmentsData) && installmentsData.length > 0) {
    let parentTransactionId: string | null = null

    for (let i = 0; i < installmentsData.length; i++) {
      const inst = installmentsData[i]
      const installmentNumber = i + 1
      const installmentAmount = amountOf(inst.amount)
      const installmentDate = inst.due_date || effectiveDate
      const installmentStatus = inst.status === 'paid' ? 'paid' : 'pending'
      const installmentBankAccountId = inst.bank_account_id || bankAccountId || null
      const installmentTerminalId = inst.payment_terminal_id || paymentTerminalId || null
      const description = `Recebimento ${installmentNumber}/${installmentsData.length} - OS #${order.number}`
      const notes = `Pagamento da ordem de serviço #${order.number}`

      const transaction = await createIncomeTransaction({
        description,
        amount: installmentAmount,
        dueDate: installmentDate,
        status: installmentStatus,
        bankAccountId: installmentBankAccountId,
        paymentMethod: inst.payment_method || paymentMethod || null,
        paymentTerminalId: installmentTerminalId,
        isInstallment: installmentsData.length > 1,
        installmentCount: installmentsData.length,
        currentInstallment: installmentNumber,
        parentTransactionId,
        notes
      })

      if (!parentTransactionId) {
        parentTransactionId = transaction.id
      }

      // Create installment record
      const { error: installmentError } = await supabase
        .from('service_order_installments')
        .insert({
          organization_id: organizationId,
          service_order_id: orderId,
          installment_number: installmentNumber,
          amount: installmentAmount,
          due_date: installmentDate,
          payment_date: installmentStatus === 'paid' ? effectiveDate : null,
          status: installmentStatus,
          payment_method: inst.payment_method || paymentMethod,
          financial_transaction_id: transaction?.id || null,
          bank_account_id: installmentBankAccountId,
          payment_terminal_id: installmentTerminalId,
          created_by: authUser.email,
          updated_by: authUser.email
        })

      if (installmentError) {
        throw createError({ statusCode: 500, statusMessage: installmentError.message })
      }
    }

    // Update order status
    const allPaid = installmentsData.every((inst: InstallmentInput) => inst.status === 'paid')
    const somePaid = installmentsData.some((inst: InstallmentInput) => inst.status === 'paid')

    await supabase
      .from('service_orders')
      .update({
        payment_status: allPaid ? 'paid' : somePaid ? 'partial' : 'pending',
        payment_method: paymentMethod,
        is_installment: installmentsData.length > 1,
        installment_count: installmentsData.length,
        updated_by: authUser.email
      })
      .eq('id', orderId)
  } else {
    // Single (cash) payment
    await createIncomeTransaction({
      description: `Recebimento da OS #${order.number}`,
      amount: totalAmount,
      dueDate: effectiveDate,
      status: 'paid',
      bankAccountId: bankAccountId || null,
      paymentMethod: paymentMethod || null,
      paymentTerminalId: paymentTerminalId || null,
      isInstallment: false,
      installmentCount: null,
      currentInstallment: null,
      parentTransactionId: null,
      notes: `Pagamento à vista da ordem de serviço #${order.number}`
    })

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

  const commissionResult = await generateServiceOrderCommissions({
    supabase,
    organizationId,
    orderId,
    userEmail: authUser.email
  })

  warnings.push(...commissionResult.warnings)

  // Fetch updated order
  const { data: updatedOrder } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  return {
    data: {
      order: updatedOrder,
      commissions: commissionResult.commissions,
      totalCommission: commissionResult.totalCommission,
      warnings
    }
  }
})
