import { defineEventHandler, getQuery, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'

/**
 * GET /api/consulta
 * Public consultation endpoint — returns employee financial records by CPF.
 * No authentication required (employee self-service).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const cpf = String(query.cpf || '').replace(/\D/g, '').trim()

  if (!cpf || cpf.length !== 11) {
    throw createError({ statusCode: 400, statusMessage: 'CPF inválido' })
  }

  const supabase = getSupabaseAdminClient()

  // Find employee by CPF (tax_id)
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, tax_id, organization_id')
    .eq('tax_id', cpf)
    .is('deleted_at', null)
    .maybeSingle()

  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'CPF não encontrado em nossa base de dados' })
  }

  // Get financial records for this employee
  const { data: records } = await supabase
    .from('employee_financial_records')
    .select('id, type, amount, reference_date, status, due_date, payment_date, notes, service_order_id')
    .eq('employee_id', employee.id)
    .order('reference_date', { ascending: false })
    .limit(100)

  return {
    data: {
      employee: {
        id: employee.id,
        name: employee.name,
        // Mask CPF for display: show only last 4 digits
        tax_id_masked: `***.***.***-${cpf.slice(9)}`,
      },
      records: records ?? [],
      summary: {
        totalPaid: (records ?? []).filter(r => r.status === 'paid').reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0),
        totalPending: (records ?? []).filter(r => r.status !== 'paid').reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0),
        recordCount: (records ?? []).length,
      },
    },
  }
})
