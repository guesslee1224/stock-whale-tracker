// Whale Tracker — Service Worker
// Handles Web Push notifications and provides basic offline support.
// iOS 16.4+ supports web push for PWAs added to the home screen.

const CACHE_NAME = "whale-tracker-v1";
const OFFLINE_URL = "/offline.html";

// ── Install: cache the offline fallback page ─────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/manifest.json", "/icons/icon-192.png"])
    )
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with offline fallback for navigation ─────────────
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
  }
});

// ── Push: show notification when push event received ─────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Whale Tracker", body: event.data ? event.data.text() : "New whale activity detected" };
  }

  const { title = "Whale Tracker", body = "New activity detected", data: notifData = {} } = data;

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: notifData,
    // Use ticker as tag so multiple alerts for same stock replace each other
    tag: notifData.ticker ?? "whale-alert",
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: "open-feed", title: "View Feed" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click: open app to the feed ─────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/feed";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(targetUrl);
      })
  );
});
