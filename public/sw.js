// v2: cache-first edi — shu sabab kod deploy qilingandan keyin ham foydalanuvchilar
// ba'zan ESKI (buzilgan) versiyani ko'rar edi, chunki cache HAR DOIM networkdan oldin
// qaytardi. Endi NETWORK-FIRST: internet bor bo'lsa har doim eng yangi versiya, faqat
// oflayn holatda cache'ga tushadi. Versiya raqami oshganda eski cache avtomatik o'chadi.
const CACHE_NAME = "toshkentgpt-v2";
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/logo-header.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never cache API calls — chat must always hit the network.
  if (request.url.includes("/api/")) return;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
