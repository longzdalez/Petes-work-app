const CACHE = 'pete-work-v11';
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

// Daily background check for urgent reminders (Android Chrome, installed app)
function readDue() {
  return new Promise(res => {
    const q = indexedDB.open('pete-reminders', 1)
    q.onupgradeneeded = () => q.result.createObjectStore('kv')
    q.onsuccess = () => {
      const tx = q.result.transaction('kv', 'readwrite'), st = tx.objectStore('kv')
      const g = st.get('due'), s2 = st.get('sent')
      tx.oncomplete = () => res({ due: g.result || [], sent: s2.result || {}, db: q.result })
    }
    q.onerror = () => res({ due: [], sent: {} })
  })
}
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'reminders') return
  e.waitUntil((async () => {
    const { due, sent, db } = await readDue()
    const today = new Date().toISOString().slice(0, 10)
    for (const it of due) {
      if (sent[it.id + today]) continue
      await self.registration.showNotification(it.title, { body: it.body, tag: it.id, icon: 'icons/icon-192.png', data: { url: it.url } })
      sent[it.id + today] = 1
    }
    if (db) db.transaction('kv', 'readwrite').objectStore('kv').put(sent, 'sent')
  })())
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate(url); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
