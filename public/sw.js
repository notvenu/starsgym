// Stars Gym service worker. Older Android browsers (Chrome before ~2023, Samsung Internet, Android Go) only offer
// "Install app" when a service worker handles fetches, and with one, losing signal shows our offline page instead of
// the browser's dinosaur. Pages and data are never cached here — they're per member and always come from the network;
// the browser's own HTTP cache already keeps the hashed /_next/static files.
const SHELL = "shell-v1"; // bump when offline.html or its images change
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
      await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)));
      // start the page request while the worker boots: no added delay on slow phones
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") {
    // the offline page's logo, from the cache; everything else goes straight to the network, untouched
    if (new URL(request.url).pathname === "/icon-192.png") event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
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
