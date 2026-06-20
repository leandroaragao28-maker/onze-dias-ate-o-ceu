/* Service Worker â€” cache do app + detecÃ§Ã£o de atualizaÃ§Ã£o.
 * IMPORTANTE: a cada deploy de mudanÃ§a no front, suba o VERSION abaixo.
 * Trocar o VERSION muda este arquivo â†’ o navegador detecta a nova versÃ£o
 * e o js/pwa.js mostra o banner "Nova versÃ£o disponÃ­vel".
 */
const VERSION = 'v10';
const CACHE = 'onze-dias-' + VERSION;

// Caminhos relativos ao escopo (/onze-dias-ate-o-ceu/).
const ASSETS = [
  './', 'index.html', 'ficha.html',
  'css/style.css',
  'js/config.js', 'js/db.js', 'js/identidade.js', 'js/brasoes.js', 'js/app.js', 'js/ficha.js', 'js/pwa.js',
  'img/couro.jpg', 'img/pergaminho.jpg',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  // NÃ£o chama skipWaiting: o SW novo fica "esperando" atÃ© o jogador tocar em Atualizar.
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
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // SÃ³ cuida do prÃ³prio site. A API (script.google.com) e qualquer POST passam direto.
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copia = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copia));
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
