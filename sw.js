// Service worker: guarda os arquivos do app para abrir sem internet.
// Ao mudar qualquer arquivo, aumente a versão abaixo.
const CACHE = 'cuidados-v12';
const FILES = ['./', './index.html', './config.js', './manifest.webmanifest', './css/app.css', './js/core/utils.js', './js/ui/icons.js', './js/ui/dialog.js', './js/ui/haptic.js', './js/ui/sheet.js', './js/ui/lock.js', './js/core/files.js', './js/core/install.js', './js/rules/dose-safety.js', './js/core/store.js', './js/core/cloud.js', './js/features/mala.js', './js/features/farmacinha.js', './js/features/agenda.js', './js/features/pendencias.js', './js/features/membros.js', './js/features/familia.js', './js/features/avisos.js', './js/features/inicio.js', './js/features/resumo.js', './js/app.js', './icone-180.png', './icone-192.png', './icone-512.png', './icone-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Bibliotecas do Firebase (versão fixa): cache primeiro, para abrir offline
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return; // Firestore e demais: direto na rede
  if (url.pathname.endsWith('.png')) return;      // ícones sempre direto do servidor
  // app: rede primeiro (pega atualizações), cache se estiver offline
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
