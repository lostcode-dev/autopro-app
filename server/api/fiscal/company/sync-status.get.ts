import { defineEventHandler, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'
import { getSupabaseAdminClient } from '../../../utils/supabase'

/**
 * GET /api/fiscal/company/sync-status
 *
 * Returns the Focus NFe sync status for the authenticated user's organization.
 * Used by the frontend to gate the NFS-e page and show a pre-fill sync modal
 * when the company has not been registered in Focus NFe yet.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  // Fetch organization base data (name, tax_id, address fields to pre-fill the form)
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select(
      'id, name, tax_id, phone, email, state_registration, street, address_number, address_complement, neighborhood, city, state, zip_code, municipality_code'
    )
    .eq('id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orgError) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao buscar dados da organização' })
  }

  if (!organization) {
    throw createError({ statusCode: 404, statusMessage: 'Organização não encontrada' })
  }

  // Fetch fiscal sync status row (may not exist yet)
  const { data: syncStatus, error: syncError } = await supabase
    .from('fiscal_sync_status')
    .select('id, tax_id, integration_status, is_company_synced, sync_status, sync_error_message, last_synced_at, last_sync_attempt_at, selected_state, contact_name, contact_cpf')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (syncError) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao buscar status fiscal' })
  }

  const isSynced = syncStatus?.is_company_synced === true

  return {
    success: true,
    is_synced: isSynced,
    organization_id: organizationId,
    sync: syncStatus
      ? {
          tax_id: syncStatus.tax_id,
          integration_status: syncStatus.integration_status,
          sync_status: syncStatus.sync_status,
          sync_error_message: syncStatus.sync_error_message,
          last_synced_at: syncStatus.last_synced_at,
          last_sync_attempt_at: syncStatus.last_sync_attempt_at,
          selected_state: syncStatus.selected_state,
          contact_name: syncStatus.contact_name ?? null,
          contact_cpf: syncStatus.contact_cpf ?? null
        }
      : null,
    organization: {
      id: organization.id,
      name: organization.name,
      tax_id: organization.tax_id,
      phone: organization.phone,
      email: organization.email,
      state_registration: organization.state_registration,
      street: organization.street,
      address_number: organization.address_number,
      address_complement: organization.address_complement,
      neighborhood: organization.neighborhood,
      city: organization.city,
      state: organization.state,
      zip_code: organization.zip_code,
      municipality_code: organization.municipality_code
    }
  }
})
