// Service worker: chạy ngoại tuyến + nhắc ngày giỗ
const VERSION = 'gp-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/family.js', 'js/lunar.js', 'js/tree.js', 'js/person.js',
  'js/sheet-import.js', 'js/notify.js', 'js/firebase-config.js', 'js/sample-data.js'];
const REMIND_DAYS = 3;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gp-v') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Ưu tiên mạng (luôn có bản mới), mất mạng thì dùng bản đã lưu
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function checkGio(force) {
  const data = await caches.open('gp-data');
  const res = await data.match('gio.json'); if (!res) return;
  const { clan, items } = await res.json();
  const sentRes = await data.match('sent.json');
  const sent = sentRes ? await sentRes.json() : {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t0 = ymd(today);
  let changed = false;
  for (const it of items) {
    for (const ds of it.dates) {
      const [y, m, d] = ds.split('-').map(Number);
      const days = Math.round((new Date(y, m - 1, d) - today) / 86400000);
      if (days < 0 || days > REMIND_DAYS) continue;
      const kind = days === 0 ? 'day' : 'before';
      const key = `${it.id}|${ds}|${kind}`;
      if (sent[key] && !force) continue;
      const title = days === 0 ? `Hôm nay giỗ ${it.name}` : `Còn ${days} ngày đến giỗ ${it.name}`;
      const body = `Ngày ${d}/${m}/${y} (${it.lunar})${clan ? ' · Gia phả ' + clan : ''}`;
      await self.registration.showNotification(title, {
        body, tag: key, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
        data: { hash: `#/gio?p=${encodeURIComponent(it.id)}` }
      });
      sent[key] = t0; changed = true;
    }
  }
  if (changed) {
    // dọn bản ghi cũ hơn 60 ngày
    for (const [k, v] of Object.entries(sent)) if ((today - new Date(v)) / 86400000 > 60) delete sent[k];
    await data.put('sent.json', new Response(JSON.stringify(sent)));
  }
}

self.addEventListener('message', (e) => { if (e.data?.type === 'check') e.waitUntil(checkGio(e.data.force)); });
self.addEventListener('periodicsync', (e) => { if (e.tag === 'gio-check') e.waitUntil(checkGio()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = e.notification.data?.hash || '#/gio';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { c.postMessage({ type: 'open', hash }); return c.focus(); }
    return self.clients.openWindow('./' + hash);
  }));
});
