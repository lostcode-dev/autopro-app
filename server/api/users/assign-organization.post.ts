import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { getUserProfileByEmail } from '../../utils/organization'

/**
 * POST /api/users/assign-organization
 * Assigns organization_id, employee_id and role_id to a user.
 * Migrated from: supabase/functions/assignOrganizationToUser
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = await readBody(event)
  const { user_email, employee_email, organization_id, employee_id, role_id } = body || {}

  if (!user_email || typeof user_email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'user_email é obrigatório' })
  }

  if (!employee_email || typeof employee_email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'employee_email é obrigatório' })
  }

  if (user_email.trim().toLowerCase() !== employee_email.trim().toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'Email do usuário deve ser igual ao email do funcionário' })
  }

  if (!employee_id || typeof employee_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'employee_id é obrigatório' })
  }

  if (!role_id || typeof role_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'role_id é obrigatório' })
  }

  // Get current user profile to resolve organization_id
  const currentProfile = await getUserProfileByEmail(authUser.email!)
  if (!currentProfile) {
    throw createError({ statusCode: 404, statusMessage: 'Usuário atual não encontrado' })
  }

  const targetOrganizationId = organization_id || currentProfile.organization_id
  if (!targetOrganizationId) {
    throw createError({ statusCode: 400, statusMessage: 'organization_id é obrigatório' })
  }

  // Find target user by email
  const targetProfile = await getUserProfileByEmail(user_email.trim())
  if (!targetProfile) {
    throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado com este email' })
  }

  if (targetProfile.organization_id) {
    throw createError({ statusCode: 400, statusMessage: 'Usuário já está vinculado a uma organização' })
  }

  // Assign organization_id, employee_id and role_id
  const { error } = await supabase
    .from('user_profiles')
    .update({
      organization_id: targetOrganizationId,
      employee_id,
      role_id,
      updated_by: authUser.email
    })
    .eq('id', targetProfile.id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao atribuir dados ao usuário' })
  }

  return {
    success: true,
    user_id: targetProfile.id,
    organization_id: targetOrganizationId,
    employee_id,
    role_id,
    message: 'Dados atribuídos com sucesso'
  }
})
