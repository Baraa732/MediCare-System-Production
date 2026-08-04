import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging'
import { useAuthStore } from '../../store/authStore'
import { LIVE_POLL } from '../../lib/livePolling'
import {
  fetchPushWebConfig,
  fetchStaffInbox,
  markAllStaffInboxRead,
  markStaffInboxRead,
  registerPushDevice,
  unregisterPushDevice,
  type StaffInboxItem,
} from '../../api/notifications'

type NotificationPermissionState = NotificationPermission | 'unsupported'

type NotificationContextValue = {
  items: StaffInboxItem[]
  unreadCount: number
  permission: NotificationPermissionState
  pushEnabled: boolean
  isLoading: boolean
  lastError: string | null
  refreshInbox: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  requestPushPermission: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

function showSystemNotification(title: string, body: string, data?: Record<string, string>) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return
  }

  const tag = data?.category || 'medicare-system-manager'
  const notification = new Notification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag,
    requireInteraction: true,
    data,
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const [items, setItems] = useState<StaffInboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [permission, setPermission] = useState<NotificationPermissionState>('default')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const fcmTokenRef = useRef<string | null>(null)
  const firebaseAppRef = useRef<FirebaseApp | null>(null)
  const messagingRef = useRef<Messaging | null>(null)

  const refreshInbox = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const inbox = await fetchStaffInbox(token, { page: 1, limit: 30 })
      setItems(inbox.items)
      setUnreadCount(inbox.unreadCount)
      setLastError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications'
      setLastError(message)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return
      await markStaffInboxRead(id, token)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      )
      setUnreadCount((count) => Math.max(0, count - 1))
    },
    [token],
  )

  const markAllRead = useCallback(async () => {
    if (!token) return
    await markAllStaffInboxRead(token)
    const now = new Date().toISOString()
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })))
    setUnreadCount(0)
  }, [token])

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })
    registration.active?.postMessage({ type: 'INIT_FCM' })
    await navigator.serviceWorker.ready
    return registration
  }, [])

  const setupFirebaseMessaging = useCallback(async () => {
    if (!token) return

    const supported = await isSupported()
    if (!supported) {
      setPermission('unsupported')
      return
    }

    const config = await fetchPushWebConfig()
    if (!config) return

    const app = getApps().length > 0 ? getApps()[0]! : initializeApp(config)
    firebaseAppRef.current = app

    const registration = await registerServiceWorker()
    const messaging = getMessaging(app)
    messagingRef.current = messaging

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return
    } else {
      setPermission(Notification.permission)
      if (Notification.permission !== 'granted') return
    }

    const fcmToken = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration ?? undefined,
    })

    if (!fcmToken) return

    const previous = fcmTokenRef.current
    fcmTokenRef.current = fcmToken

    if (previous && previous !== fcmToken) {
      await unregisterPushDevice(previous, token).catch(() => undefined)
    }

    await registerPushDevice(
      fcmToken,
      token,
      `${navigator.platform} · ${navigator.userAgent.slice(0, 80)}`,
    )

    setPushEnabled(true)

    onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || 'MediCare Platform'
      const body = payload.notification?.body || payload.data?.body || ''

      void refreshInbox()
      showSystemNotification(title, body, payload.data as Record<string, string>)
    })
  }, [token, refreshInbox, registerServiceWorker])

  const requestPushPermission = useCallback(async () => {
    await setupFirebaseMessaging()
    await refreshInbox()
  }, [setupFirebaseMessaging, refreshInbox])

  useEffect(() => {
    if (!token) {
      setItems([])
      setUnreadCount(0)
      setPushEnabled(false)
      setLastError(null)
      return
    }

    void refreshInbox()
    void setupFirebaseMessaging()
  }, [token, refreshInbox, setupFirebaseMessaging])

  useEffect(() => {
    if (!token) return

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshInbox()
      }
    }, LIVE_POLL.notifications)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshInbox()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token, refreshInbox])

  useEffect(() => {
    return () => {
      const fcmToken = fcmTokenRef.current
      const auth = token
      if (fcmToken && auth) {
        void unregisterPushDevice(fcmToken, auth).catch(() => undefined)
      }
    }
  }, [token])

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount,
      permission,
      pushEnabled,
      isLoading,
      lastError,
      refreshInbox,
      markRead,
      markAllRead,
      requestPushPermission,
    }),
    [
      items,
      unreadCount,
      permission,
      pushEnabled,
      isLoading,
      lastError,
      refreshInbox,
      markRead,
      markAllRead,
      requestPushPermission,
    ],
  )

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}
