import { createError } from 'h3'
import { getSupabaseAdminClient } from './supabase'

// Mirrors PLAN_LICENSES in app/composables/usePlans.ts — keep in sync.
const EMPLOYEE_LIMITS: Record<string, number | null> = {
  starter: 2,
  pro: 10,
  fiscal: null,
}

export type OrgLicense = {
  planKey: string | null
  maxEmployees: number | null
}

export async function resolveOrgLicense(organizationId: string): Promise<OrgLicense> {
  const supabase = getSupabaseAdminClient()

  const { data } = await supabase
    .from('subscriptions')
    .select('plan_key')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  const planKey = data?.plan_key ?? null
  const maxEmployees = planKey !== null ? (EMPLOYEE_LIMITS[planKey] ?? null) : null

  return { planKey, maxEmployees }
}

export async function enforceEmployeeLimit(organizationId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { maxEmployees } = await resolveOrgLicense(organizationId)

  if (maxEmployees === null) return

  const { count, error } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .or('termination_date.is.null,termination_date.gt.now()')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to count employees' })
  }

  if (count !== null && count >= maxEmployees) {
    throw createError({
      statusCode: 403,
      statusMessage: `Seu plano permite no máximo ${maxEmployees} funcionário${maxEmployees !== 1 ? 's' : ''} ativo${maxEmployees !== 1 ? 's' : ''}. Faça upgrade para adicionar mais.`
    })
  }
}

// Reports restricted to Pro or above
const RESTRICTED_REPORTS = new Set(['debtors', 'customers', 'costs', 'sales-items'])

/**
 * Throws 403 if the organization's plan does not include the requested report.
 * @param report - one of: debtors | customers | costs | sales-items
 */
export async function enforceReportAccess(organizationId: string, report: string): Promise<void> {
  if (!RESTRICTED_REPORTS.has(report)) return

  const { planKey } = await resolveOrgLicense(organizationId)

  // null plan_key means no active subscription — deny access
  if (!planKey || planKey === 'starter') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Este relatório não está disponível no seu plano. Faça upgrade para o plano Pro ou Fiscal.'
    })
  }
}
