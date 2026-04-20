enum ThemeContext {
  Public = 'public',
  App = 'app'
}

enum ColorModePreference {
  Light = 'light',
  Dark = 'dark'
}

type UserPreferences = {
  primary_color: string
  neutral_color: string
  color_mode: ColorModePreference
  timezone: string
}

type PreferencesState = {
  loaded: boolean
  primary_color: string
  neutral_color: string
  color_mode: ColorModePreference
  timezone: string
}

type ThemePreset = UserPreferences

let loadPromise: Promise<void> | null = null

const PUBLIC_THEME: ThemePreset = {
  // Public pages keep the fixed AutoPro branding.
  primary_color: 'purple',
  neutral_color: 'slate',
  color_mode: ColorModePreference.Light,
  timezone: 'UTC'
}

const BRAND_THEME: ThemePreset = {
  primary_color: 'purple',
  neutral_color: 'slate',
  color_mode: ColorModePreference.Light,
  timezone: 'UTC'
}

export function useUserPreferences() {
  const state = useState<PreferencesState>('user-preferences', () => ({
    loaded: false,
    primary_color: BRAND_THEME.primary_color,
    neutral_color: BRAND_THEME.neutral_color,
    color_mode: BRAND_THEME.color_mode,
    timezone: BRAND_THEME.timezone
  }))

  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const requestFetch = useRequestFetch()
  const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  function applyTheme(theme: ThemePreset) {
    appConfig.ui.colors.primary = theme.primary_color
    appConfig.ui.colors.neutral = theme.neutral_color
    colorMode.preference = theme.color_mode
  }

  async function load() {
    if (state.value.loaded) return
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      try {
        const data = await requestFetch<UserPreferences>('/api/settings/preferences', {
          headers: requestHeaders
        })

        state.value.primary_color = data.primary_color
        state.value.neutral_color = data.neutral_color
        state.value.color_mode = data.color_mode
        state.value.timezone = data.timezone
      } catch {
        // Keep brand defaults silently when preferences cannot be loaded.
      } finally {
        state.value.loaded = true
        loadPromise = null
      }
    })()

    return loadPromise
  }

  function applyStoredTheme() {
    applyTheme({
      primary_color: state.value.primary_color,
      neutral_color: state.value.neutral_color,
      color_mode: state.value.color_mode,
      timezone: state.value.timezone
    })
  }

  function applyContextTheme(context: ThemeContext) {
    if (context === ThemeContext.Public) {
      applyTheme(PUBLIC_THEME)
      return
    }

    if (!state.value.loaded) {
      applyTheme(BRAND_THEME)
      return
    }

    applyStoredTheme()
  }

  async function save(prefs: Partial<UserPreferences>) {
    if (prefs.primary_color) state.value.primary_color = prefs.primary_color
    if (prefs.neutral_color) state.value.neutral_color = prefs.neutral_color
    if (prefs.color_mode) state.value.color_mode = prefs.color_mode
    if (prefs.timezone) state.value.timezone = prefs.timezone
    state.value.loaded = true

    applyStoredTheme()

    try {
      await requestFetch('/api/settings/preferences', {
        method: 'PUT',
        headers: requestHeaders,
        body: {
          primary_color: state.value.primary_color,
          neutral_color: state.value.neutral_color,
          color_mode: state.value.color_mode,
          timezone: state.value.timezone
        }
      })
    } catch {
      // Silently fail; local state is already updated for the current session.
    }
  }

  async function setPrimaryColor(color: string) {
    await save({ primary_color: color })
  }

  async function setNeutralColor(color: string) {
    await save({ neutral_color: color })
  }

  async function setColorMode(mode: string) {
    await save({ color_mode: mode as ColorModePreference })
  }

  async function setTimezone(timezone: string) {
    await save({ timezone })
  }

  return {
    state: readonly(state),
    applyBrandTheme: () => applyContextTheme(ThemeContext.App),
    applyPublicTheme: () => applyContextTheme(ThemeContext.Public),
    applyStoredTheme,
    load,
    setPrimaryColor,
    setNeutralColor,
    setColorMode,
    setTimezone
  }
}
