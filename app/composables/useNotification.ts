type UseNotificationState = {
  isNotificationsSlideoverOpen: Ref<boolean>
  openNotifications: () => void
  closeNotifications: () => void
  toggleNotifications: () => void
}

export function useNotification(): UseNotificationState {
  const isNotificationsSlideoverOpen = useState('notifications-slideover-open', () => false)

  function openNotifications() {
    isNotificationsSlideoverOpen.value = true
  }

  function closeNotifications() {
    isNotificationsSlideoverOpen.value = false
  }

  function toggleNotifications() {
    isNotificationsSlideoverOpen.value = !isNotificationsSlideoverOpen.value
  }

  return {
    isNotificationsSlideoverOpen,
    openNotifications,
    closeNotifications,
    toggleNotifications
  }
}
