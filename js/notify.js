// Cài ứng dụng lên điện thoại (PWA) + nhắc ngày giỗ trước 3 ngày
import { gioInLunarYear, todayLunar } from './lunar.js';
import { $, toast } from './ui.js';

const LS = 'gp-remind';
let installEvt = null;
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const supported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const remindersOn = () => supported() && Notification.permission === 'granted' && ls.get(LS) !== 'off';

// ---------- Service worker ----------
export function initPWA() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; refreshCard(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('Đã cài ứng dụng Gia phả'); refreshCard(); });
  navigator.serviceWorker.addEventListener?.('message', (e) => { if (e.data?.type === 'open') location.hash = e.data.hash; });
}

/** Tính trước ngày giỗ (dương lịch) cho 2 năm tới, lưu cho service worker dùng khi chạy nền */
export async function syncReminders(persons, clanName) {
  if (!('caches' in window)) return;
  const ly = todayLunar().y;
  const items = [];
  for (const p of persons.values()) {
    if (p.alive !== false || !p.deathLunar?.d || !p.deathLunar?.m) continue;
    const dates = [];
    for (let y = ly; y <= ly + 2; y++) {
      const d = gioInLunarYear(p.deathLunar.d, p.deathLunar.m, y);
      if (d) dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    items.push({ id: p.id, name: p.name, lunar: `${p.deathLunar.d}/${p.deathLunar.m} âm lịch`, dates });
  }
  try {
    const c = await caches.open('gp-data');
    await c.put('gio.json', new Response(JSON.stringify({ clan: clanName || '', items, updated: Date.now() }), { headers: { 'Content-Type': 'application/json' } }));
    if (remindersOn()) (await navigator.serviceWorker.ready).active?.postMessage({ type: 'check' });
  } catch (e) { console.warn(e); }
}

async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('gio-check', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}

export async function enableReminders() {
  if (!supported()) return toast('Trình duyệt này không hỗ trợ thông báo');
  if (isIOS() && !isStandalone()) return toast('Trên iPhone: hãy “Thêm vào MH chính” rồi mở ứng dụng từ biểu tượng để bật thông báo');
  const p = await Notification.requestPermission();
  if (p !== 'granted') { toast('Bạn chưa cho phép thông báo'); refreshCard(); return; }
  ls.set(LS, 'on');
  await registerPeriodic();
  (await navigator.serviceWorker.ready).active?.postMessage({ type: 'check', force: true });
  toast('Đã bật nhắc ngày giỗ (trước 3 ngày)');
  refreshCard();
}

function disableReminders() { ls.set(LS, 'off'); toast('Đã tắt nhắc ngày giỗ'); refreshCard(); }

// ---------- Giao diện (thẻ trên trang Ngày giỗ) ----------
export function reminderCard() { return '<section class="card app-card" id="appCard"></section>'; }

export function refreshCard() {
  const el = $('#appCard'); if (!el) return;
  const installed = isStandalone();
  let install = '';
  if (!installed) {
    if (installEvt) install = '<button class="btn" id="installBtn">Cài ứng dụng lên điện thoại</button>';
    else if (isIOS()) install = '<p class="note">Trên iPhone/iPad: mở bằng Safari → nút <b>Chia sẻ</b> → <b>Thêm vào MH chính</b>.</p>';
    else install = '<p class="note">Mở menu trình duyệt (⋮) → <b>Cài đặt ứng dụng</b> / <b>Thêm vào màn hình chính</b>.</p>';
  }
  const perm = supported() ? Notification.permission : 'unsupported';
  const on = remindersOn();
  el.innerHTML = `
    <div class="app-card-h">
      <img src="icons/icon-192.png" alt="" width="48" height="48">
      <div><h2>Ứng dụng & nhắc giỗ</h2>
      <p class="muted">${installed ? 'Ứng dụng đã được cài trên máy này.' : 'Cài gia phả lên màn hình chính để mở nhanh như một ứng dụng.'}
      Khi bật nhắc, máy sẽ báo <b>trước 3 ngày</b> và <b>đúng ngày giỗ</b>.</p></div>
    </div>
    <div class="actions left">
      ${install}
      ${perm === 'unsupported' ? '<p class="muted tiny">Trình duyệt này không hỗ trợ thông báo – hãy dùng file lịch (.ics) ở trên.</p>'
        : perm === 'denied' ? '<p class="note err">Thông báo đang bị chặn. Hãy mở cài đặt trang web trong trình duyệt để cho phép lại.</p>'
          : on ? `<span class="badge alive">Đang bật nhắc giỗ</span><button class="btn small ghost" id="remOff">Tắt</button><button class="btn small" id="remTest">Thử thông báo</button>`
            : '<button class="btn primary" id="remOn">Bật nhắc ngày giỗ</button>'}
    </div>
    <p class="muted tiny">Lưu ý: trên Android (Chrome) ứng dụng đã cài có thể tự kiểm tra ngày giỗ khi chạy nền; trên iPhone, nhắc được kiểm tra mỗi khi mở ứng dụng. Để chắc chắn không quên, hãy thêm file lịch (.ics) – lịch điện thoại sẽ nhắc trước 3 ngày.</p>`;
  $('#installBtn', el)?.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; refreshCard(); });
  $('#remOn', el)?.addEventListener('click', enableReminders);
  $('#remOff', el)?.addEventListener('click', disableReminders);
  $('#remTest', el)?.addEventListener('click', async () => {
    (await navigator.serviceWorker.ready).showNotification('Gia phả – thử thông báo', { body: 'Thông báo nhắc ngày giỗ đang hoạt động.', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'gp-test' });
  });
}

