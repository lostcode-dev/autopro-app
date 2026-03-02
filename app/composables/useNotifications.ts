import { createSharedComposable } from '@vueuse/core'

export enum NotificationType {
  User = 'user',
  System = 'system'
}

export type AppNotification = {
  id: number
  type: NotificationType
  unread?: boolean
  body: string
  date: string
  linkPath?: string | null
  sender: {
    name: string
    email?: string
    avatar?: { src?: string }
  }
}

type ListResponse = AppNotification[]

type UseNotificationsState = {
  items: Ref<AppNotification[]>
  pending: Ref<boolean>
  unreadCount: ComputedRef<number>
  refresh: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  ensureReady: () => Promise<void>
}

const _useNotifications = (): UseNotificationsState => {
  const items = ref<AppNotification[]>([])
  const pending = ref(false)
  const hasLoaded = ref(false)

  const unreadCount = computed(() => items.value.filter(n => n.unread).length)

  async function refresh() {
    pending.value = true
    try {
      const data = await $fetch<ListResponse>('/api/notifications')
      items.value = data
      hasLoaded.value = true
    }
    finally {
      pending.value = false
    }
  }

  async function ensureReady() {
    if (hasLoaded.value)
      return

    await refresh()
  }

  async function markRead(id: number) {
    await $fetch('/api/notifications/read', { method: 'POST', body: { id } })
    const n = items.value.find(i => i.id === id)
    if (n)
      n.unread = false
  }

  async function markAllRead() {
    await $fetch('/api/notifications/read-all', { method: 'POST' })
    items.value = items.value.map(n => ({ ...n, unread: false }))
  }

  return {
    items,
    pending,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
    ensureReady
  }
}

export const useNotifications = createSharedComposable(_useNotifications)
