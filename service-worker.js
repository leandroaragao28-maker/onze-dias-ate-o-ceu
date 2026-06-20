/* Service Worker — cache do app + detecção de atualização.
 * IMPORTANTE: a cada deploy de mudança no front, suba o VERSION abaixo.
 * Trocar o VERSION muda este arquivo → o navegador detecta a nova versão
 * e o js/pwa.js mostra o banner "Nova versão disponível".
 */
const VERSION = 'v17';
const CACHE = 'onze-dias-' + VERSION;

// Caminhos relativos ao escopo (raiz do site).
const ASSETS = [
  './', 'index.html', 'ficha.html',
  'css/style.css',
  'js/config.js', 'js/db.js', 'js/identidade.js', 'js/brasoes.js', 'js/app.js', 'js/ficha.js', 'js/pwa.js',
  'img/couro.jpg', 'img/pergaminho.jpg',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  // Não chama skipWaiting: o SW novo fica "esperando" até o jogador tocar em Atualizar.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Só cuida do próprio site. API/Firestore e qualquer POST passam direto.
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copia = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copia));
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
