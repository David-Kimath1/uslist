// ==================== USLIST SERVICE WORKER ====================
// Caches static assets so the app opens instantly and works offline
// for already-loaded pages.

const CACHE_NAME = "uslist-v9";

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./css/style.css",
    "./css/components.css",
    "./css/responsive.css",
    "./js/theme.js",
    "./js/sidebar.js",
    "./js/auth.js",
    "./js/notifications.js",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png"
];


// ---------- INSTALL ----------
self.addEventListener("install", (event) => {

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS).catch(() => {});
        })
    );

});


// ---------- ACTIVATE ----------
self.addEventListener("activate", (event) => {

    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            )
        )
    );

    self.clients.claim();

});


// ---------- FETCH ----------
// Network-first, cache fallback. Only caches GET requests.
self.addEventListener("fetch", (event) => {

    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    // Never cache Firebase / Firestore / MealDB / Unsplash
    if (
        url.hostname.includes("firebase") ||
        url.hostname.includes("gstatic") ||
        url.hostname.includes("googleapis") ||
        url.hostname.includes("themealdb") ||
        url.hostname.includes("unsplash") ||
        url.hostname.includes("boxicons")
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request, { cache: "no-cache" })
            .then((response) => {

                // Cache a fresh copy of successful responses
                if (response && response.status === 200) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, copy).catch(() => {});
                    });
                }

                return response;

            })
            .catch(() =>
                caches.match(event.request).then((cached) =>
                    cached || Response.error()
                )
            )
    );

});


// ---------- SKIP WAITING ----------
// When the app tells us to activate immediately (update available),
// skip the wait state and take over right away.
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
