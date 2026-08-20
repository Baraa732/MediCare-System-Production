/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker for the Secretary dashboard.
 * Config is injected from the page via INIT_FCM (production has no /api proxy).
 */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

let messagingReady = false;

async function initMessaging(incomingConfig) {
  if (messagingReady) return true;

  let config = incomingConfig;
  if (!config?.apiKey || !config?.projectId) {
    try {
      const res = await fetch('/fcm-web-config.json', { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        config = payload?.config || payload;
      }
    } catch {
      // Page INIT_FCM is the primary path.
    }
  }

  if (!config?.apiKey || !config?.projectId || !config?.messagingSenderId || !config?.appId) {
    return false;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
  }

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((message) => {
    const title =
      message.notification?.title || message.data?.title || 'MediCare Secretary';
    const body = message.notification?.body || message.data?.body || '';
    const tag =
      message.data?.appointmentId ||
      message.data?.category ||
      'medicare-secretary';

    return self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      requireInteraction: true,
      renotify: true,
      data: message.data || {},
    });
  });

  messagingReady = true;
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'INIT_FCM') return;
  event.waitUntil(
    initMessaging(event.data.config).then((ok) => {
      event.ports?.[0]?.postMessage({ type: 'FCM_READY', ok });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const deepLink = data.deepLink || '/dashboard';
  const targetUrl = new URL(deepLink, self.location.origin).href;
  const payload = {
    type: 'NOTIFICATION_CLICK',
    deepLink,
    notificationId: data.notificationId || null,
  };

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin)) {
            if ('navigate' in client && typeof client.navigate === 'function') {
              try {
                await client.navigate(targetUrl);
              } catch {
                // SPA clients may reject navigate; postMessage still routes.
              }
            }
            if ('focus' in client) {
              await client.focus();
            }
            client.postMessage(payload);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
