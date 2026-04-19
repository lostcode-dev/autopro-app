import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_USER_PREFERENCES = {
  primary_color: 'purple',
  neutral_color: 'slate',
  color_mode: 'light',
  timezone: 'UTC'
}

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  channel_in_app: true,
  channel_email: true,
  channel_web_push: false,
  channel_mobile_push: false,
  weekly_digest: false,
  product_updates: true,
  important_updates: true,
  web_push_permission: 'default',
  mobile_push_permission: 'default'
}

type EnsureUserProvisioningInput = {
  userId: string
  email?: string | null
  displayName?: string | null
  organizationId?: string | null
  roleId?: string | null
  employeeId?: string | null
  isActive?: boolean
  createdBy?: string | null
  updatedBy?: string | null
}

export async function ensureUserProvisioned(
  supabase: SupabaseClient,
  input: EnsureUserProvisioningInput
) {
  const normalizedEmail = input.email?.trim().toLowerCase() || null
  const normalizedName = input.displayName?.trim() || null

  const profilePayload = {
    user_id: input.userId,
    email: normalizedEmail,
    display_name: normalizedName,
    organization_id: input.organizationId ?? null,
    role_id: input.roleId ?? null,
    employee_id: input.employeeId ?? null,
    is_active: input.isActive ?? true,
    ...(input.createdBy ? { created_by: input.createdBy } : {}),
    ...(input.updatedBy ? { updated_by: input.updatedBy } : {})
  }

  const [profileResult, userPreferencesResult, notificationPreferencesResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' }),
    supabase
      .from('user_preferences')
      .upsert({
        user_id: input.userId,
        ...DEFAULT_USER_PREFERENCES
      }, { onConflict: 'user_id' }),
    supabase
      .from('notification_preferences')
      .upsert({
        user_id: input.userId,
        ...DEFAULT_NOTIFICATION_PREFERENCES
      }, { onConflict: 'user_id' })
  ])

  if (profileResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: `user_profiles: ${profileResult.error.message}`
    })
  }

  if (userPreferencesResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: `user_preferences: ${userPreferencesResult.error.message}`
    })
  }

  if (notificationPreferencesResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: `notification_preferences: ${notificationPreferencesResult.error.message}`
    })
  }
}
