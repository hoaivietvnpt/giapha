// Cài ứng dụng lên điện thoại (PWA) + nhắc ngày giỗ (trước 3/7/30 ngày, 8:00 đúng ngày)
import { gioInLunarYear, todayLunar } from './lunar.js';
import { $, toast } from './ui.js';
import { store } from './store.js';

const LS = 'gp-remind';
const LS_PREFS = 'gp-remind-prefs';
const LS_TOKEN = 'gp-push-token';
// Khoá công khai Web Push (Firebase Console → Cloud Messaging → Web Push certificates)
export const VAPID_KEY = 'BIEtuavXcOcOJd7omAUaGk0rtcTVvtUZmC_pr7U8KWHEoqkjS--4h-SSEQ4XXWUt_2GexDVN_vP-AQerrJuepeo';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const DAY_OPTIONS = [30, 7, 3];
let installEvt = null;
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const supported = () => 'Notification' in window && 'serviceWorker' in navigator;
/** Tuỳ chọn nhắc: số ngày trước (3/7/30) và 8:00 đúng ngày giỗ */
export function getPrefs() {
  try {
    const p = JSON.parse(ls.get(LS_PREFS) || 'null');
    if (p && Array.isArray(p.days)) return { days: p.days.filter(d => DAY_OPTIONS.includes(d)), dayOf: p.dayOf !== false };
  } catch { /* bỏ qua */ }
  return { days: [3], dayOf: true };
}
async function savePrefs(prefs) {
  ls.set(LS_PREFS, JSON.stringify(prefs));
  const tok = ls.get(LS_TOKEN); if (tok) store.savePushToken(tok, prefs);
  try {
    const c = await caches.open('gp-data');
    await c.put('settings.json', new Response(JSON.stringify(prefs), { headers: { 'Content-Type': 'application/json' } }));
    if (remindersOn()) (await navigator.serviceWorker.ready).active?.postMessage({ type: 'check' });
  } catch { /* bỏ qua */ }
}
const prefsText = (p) => [...p.days].sort((a, b) => b - a).map(d => `trước ${d} ngày`).concat(p.dayOf ? ['8:00 đúng ngày giỗ'] : []).join(', ') || 'chưa chọn mốc nhắc';

export const remindersOn = () => supported() && Notification.permission === 'granted' && ls.get(LS) !== 'off';

// ---------- Service worker ----------
export function initPWA() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; refreshCard(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('Đã cài ứng dụng Gia phả'); refreshCard(); });
  navigator.serviceWorker.addEventListener?.('message', (e) => { if (e.data?.type === 'open') location.hash = e.data.hash; });
  // làm mới mã nhận thông báo mỗi lần mở app
  if (remindersOn()) store.on((w) => { if (w === 'all' && !initPWA.done) { initPWA.done = true; enablePush(true); } });
}

/** Lời mời bật thông báo trên trang chủ (khi chưa bật) */
export function pushCTA() {
  if (!supported() || remindersOn() || Notification.permission === 'denied' || ls.get('gp-cta-x') === '1') return '';
  return `<section class="push-cta" id="pushCta">
    <img src="icons/icon-192.png" alt="" width="44" height="44">
    <div><b>Nhận thông báo từ dòng họ</b><p class="muted">Tin họp họ, giỗ tổ và nhắc ngày giỗ ngay trên điện thoại.${isIOS() && !isStandalone() ? ' Trên iPhone: cài ứng dụng trước (Chia sẻ → Thêm vào MH chính).' : ''}</p></div>
    <div class="actions"><button class="btn primary small" id="ctaOn">Bật thông báo</button><button class="btn ghost small" id="ctaX">Để sau</button></div>
  </section>`;
}
export function bindPushCTA() {
  $('#ctaOn')?.addEventListener('click', async () => { await enableReminders(); if (remindersOn()) $('#pushCta')?.remove(); });
  $('#ctaX')?.addEventListener('click', () => { ls.set('gp-cta-x', '1'); $('#pushCta')?.remove(); });
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
    // Khi máy chủ đã gửi nhắc giỗ (push) thì máy không tự nhắc nữa để khỏi trùng
    const serverPush = !!(store.clan?.pushReady && ls.get(LS_TOKEN));
    await c.put('settings.json', new Response(JSON.stringify({ ...getPrefs(), serverPush }), { headers: { 'Content-Type': 'application/json' } }));
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

/** Đăng ký nhận push (Firebase Cloud Messaging) – dùng cho thông báo của quản trị và nhắc giỗ từ máy chủ */
export async function enablePush(silent) {
  if (store.mode !== 'firebase' || !VAPID_KEY || !supported() || Notification.permission !== 'granted') return false;
  try {
    const m = await import(FB + 'firebase-messaging.js');
    if (!(await m.isSupported())) return false;
    const reg = await navigator.serviceWorker.ready;
    const token = await m.getToken(m.getMessaging(store.app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return false;
    if (token !== ls.get(LS_TOKEN) || !silent) await store.savePushToken(token, getPrefs());
    ls.set(LS_TOKEN, token);
    return true;
  } catch (e) { console.warn('push', e); return false; }
}

export async function enableReminders() {
  if (!supported()) return toast('Trình duyệt này không hỗ trợ thông báo');
  if (isIOS() && !isStandalone()) return toast('Trên iPhone: hãy “Thêm vào MH chính” rồi mở ứng dụng từ biểu tượng để bật thông báo');
  const p = await Notification.requestPermission();
  if (p !== 'granted') { toast('Bạn chưa cho phép thông báo'); refreshCard(); return; }
  ls.set(LS, 'on');
  await registerPeriodic();
  await enablePush();
  (await navigator.serviceWorker.ready).active?.postMessage({ type: 'check', force: true });
  toast(`Đã bật nhắc ngày giỗ (${prefsText(getPrefs())})`);
  refreshCard();
}

function disableReminders() { ls.set(LS, 'off'); toast('Đã tắt nhắc ngày giỗ'); refreshCard(); }

// ---------- File lịch (.ics) cho iPhone / Android / Google Calendar ----------
const icsEsc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  // dòng iCalendar tối đa 75 byte
  const enc = new TextEncoder(); const out = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 73) {
      let carry = '';
      if (cur.endsWith('\\')) { carry = '\\'; cur = cur.slice(0, -1); } // không cắt giữa ký tự thoát
      out.push(cur); cur = ' ' + carry; bytes = 1 + carry.length;
    }
    cur += ch; bytes += b;
  }
  out.push(cur); return out.join('\r\n');
}
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Báo trước N ngày lúc 8:00 (sự kiện cả ngày bắt đầu 0:00) */
const before8 = (n) => (n === 1 ? '-PT16H' : `-P${n - 1}DT16H`);
const alarm = (trigger, text) => ['BEGIN:VALARM', `TRIGGER:${trigger}`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(text)}`, 'END:VALARM'];

export function buildICS(persons, clanName, prefs = getPrefs(), years = 10) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GiaPha//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(`Ngày giỗ${clanName ? ' ' + clanName : ''}`)}`, 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh'];
  const days = [...prefs.days].sort((a, b) => a - b);
  // iPhone chỉ giữ tối đa 2 lời nhắc cho mỗi sự kiện → mốc còn lại tạo thành sự kiện nhắc riêng
  const onMain = [], separate = [];
  const slots = prefs.dayOf ? 1 : 2;
  days.forEach((d, i) => (i < slots ? onMain : separate).push(d));
  const ly0 = todayLunar().y;
  let n = 0;
  for (const p of persons) {
    if (p.alive !== false || !p.deathLunar?.d || !p.deathLunar?.m) continue;
    n++;
    const lunar = `ngày ${p.deathLunar.d} tháng ${p.deathLunar.m} âm lịch`;
    const desc = `Giỗ ${p.name} – ${lunar}${p.gravePlace ? `\nPhần mộ: ${p.gravePlace}` : ''}${clanName ? `\nGia phả ${clanName}` : ''}`;
    for (let ly = ly0; ly < ly0 + years; ly++) {
      const d = gioInLunarYear(p.deathLunar.d, p.deathLunar.m, ly); if (!d || d < addDays(new Date(), -1)) continue;
      const ev = ['BEGIN:VEVENT', `UID:${p.id}-${ly}@giapha`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(addDays(d, 1))}`,
        `SUMMARY:${icsEsc(`Giỗ ${p.name}`)}`, `DESCRIPTION:${icsEsc(desc)}`, 'TRANSP:TRANSPARENT'];
      if (p.gravePlace) ev.push(`LOCATION:${icsEsc(p.gravePlace)}`);
      if (prefs.dayOf) ev.push(...alarm('PT8H', `Hôm nay giỗ ${p.name} (${lunar})`));
      for (const k of onMain) ev.push(...alarm(before8(k), `Còn ${k} ngày đến giỗ ${p.name}`));
      ev.push('END:VEVENT'); L.push(...ev);
      for (const k of separate) {
        const r = addDays(d, -k);
        L.push('BEGIN:VEVENT', `UID:${p.id}-${ly}-nhac${k}@giapha`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(r)}`, `DTEND;VALUE=DATE:${ymd(addDays(r, 1))}`,
          `SUMMARY:${icsEsc(`Còn ${k} ngày đến giỗ ${p.name}`)}`, `DESCRIPTION:${icsEsc(desc)}`, 'TRANSP:TRANSPARENT',
          ...alarm('PT8H', `Còn ${k} ngày đến giỗ ${p.name}`), 'END:VEVENT');
      }
    }
  }
  L.push('END:VCALENDAR');
  return { text: L.map(fold).join('\r\n') + '\r\n', count: n };
}

export function downloadICS(persons, clanName, filename = 'ngay-gio.ics') {
  const prefs = getPrefs();
  const { text, count } = buildICS([...persons], clanName, prefs);
  if (!count) return toast('Chưa có ngày giỗ âm lịch nào để thêm vào lịch');
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`Đã tạo lịch giỗ ${count} người cho 10 năm tới (nhắc ${prefsText(prefs)}). ${isIOS() ? 'Bấm “Thêm tất cả” để lưu vào Lịch.' : 'Mở file để thêm vào lịch.'}`, 6000);
}

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
  const prefs = getPrefs();
  el.innerHTML = `
    <div class="app-card-h">
      <img src="icons/icon-192.png" alt="" width="48" height="48">
      <div><h2>Ứng dụng & nhắc giỗ</h2>
      <p class="muted">${installed ? 'Ứng dụng đã được cài trên máy này.' : 'Cài gia phả lên màn hình chính để mở nhanh như một ứng dụng.'}
      Đang chọn nhắc: <b>${prefsText(prefs)}</b>.</p></div>
    </div>
    <div class="actions left">
      ${install}
      ${perm === 'unsupported' ? '<p class="muted tiny">Trình duyệt này không hỗ trợ thông báo – hãy dùng file lịch (.ics) ở trên.</p>'
        : perm === 'denied' ? '<p class="note err">Thông báo đang bị chặn. Hãy mở cài đặt trang web trong trình duyệt để cho phép lại.</p>'
          : on ? `<span class="badge alive">Đang bật nhắc giỗ</span><button class="btn small ghost" id="remOff">Tắt</button><button class="btn small" id="remTest">Thử thông báo</button>`
            : '<button class="btn primary" id="remOn">Bật thông báo & nhắc giỗ</button>'}
    </div>
    <fieldset class="rem-prefs"><legend>Nhắc lúc 8:00 sáng</legend>
      <div class="chips-row">
        ${DAY_OPTIONS.map(d => `<label class="pick"><input type="checkbox" data-day="${d}" ${prefs.days.includes(d) ? 'checked' : ''}><span>Trước ${d} ngày</span></label>`).join('')}
        <label class="pick"><input type="checkbox" id="dayOf" ${prefs.dayOf ? 'checked' : ''}><span>Đúng ngày giỗ</span></label>
      </div>
    </fieldset>
    <details class="ios-guide" ${isIOS() ? 'open' : ''}><summary>Thêm nhắc giỗ vào Lịch trên iPhone</summary>
      <ol>
        <li>Mở trang này bằng <b>Safari</b> (nếu đang xem trong Zalo/Facebook, bấm ⋯ → <i>Mở bằng trình duyệt</i>).</li>
        <li>Chọn thời điểm nhắc ở trên, rồi bấm <button type="button" class="btn small primary" id="icsBtn2">Thêm vào lịch điện thoại (.ics)</button></li>
        <li>Safari hiện danh sách các ngày giỗ → bấm <b>Thêm tất cả</b> → chọn lịch muốn lưu (nên tạo riêng lịch “Ngày giỗ” trong ứng dụng Lịch để dễ quản lý).</li>
        <li>Kiểm tra <b>Cài đặt → Thông báo → Lịch</b> đang bật để iPhone báo đúng giờ.</li>
        <li>Khi gia phả có thêm người hoặc muốn đổi mốc nhắc: xoá lịch “Ngày giỗ” cũ trong ứng dụng Lịch rồi thêm lại file mới để không bị trùng.</li>
      </ol>
      <p class="muted">Lịch của iPhone tự nhắc cả khi không mở web, kể cả khi không có mạng, và được tính sẵn cho 10 năm tới. Thông báo của ứng dụng thì Android kiểm tra cả khi chạy nền, iPhone chỉ kiểm tra mỗi khi mở ứng dụng.</p>
    </details>`;
  $('#installBtn', el)?.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; refreshCard(); });
  $('#remOn', el)?.addEventListener('click', enableReminders);
  $('#icsBtn2', el)?.addEventListener('click', () => downloadICS(store.persons.values(), store.clan.name));
  el.querySelectorAll('.rem-prefs input').forEach(i => i.onchange = async () => {
    const p = { days: [...el.querySelectorAll('[data-day]:checked')].map(x => +x.dataset.day), dayOf: $('#dayOf', el).checked };
    await savePrefs(p); toast(`Sẽ nhắc ${prefsText(p)}`); refreshCard();
  });
  $('#remOff', el)?.addEventListener('click', disableReminders);
  $('#remTest', el)?.addEventListener('click', async () => {
    (await navigator.serviceWorker.ready).showNotification('Gia phả – thử thông báo', { body: 'Thông báo nhắc ngày giỗ đang hoạt động.', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'gp-test' });
  });
}

