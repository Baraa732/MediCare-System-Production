import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type Unsubscribe,
} from "firebase/messaging";
import { useAuthStore } from "@/stores/authStore";
import { normalizeCaughtError } from "@/lib/api/errors";
import {
  fetchPushWebConfig,
  fetchStaffInbox,
  markAllStaffInboxRead,
  markStaffInboxRead,
  registerPushDevice,
  unregisterPushDevice,
  type FirebaseWebConfig,
  type StaffInboxItem,
} from "@/lib/api/notifications";

type NotificationPermissionState = NotificationPermission | "unsupported";

type NotificationContextValue = {
  items: StaffInboxItem[];
  unreadCount: number;
  permission: NotificationPermissionState;
  pushEnabled: boolean;
  isLoading: boolean;
  isEnabling: boolean;
  lastError: string | null;
  refreshInbox: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  requestPushPermission: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function showSystemNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const tag = data?.appointmentId || data?.category || "medicare-secretary";
  const notification = new Notification(title, {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag,
    requireInteraction: true,
    data,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

async function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorker | null> {
  if (registration.active) return registration.active;
  await navigator.serviceWorker.ready;
  if (registration.active) return registration.active;
  return navigator.serviceWorker.controller;
}

function initServiceWorker(worker: ServiceWorker, config: FirebaseWebConfig) {
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(false), 8000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(Boolean(event.data?.ok));
    };
    worker.postMessage({ type: "INIT_FCM", config }, [channel.port2]);
  });
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<StaffInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const fcmTokenRef = useRef<string | null>(null);
  const firebaseAppRef = useRef<FirebaseApp | null>(null);
  const messagingRef = useRef<Messaging | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const enablingRef = useRef(false);

  const refreshInbox = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const inbox = await fetchStaffInbox(accessToken, { page: 1, limit: 40 });
      setItems(inbox.items);
      setUnreadCount(inbox.unreadCount);
    } catch (err) {
      setLastError(
        normalizeCaughtError(err, "Failed to load notifications"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const markRead = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      await markStaffInboxRead(id, accessToken);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    },
    [accessToken],
  );

  const markAllRead = useCallback(async () => {
    if (!accessToken) return;
    await markAllStaffInboxRead(accessToken);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnreadCount(0);
  }, [accessToken]);

  const setupFirebaseMessaging = useCallback(
    async (interactive: boolean) => {
      if (!accessToken) return;
      if (enablingRef.current) return;
      enablingRef.current = true;
      if (interactive) setIsEnabling(true);

      try {
        if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
          setPermission("unsupported");
          setLastError("This browser does not support web push notifications.");
          return;
        }

        const supported = await isSupported();
        if (!supported) {
          setPermission("unsupported");
          setLastError("Firebase messaging is not supported in this browser.");
          return;
        }

        setPermission(Notification.permission);

        if (Notification.permission === "denied") {
          setLastError(
            "Browser notifications are blocked. Allow notifications for this site in the browser address bar, then try again.",
          );
          return;
        }

        if (Notification.permission === "default") {
          if (!interactive) return;
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result !== "granted") {
            setLastError(
              result === "denied"
                ? "Permission was denied. Allow notifications in the browser site settings."
                : "Notification permission was not granted.",
            );
            return;
          }
        }

        const config = await fetchPushWebConfig(accessToken);
        if (!config?.apiKey || !config.vapidKey) {
          setLastError(
            "Web push is not configured on the server. Firebase web API key and VAPID key are required.",
          );
          return;
        }

        const app =
          getApps().length > 0
            ? getApps()[0]!
            : initializeApp({
                apiKey: config.apiKey,
                authDomain: config.authDomain,
                projectId: config.projectId,
                messagingSenderId: config.messagingSenderId,
                appId: config.appId,
              });
        firebaseAppRef.current = app;

        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/", updateViaCache: "none" },
        );
        await registration.update().catch(() => undefined);
        const worker = await waitForActiveWorker(registration);
        if (!worker) {
          setLastError("Could not start the notification service worker.");
          return;
        }

        const swReady = await initServiceWorker(worker, config);
        if (!swReady) {
          setLastError(
            "The notification worker could not initialize Firebase. Refresh the page and try again.",
          );
        }

        const messaging = getMessaging(app);
        messagingRef.current = messaging;

        const fcmToken = await getToken(messaging, {
          vapidKey: config.vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (!fcmToken) {
          setLastError(
            "Could not create an FCM token. Check that this site is served over HTTPS.",
          );
          return;
        }

        const previous = fcmTokenRef.current;
        fcmTokenRef.current = fcmToken;

        if (previous && previous !== fcmToken) {
          await unregisterPushDevice(previous, accessToken).catch(() => undefined);
        }

        await registerPushDevice(
          fcmToken,
          accessToken,
          `web · ${navigator.platform} · secretary`,
        );

        if (!unsubscribeRef.current) {
          unsubscribeRef.current = onMessage(messaging, (payload) => {
            const title =
              payload.notification?.title ||
              payload.data?.title ||
              "MediCare Secretary";
            const body = payload.notification?.body || payload.data?.body || "";
            void refreshInbox();
            showSystemNotification(
              title,
              body,
              payload.data as Record<string, string>,
            );
          });
        }

        setPushEnabled(true);
        setLastError(null);
      } catch (err) {
        setPushEnabled(false);
        setLastError(
          normalizeCaughtError(
            err,
            "Could not enable browser push. Refresh and try again.",
          ),
        );
      } finally {
        enablingRef.current = false;
        setIsEnabling(false);
      }
    },
    [accessToken, refreshInbox],
  );

  const requestPushPermission = useCallback(async () => {
    await setupFirebaseMessaging(true);
    await refreshInbox();
  }, [setupFirebaseMessaging, refreshInbox]);

  useEffect(() => {
    if (!accessToken) {
      setItems([]);
      setUnreadCount(0);
      setPushEnabled(false);
      setLastError(null);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      return;
    }

    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }

    void refreshInbox();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void setupFirebaseMessaging(false);
    }
  }, [accessToken, refreshInbox, setupFirebaseMessaging]);

  useEffect(() => {
    if (!accessToken) return;

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshInbox();
      }
    }, 45_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshInbox();
      }
    };

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        void refreshInbox();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [accessToken, refreshInbox]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount,
      permission,
      pushEnabled,
      isLoading,
      isEnabling,
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
      isEnabling,
      lastError,
      refreshInbox,
      markRead,
      markAllRead,
      requestPushPermission,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
