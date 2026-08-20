/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker for the Secretary dashboard.
 * Config is injected from the page via INIT_FCM, and also fetched on activate
 * so background messages still work after the worker restarts.
 */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

let messagingReady = false;
const API_BASE = '__API_BASE_URL__';

async function fetchWebConfig() {
  const urls = [];
  if (API_BASE && !API_BASE.includes('__API_BASE_URL__')) {
    urls.push(`${API_BASE.replace(/\/$/, '')}/notifications/push/web-config`);
  }
  urls.push('/fcm-web-config.json');

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const payload = await res.json();
      const config = payload?.config || payload;
      if (config?.apiKey && config?.projectId) return config;
    } catch {
      // try next source
    }
  }
  return null;
}

async function initMessaging(incomingConfig) {
  let config = incomingConfig;
  if (!config?.apiKey || !config?.projectId) {
    config = await fetchWebConfig();
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

  if (messagingReady) return true;

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((message) => {
    const title =
      message.notification?.title || message.data?.title || 'MediCare Secretary';
    const body = message.notification?.body || message.data?.body || '';
    const tag =
      message.data?.appointmentId ||
      message.data?.category ||
      'medicare-secretary';

    const clientsNotify = self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          client.postMessage({
            type: 'FCM_BACKGROUND',
            title,
            body,
            data: message.data || {},
          });
        }
      });

    const show = self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      requireInteraction: true,
      renotify: true,
      data: message.data || {},
    });

    return Promise.all([show, clientsNotify]);
  });

  messagingReady = true;
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([self.clients.claim(), initMessaging(null)]),
  );
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
