// Stars Gym service worker. Older Android browsers (Chrome before ~2023, Samsung Internet, Android Go) only offer
// "Install app" when a service worker handles fetches, and with one, losing signal shows our offline page instead of
// the browser's dinosaur. Pages and data are never cached here — they're per member and always come from the network;
// the browser's own HTTP cache already keeps the hashed /_next/static files.
// It also shows push notifications, and receives screenshots shared into the app (manifest share_target).
const SHELL = "shell-v2"; // bump when offline.html or its images change
const SHARED = "shared"; // a screenshot shared from another app, waiting for /share to pick it up
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll([OFFLINE, "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL && k !== SHARED).map((k) => caches.delete(k)));
      // start the page request while the worker boots: no added delay on slow phones
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // "Share → Stars Gym" from a UPI app: keep the image, then open the page that sends it to the desk
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const file = (await request.formData()).get("proof");
          const cache = await caches.open(SHARED);
          if (file && typeof file !== "string") await cache.put("/shared-proof", new Response(file, { headers: { "Content-Type": file.type } }));
        } catch {}
        return Response.redirect("/share", 303);
      })(),
    );
    return;
  }
  if (request.mode !== "navigate") {
    // the offline page's logo, from the cache; everything else goes straight to the network, untouched
    if (url.pathname === "/icon-192.png") event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(request));
      } catch {
        return (await caches.match(OFFLINE)) || Response.error();
      }
    })(),
  );
});

// ── Push notifications (sent by src/lib/push.ts) ──
self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "Stars Gym", {
      body: msg.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png", // the small status-bar icon on Android: white shape on transparent
      tag: msg.tag, // a newer message with the same tag replaces the older one
      data: { url: msg.url || "/app" },
    }),
  );
});

// tapping a notification: focus an open Stars Gym window and go there, or open one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return open.navigate(target).catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    })(),
  );
});
