// Service worker: chạy offline sau lần mở đầu. Ưu tiên mạng (luôn có bản mới), mất mạng thì dùng bản đã lưu.
const CACHE = 'hdt-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'ui.js', 'logic.js', 'store.js', 'vietqr.js', 'qr.js', 'banks.js', 'content.js',
  'icons.js', 'invoice-canvas.js', 'tariff-default.json', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg', 'fonts/fonts.css',
  ...[400, 600, 700, 800].flatMap((w) => ['vietnamese', 'latin', 'latin-ext'].map((s) => `fonts/bevietnampro-${w}-${s}.woff2`)),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
