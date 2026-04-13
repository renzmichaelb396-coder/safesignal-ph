// SafeSignal PH — Service Worker
// Handles Web Push notifications for officer alarm when screen is off.
// CRITICAL: requireInteraction + renotify + vibrate keeps phone screaming until officer taps.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push event: fires even when screen is locked ─────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || '\uD83D\uDEA8 EMERGENCY \u2014 SafeSignal';
  const body  = data.body  || 'You have a new emergency assignment. Tap to respond immediately.';
  const url   = data.url   || '/officer';

  // SOS Morse-like vibration: three long bursts
  const vibration = [600, 200, 600, 200, 600];

  // Wake any open client tabs — they will show the alarm banner and play audio
  const clientPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      clients.forEach(c => c.postMessage({ type: 'SW_ALARM', payload: data }));
    });

  // Show persistent system notification — visible and audible even with screen off.
  // requireInteraction = true keeps it on screen until officer explicitly taps or dismisses.
  // renotify = true re-triggers device sound/vibration even if tag already shown.
  const notifPromise = self.registration.showNotification(title, {
    body,
    icon: '/pasay-police-badge.png',
    badge: '/pasay-police-badge.png',
    vibrate: vibration,
    requireInteraction: true,
    renotify: true,
    tag: 'sos-alarm',
    silent: false,
    actions: [
      { action: 'open',    title: '\uD83D\uDEA8 Open SafeSignal' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: { url },
  });

  event.waitUntil(Promise.all([clientPromise, notifPromise]));
});

// ── Notification click: open or focus the officer dashboard ──────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/officer';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing SafeSignal tab and fire alarm banner
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'SW_ALARM' });
          return;
        }
      }
      // No open tab — open one
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Message relay between tabs ───────────────────────────────────────────────
// If one tab sends SW_ALARM (e.g. polling detects assignment), forward to all others.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SW_ALARM') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(c => {
        if (c !== event.source) {
          c.postMessage({ type: 'SW_ALARM', payload: event.data.payload || null });
        }
      });
    });
  }
});
