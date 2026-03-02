import { z } from 'zod'
import { getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
})

type InvoiceRow = {
  stripe_invoice_id: string
  status: string | null
  currency: string | null
  total: number | null
  amount_paid: number | null
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  invoice_number: string | null
  created: string | null
  period_start: string | null
  period_end: string | null
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)

  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query',
      data: parsed.error.flatten()
    })
  }

  const { page, pageSize } = parsed.data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = getSupabaseAdminClient()
  const { data, error, count } = await supabase
    .from('invoices')
    .select('stripe_invoice_id,status,currency,total,amount_paid,hosted_invoice_url,invoice_pdf,invoice_number,created,period_start,period_end', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created', { ascending: false, nullsFirst: false })
    .range(from, to)
    .returns<InvoiceRow[]>()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load invoices'
    })
  }

  return {
    items: data ?? [],
    page,
    pageSize,
    total: count ?? 0
  }
})
