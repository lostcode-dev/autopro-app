type ToastColor = 'success' | 'error' | 'info' | 'warning'

type ToastStateItem = Record<string, unknown> & {
  color?: string
  icon?: string
}

const TOAST_ICONS: Record<ToastColor, string> = {
  success: 'i-lucide-circle-check',
  error: 'i-lucide-octagon-x',
  info: 'i-lucide-info',
  warning: 'i-lucide-triangle-alert'
}

function getToastIcon(color?: string) {
  if (!color)
    return

  return TOAST_ICONS[color as ToastColor]
}

export default defineNuxtPlugin(() => {
  const toasts = useState<ToastStateItem[]>('toasts', () => [])

  watch(toasts, (currentToasts) => {
    let shouldUpdate = false

    const nextToasts = currentToasts.map((toast) => {
      const icon = getToastIcon(toast.color)

      if (!icon || toast.icon)
        return toast

      shouldUpdate = true
      return {
        ...toast,
        icon
      }
    })

    if (shouldUpdate)
      toasts.value = nextToasts
  }, { deep: false })
})
