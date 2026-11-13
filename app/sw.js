// Service worker: chạy offline sau lần mở đầu. Ưu tiên mạng (biểu phí mới nhất), mất mạng thì dùng bản đã lưu.
const CACHE = 'laithat-v13';
const FILES = [
  './', 'index.html', 'styles.css', 'ui.js', 'engine.js', 'presets.js', 'calc.js', 'store.js', 'icons.js', 'examples.js', 'sales.js', 'splash.js', 'pro.js', 'ads.js', 'billing.js', 'native.js', 'addons.js', 'xlsx.js', 'ui-addons.js', 'privacy.html', 'assets/logo-wordmark-white.svg',
  'assets/fee_presets.json', 'assets/app_config.json', 'manifest.webmanifest', 'icon.svg', 'fonts/fonts.css',
  'assets/logo-horizontal.svg', 'assets/logo-horizontal-white.svg', 'assets/logo-symbol.svg',
  'icons/favicon.ico', 'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  ...[400, 600, 700, 800].flatMap((w) => ['vietnamese', 'latin', 'latin-ext'].map((s) => `fonts/bevietnampro-${w}-${s}.woff2`)),
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
