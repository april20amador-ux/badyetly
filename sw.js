const CACHE_NAME = "badyetly-pwa-v16";
const APP_SHELL = [
    "./", "./index.html", "./style.css", "./script.js", "./manifest.json",
    "./icon.svg", "./pwa-192x192.png", "./pwa-512x512.png",
    "./pwa-maskable-512x512.png", "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => Promise.allSettled(APP_SHELL.map(u => c.add(u))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys()
            .then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", e => {
    const req = e.request;
    if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

    if (req.mode === "navigate") {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        e.respondWith(
            fetch(req, { signal: ctrl.signal })
                .then(res => {
                    clearTimeout(timer);
                    if (res && res.ok) caches.open(CACHE_NAME).then(c => c.put("./index.html", res.clone()));
                    return res;
                })
                .catch(() => caches.match("./index.html", { ignoreSearch: true }))
        );
        return;
    }

    e.respondWith(
        caches.match(req, { ignoreSearch: true }).then(cached => {
            const net = fetch(req).then(res => {
                if (res && res.ok) caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
                return res;
            }).catch(() => cached);
            return cached || net;
        })
    );
});