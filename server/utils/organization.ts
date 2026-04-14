import type { H3Event } from 'h3'
import { getSupabaseAdminClient } from './supabase'

/**
 * Resolves the organization_id for the authenticated user.
 * Queries user_profiles to find the linked organization.
 */
export async function resolveOrganizationId(event: H3Event, userId: string) {
  const supabase = getSupabaseAdminClient()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch user profile' })
  }

  if (!profile?.organization_id) {
    throw createError({ statusCode: 400, statusMessage: 'Usuário não vinculado a uma organização' })
  }

  return profile.organization_id as string
}

/**
 * Resolves the full user profile for the authenticated user.
 */
export async function getUserProfile(userId: string) {
  const supabase = getSupabaseAdminClient()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch user profile' })
  }

  return profile
}

/**
 * Resolves a user profile by email.
 */
export async function getUserProfileByEmail(email: string) {
  const supabase = getSupabaseAdminClient()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch user profile' })
  }

  return profile
}
