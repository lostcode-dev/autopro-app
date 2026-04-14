import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { setAuthCookies } from '../../utils/auth-cookies'
import { setAuthUserCookie, toAuthUser } from '../../utils/auth-user'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
})

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
      data: parsed.error.flatten()
    })
  }

  const supabase = getSupabaseAnonClient()

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name
      }
    }
  })

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  if (data.user) {
    const supabaseAdmin = getSupabaseAdminClient()

    const [profileResult, userPreferencesResult, notificationPreferencesResult] = await Promise.all([
      supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: data.user.id,
          email: data.user.email,
          display_name: parsed.data.name
        }, { onConflict: 'user_id' }),
      supabaseAdmin
        .from('user_preferences')
        .upsert({
          user_id: data.user.id,
          primary_color: 'purple',
          neutral_color: 'slate',
          color_mode: 'light',
          timezone: 'UTC'
        }, { onConflict: 'user_id' }),
      supabaseAdmin
        .from('notification_preferences')
        .upsert({
          user_id: data.user.id,
          channel_in_app: true,
          channel_email: true,
          channel_web_push: false,
          channel_mobile_push: false,
          weekly_digest: false,
          product_updates: true,
          important_updates: true,
          web_push_permission: 'default',
          mobile_push_permission: 'default'
        }, { onConflict: 'user_id' })
    ])

    if (profileResult.error) {
      console.error('[signup] user_profiles upsert failed:', profileResult.error)
      throw createError({
        statusCode: 500,
        statusMessage: `user_profiles: ${profileResult.error.message}`
      })
    }

    if (userPreferencesResult.error) {
      console.error('[signup] user_preferences upsert failed:', userPreferencesResult.error)
      throw createError({
        statusCode: 500,
        statusMessage: `user_preferences: ${userPreferencesResult.error.message}`
      })
    }

    if (notificationPreferencesResult.error) {
      console.error('[signup] notification_preferences upsert failed:', notificationPreferencesResult.error)
      throw createError({
        statusCode: 500,
        statusMessage: `notification_preferences: ${notificationPreferencesResult.error.message}`
      })
    }
  }

  if (data.session) {
    if (data.user) {
      setAuthUserCookie(event, {
        user: toAuthUser(data.user),
        expiresAt: data.session.expires_at ?? null,
        syncedAt: Date.now()
      })
    }

    setAuthCookies(event, data.session)
  }

  return {
    user: data.user ? toAuthUser(data.user) : null,
    session: data.session ? { expiresAt: data.session.expires_at ?? null } : null
  }
})
