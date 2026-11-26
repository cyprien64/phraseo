// Mode hors ligne : le site s'installe comme une application et reste utilisable sans réseau.
// Fichiers du site, METAR, TAF et trafic : réseau d'abord (toujours à jour), copie gardée pour le hors ligne.
// Bibliothèques de la voix réaliste (CDN, versions figées) : copie d'abord. Les modèles de voix sont gardés par
// tts-worker.js (cache « phraseo-voix-v2 ») et ne passent pas par ici.
const CACHE = 'phraseo-site-dev'; // version remplacée à chaque déploiement (.github/workflows/pages.yml)
const CORE = ['./', 'index.html', 'style.css', 'match.js', 'realism.js', 'data.js', 'data-plus.js', 'data-lot2.js', 'data-lot3.js',
  'courses.js', 'learn.js', 'app.js', 'extras.js', 'tts-worker.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('phraseo-site-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (CDN.test(r.url)) { // versions figées : la copie suffit
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)); return res; })));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
