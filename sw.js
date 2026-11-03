
const CACHE_NAME = "excel-editor-v1";

const ASSETS = [
    "/",
    "/index.html",
    "/app.js",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm",
    "https://cdn.jsdelivr.net/npm/hyperformula@3.5.0/+esm",
    "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/css/all.min.css"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            await Promise.allSettled(
                ASSETS.map(url => cache.add(url))
            );
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if(request.method !== "GET") return;

    const url = new URL(request.url);

    if(url.pathname.startsWith("/api/")) return;

    event.respondWith(
        caches.match(request).then(cached => {
            if(cached) return cached;

            return fetch(request).then(response => {
                if(response.ok) {
                    const copy = response.clone();

                    caches.open(CACHE_NAME).then(cache =>
                        cache.put(request,copy)
                    );
                }

                return response;
            }).catch(() =>
                caches.match("/index.html")
            );
        })
    );
});
