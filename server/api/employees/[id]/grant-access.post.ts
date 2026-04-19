import { getRouterParam, readBody } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'

/**
 * POST /api/employees/:id/grant-access
 * Links an existing auth user (who registered with the employee's email)
 * to this employee record by assigning the org, employee_id, and the
 * system 'employee' role to their user_profiles row.
 *
 * Flow:
 *   1. Admin creates the employee record with an email
 *   2. Employee registers at /signup using that exact email
 *   3. Admin clicks "Gerar Acesso" → this endpoint runs
 *   4. Employee can now log in as an org member
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Employee id is required' })
  }

  // 1. Load the employee
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, email, name')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (employeeError || !employee) {
    throw createError({ statusCode: 404, statusMessage: 'Funcionário não encontrado' })
  }

  if (!employee.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Funcionário não tem email cadastrado. Adicione um email antes de gerar acesso.' })
  }

  // 2. Check if already linked
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('employee_id', id)
    .maybeSingle()

  if (existingProfile) {
    throw createError({ statusCode: 400, statusMessage: 'Funcionário já possui acesso ao sistema.' })
  }

  // 3. Find the 'employee' system role for this org
  const { data: systemRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'employee')
    .eq('is_system_role', true)
    .maybeSingle()

  if (!systemRole) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Role de funcionário não encontrada. Acesse Permissões e verifique se o papel "employee" de sistema existe.'
    })
  }

  // 4. Find the user_profile by employee email
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('id, organization_id')
    .eq('email', employee.email.trim().toLowerCase())
    .maybeSingle()

  if (!targetProfile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Nenhum usuário encontrado com este email. O funcionário precisa criar a conta primeiro no link de cadastro.'
    })
  }

  if (targetProfile.organization_id && targetProfile.organization_id !== organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'Este usuário já está vinculado a outra organização.' })
  }

  // 5. Assign org, employee, and role
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      organization_id: organizationId,
      employee_id: id,
      role_id: systemRole.id,
      active: true,
      updated_by: authUser.email
    })
    .eq('id', targetProfile.id)

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao vincular acesso ao funcionário.' })
  }

  return {
    success: true,
    message: 'Acesso concedido com sucesso. O funcionário já pode fazer login.'
  }
})
