const CACHE = 'pete-work-v1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function idbPut(files) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pete-shared', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shared', { autoIncrement: true });
    req.onsuccess = () => {
      const tx = req.result.transaction('shared', 'readwrite');
      const st = tx.objectStore('shared');
      files.forEach(f => st.add({ name: f.name, type: f.type, blob: f }));
      tx.oncomplete = resolve; tx.onerror = reject;
    };
    req.onerror = reject;
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const files = form.getAll('files').filter(f => f && f.size);
      await idbPut(files);
      return Response.redirect('./#/share', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first for the page and config so updates arrive; cache first for hashed assets.
  const isShell = e.request.mode === 'navigate' || url.pathname.endsWith('config.js');
  if (isShell) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return r;
    })));
  }
});
