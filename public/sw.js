// SafeSignal PH — Service Worker
// Handles Web Push notifications for officer alarm when screen is off

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push event: fires even when screen is off ─────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || '\uD83D\uDEA8 EMERGENCY \u2014 SafeSignal';
  const body  = data.body  || 'You have a new emergency assignment. Tap to respond.';
  const url   = data.url   || '/dispatch/login';

  // Try to wake any open client tabs first (they will play the full audio alarm)
  const clientPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      clients.forEach(c => c.postMessage({ type: 'SW_ALARM', payload: data }));
    });

  // Show persistent system notification — visible and audible even with screen off
  const notifPromise = self.registration.showNotification(title, {
    body,
    icon: '/safesignal-icon.png',
    badge: '/safesignal-icon.png',
    vibrate: [500, 150, 500, 150, 500, 150, 800, 150, 500, 150, 500],
    requireInteraction: true,
    renotify: true,
    tag: 'sos-alarm',
    silent: false,
    actions: [
      { action: 'open',    title: '\uD83D\uDEA8 Open Dashboard' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: { url },
  });

  event.waitUntil(Promise.all([clientPromise, notifPromise]));
});

// ── Notification click: open or focus the officer dashboard ──────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dispatch/login';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('/dispatch') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'SW_ALARM' });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
