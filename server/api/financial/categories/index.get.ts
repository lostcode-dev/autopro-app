import { defineEventHandler } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'

const DEFAULT_CATEGORIES = [
  { name: 'Vendas', type: 'income' },
  { name: 'Serviços', type: 'income' },
  { name: 'Outros', type: 'income' },
  { name: 'Aluguel', type: 'expense' },
  { name: 'Salários', type: 'expense' },
  { name: 'Fornecedores', type: 'expense' },
  { name: 'Impostos', type: 'expense' },
  { name: 'Marketing', type: 'expense' },
  { name: 'Outros', type: 'expense' }
]

/**
 * GET /api/financial/categories
 * Returns default + custom categories for the organization.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const { data: customCategories, error } = await supabase
    .from('financial_categories')
    .select('id, name, type')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    return { defaults: DEFAULT_CATEGORIES, custom: [] }
  }

  return {
    defaults: DEFAULT_CATEGORIES,
    custom: customCategories ?? []
  }
})
