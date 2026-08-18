/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker for the System Manager dashboard.
 */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

let messagingReady = false;

async function initMessaging() {
  if (messagingReady || firebase.apps.length) {
    messagingReady = true;
    return;
  }

  const res = await fetch('/api/notifications/push/web-config', { credentials: 'include' });
  if (!res.ok) return;

  const payload = await res.json();
  const config = payload?.config;
  if (!config?.apiKey || !config?.projectId) return;

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((message) => {
    const title =
      message.notification?.title || message.data?.title || 'MediCare Platform';
    const body = message.notification?.body || message.data?.body || '';
    const tag = message.data?.category || 'medicare-system-manager';

    self.registration.showNotification(title, {
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
}

self.addEventListener('install', (event) => {
  event.waitUntil(initMessaging());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([initMessaging(), self.clients.claim()]));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    event.waitUntil(initMessaging());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const deepLink = data.deepLink || '/';
  const targetUrl = new URL(deepLink, self.location.origin).href;
  const payload = {
    type: 'NOTIFICATION_CLICK',
    deepLink,
    notificationId: data.notificationId || null,
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* SPA clients may reject navigate; postMessage still routes. */
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
