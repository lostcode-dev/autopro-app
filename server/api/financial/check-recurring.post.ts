import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { addMonths, format } from 'date-fns'

/**
 * POST /api/financial/check-recurring
 * Creates child entries for recurring financial_transactions that need new pending entries.
 * Admin only.
 * Migrated from: supabase/functions/verificarRecorrentes
 */

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)

  // Admin guard — check user role
  const supabase = getSupabaseAdminClient()
  const { data: userData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  if (!userData || userData.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin access required' })
  }

  // Fetch all recurring parent entries (no end date, no parent)
  const { data: lancamentosRecorrentes } = await supabase
    .from('financial_transactions')
    .select('*')
    .in('recurrence', ['mensal', 'anual'])
    .is('recurrence_end_date', null)
    .is('recurring_parent_id', null)
    .is('deleted_at', null)

  let totalCriados = 0

  for (const lancamentoPai of lancamentosRecorrentes || []) {
    // Count pending entries in this series
    const { data: lancamentosSerie } = await supabase
      .from('financial_transactions')
      .select('id')
      .or(`id.eq.${lancamentoPai.id},recurring_parent_id.eq.${lancamentoPai.id}`)
      .eq('status', 'pendente')
      .is('deleted_at', null)

    const quantidadePendentes = lancamentosSerie?.length || 0

    if (quantidadePendentes <= 11) {
      // Find the latest entry in the series
      const { data: todosLancamentosSerie } = await supabase
        .from('financial_transactions')
        .select('*')
        .or(`id.eq.${lancamentoPai.id},recurring_parent_id.eq.${lancamentoPai.id}`)
        .is('deleted_at', null)
        .order('due_date', { ascending: false })
        .limit(1)

      if (todosLancamentosSerie && todosLancamentosSerie.length > 0) {
        const ultimoLancamento = todosLancamentosSerie[0]
        const incremento = lancamentoPai.recurrence === 'mensal' ? 1 : 12

        const dataProximoLancamento = addMonths(
          new Date(ultimoLancamento.due_date + 'T00:00:00'),
          incremento
        )

        await supabase.from('financial_transactions').insert({
          description: lancamentoPai.description,
          amount: lancamentoPai.amount,
          due_date: format(dataProximoLancamento, 'yyyy-MM-dd'),
          type: lancamentoPai.type,
          status: 'pendente',
          category: lancamentoPai.category,
          notes: lancamentoPai.notes,
          recurrence: lancamentoPai.recurrence,
          recurrence_end_date: lancamentoPai.recurrence_end_date,
          recurring_parent_id: lancamentoPai.id,
          bank_account_id: lancamentoPai.bank_account_id,
          organization_id: lancamentoPai.organization_id,
          created_by: lancamentoPai.created_by
        })

        totalCriados++
      }
    }
  }

  return {
    success: true,
    message: `Verificação concluída. ${totalCriados} lançamento(s) recorrente(s) criado(s).`,
    totalCriados
  }
})
