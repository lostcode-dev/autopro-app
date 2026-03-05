type UserPreferences = {
  primary_color: string
  neutral_color: string
  color_mode: string
}

type PreferencesState = {
  loaded: boolean
  primary_color: string
  neutral_color: string
  color_mode: string
}

export function useUserPreferences() {
  const state = useState<PreferencesState>('user-preferences', () => ({
    loaded: false,
    primary_color: 'green',
    neutral_color: 'slate',
    color_mode: 'dark'
  }))

  const appConfig = useAppConfig()
  const colorMode = useColorMode()

  async function load() {
    if (state.value.loaded) return

    try {
      const data = await $fetch<UserPreferences>('/api/settings/preferences')
      state.value.primary_color = data.primary_color
      state.value.neutral_color = data.neutral_color
      state.value.color_mode = data.color_mode
      state.value.loaded = true

      applyToApp()
    } catch {
      // Use defaults silently
      state.value.loaded = true
    }
  }

  function applyToApp() {
    appConfig.ui.colors.primary = state.value.primary_color
    appConfig.ui.colors.neutral = state.value.neutral_color
    colorMode.preference = state.value.color_mode
  }

  async function save(prefs: Partial<UserPreferences>) {
    if (prefs.primary_color) state.value.primary_color = prefs.primary_color
    if (prefs.neutral_color) state.value.neutral_color = prefs.neutral_color
    if (prefs.color_mode) state.value.color_mode = prefs.color_mode

    applyToApp()

    try {
      await $fetch('/api/settings/preferences', {
        method: 'PUT',
        body: {
          primary_color: state.value.primary_color,
          neutral_color: state.value.neutral_color,
          color_mode: state.value.color_mode
        }
      })
    } catch {
      // Silently fail — local state already updated
    }
  }

  async function setPrimaryColor(color: string) {
    await save({ primary_color: color })
  }

  async function setNeutralColor(color: string) {
    await save({ neutral_color: color })
  }

  async function setColorMode(mode: string) {
    await save({ color_mode: mode })
  }

  return {
    state: readonly(state),
    load,
    setPrimaryColor,
    setNeutralColor,
    setColorMode
  }
}
