import type { SupabaseClient } from '@supabase/supabase-js'

type SyncEmployeeAccessInput = {
  employeeId: string
  organizationId: string
  employeeName?: string | null
  terminationDate?: string | null
  deletedAt?: string | null
  updatedBy?: string | null
}

export function isEmployeeAccessRevoked(terminationDate?: string | null, deletedAt?: string | null) {
  if (deletedAt) return true
  if (!terminationDate) return false

  const parsedDate = new Date(terminationDate)
  if (Number.isNaN(parsedDate.getTime())) return false

  return parsedDate <= new Date()
}

async function resolveEmployeeRoleId(supabase: SupabaseClient, organizationId: string) {
  const { data: systemRole, error } = await supabase
    .from('roles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', 'employee')
    .eq('is_system_role', true)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Falha ao localizar o papel de funcionário: ${error.message}`
    })
  }

  if (!systemRole) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Role de funcionário não encontrada. Acesse Permissões e verifique se o papel "employee" de sistema existe.'
    })
  }

  return systemRole.id as string
}

export async function syncEmployeeLinkedUserAccess(
  supabase: SupabaseClient,
  input: SyncEmployeeAccessInput
) {
  const { data: linkedProfiles, error: linkedProfilesError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('employee_id', input.employeeId)
    .limit(1)

  if (linkedProfilesError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Falha ao localizar o usuário vinculado ao funcionário: ${linkedProfilesError.message}`
    })
  }

  if (!linkedProfiles || linkedProfiles.length === 0) {
    return { revoked: false, linked: false }
  }

  const shouldRevokeAccess = isEmployeeAccessRevoked(input.terminationDate, input.deletedAt)
  const normalizedName = input.employeeName?.trim() || null

  const basePayload: Record<string, unknown> = {
    is_active: !shouldRevokeAccess,
    updated_by: input.updatedBy ?? null
  }

  if (normalizedName) {
    basePayload.display_name = normalizedName
  }

  if (shouldRevokeAccess) {
    basePayload.organization_id = null
    basePayload.role_id = null
  } else {
    basePayload.organization_id = input.organizationId
    basePayload.role_id = await resolveEmployeeRoleId(supabase, input.organizationId)
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(basePayload)
    .eq('employee_id', input.employeeId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Falha ao sincronizar o acesso do funcionário: ${error.message}`
    })
  }

  return { revoked: shouldRevokeAccess, linked: true }
}
