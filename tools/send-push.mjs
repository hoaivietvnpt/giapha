// Gửi thông báo đẩy (Firebase Cloud Messaging) cho gia phả – chạy bằng GitHub Actions.
//   node tools/send-push.mjs notices   → gửi các thông báo quản trị đang chờ
//   node tools/send-push.mjs gio       → nhắc ngày giỗ hằng ngày (8:00 giờ Việt Nam)
// Cần biến môi trường FIREBASE_SERVICE_ACCOUNT = nội dung file khoá tài khoản dịch vụ (JSON).
import crypto from 'node:crypto';
import { gioInLunarYear, todayLunar } from '../js/lunar.js';

const mode = process.argv[2] || 'notices';
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.log('Chưa cấu hình secret FIREBASE_SERVICE_ACCOUNT – bỏ qua.'); process.exit(0); }
const sa = JSON.parse(raw);
const PROJECT = sa.project_id;
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const b64u = (s) => Buffer.from(s).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` })
  });
  const j = await r.json(); if (!j.access_token) throw new Error('Không lấy được access token: ' + JSON.stringify(j));
  return j.access_token;
}
const TOKEN = await accessToken();
const api = async (url, opt = {}) => {
  const r = await fetch(url, { ...opt, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  const text = await r.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch { j = { text }; }
  return { ok: r.ok, status: r.status, j };
};

// Chuyển giá trị Firestore REST -> JS
const val = (v) => {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return +v.integerValue; if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue; if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  return undefined;
};
const docObj = (d) => ({ _name: d.name, id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) });

async function listAll(col) {
  const out = []; let pageToken = '';
  do {
    const { ok, j } = await api(`${FS}/${col}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`);
    if (!ok) throw new Error(`Đọc ${col} lỗi: ` + JSON.stringify(j));
    (j.documents || []).forEach(d => out.push(docObj(d)));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function send(token, data) {
  const { ok, status, j } = await api(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
    method: 'POST',
    body: JSON.stringify({ message: { token, data, webpush: { headers: { Urgency: 'high', TTL: '86400' } } } })
  });
  if (ok) return 'ok';
  const code = j?.error?.details?.find?.(x => x.errorCode)?.errorCode || j?.error?.status;
  if (status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') return 'dead';
  console.warn('FCM lỗi', status, code); return 'err';
}

async function sendMany(tokens, makeData) {
  let okN = 0; const dead = [];
  for (let i = 0; i < tokens.length; i += 20) {
    const part = tokens.slice(i, i + 20);
    const rs = await Promise.all(part.map(t => { const d = makeData(t); return d ? send(t.token, d) : 'skip'; }));
    rs.forEach((r, k) => { if (r === 'ok') okN++; if (r === 'dead') dead.push(part[k]); });
  }
  for (const t of dead) await api(`https://firestore.googleapis.com/v1/${t._name}`, { method: 'DELETE' });
  if (dead.length) console.log(`Đã xoá ${dead.length} mã không còn dùng`);
  return okN;
}

async function markClanReady() {
  await api(`${FS}/meta/clan?updateMask.fieldPaths=pushReady`, { method: 'PATCH', body: JSON.stringify({ fields: { pushReady: { booleanValue: true } } }) });
}

async function runNotices() {
  const { ok, j } = await api(`${FS}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'notices' }], where: { fieldFilter: { field: { fieldPath: 'sent' }, op: 'EQUAL', value: { booleanValue: false } } }, limit: 10 } })
  });
  if (!ok) throw new Error('Đọc thông báo lỗi: ' + JSON.stringify(j));
  const pending = (Array.isArray(j) ? j : []).filter(x => x.document).map(x => docObj(x.document));
  await markClanReady();
  if (!pending.length) { console.log('Không có thông báo chờ gửi.'); return; }
  const tokens = await listAll('pushTokens');
  console.log(`${pending.length} thông báo, ${tokens.length} máy.`);
  for (const n of pending) {
    const count = await sendMany(tokens, () => ({ title: n.title || 'Gia phả dòng họ', body: n.body || '', hash: n.hash || '#/', tag: 'notice-' + n.id }));
    await api(`https://firestore.googleapis.com/v1/${n._name}?updateMask.fieldPaths=sent&updateMask.fieldPaths=sentAt&updateMask.fieldPaths=sentCount`, {
      method: 'PATCH', body: JSON.stringify({ fields: { sent: { booleanValue: true }, sentAt: { integerValue: String(Date.now()) }, sentCount: { integerValue: String(count) } } })
    });
    console.log(`Đã gửi “${n.title}” tới ${count} máy.`);
  }
}

async function runGio() {
  // Chạy với TZ=Asia/Ho_Chi_Minh
  const [persons, tokens, clanDoc] = await Promise.all([listAll('persons'), listAll('pushTokens'), api(`${FS}/meta/clan`)]);
  await markClanReady();
  const clan = clanDoc.ok ? docObj(clanDoc.j).name || '' : '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ly = todayLunar().y;
  const upcoming = [];
  for (const p of persons) {
    if (p.alive !== false || !p.deathLunar?.d || !p.deathLunar?.m) continue;
    for (const y of [ly, ly + 1]) {
      const d = gioInLunarYear(p.deathLunar.d, p.deathLunar.m, y); if (!d) continue;
      const days = Math.round((d - today) / 86400000);
      if (days >= 0 && days <= 30) upcoming.push({ p, d, days });
    }
  }
  if (!upcoming.length || !tokens.length) { console.log('Hôm nay không có lời nhắc giỗ.'); return; }
  let total = 0;
  for (const u of upcoming) {
    const lunar = `${u.p.deathLunar.d}/${u.p.deathLunar.m} âm lịch`;
    const dateTxt = `${u.d.getDate()}/${u.d.getMonth() + 1}/${u.d.getFullYear()}`;
    const n = await sendMany(tokens, (t) => {
      const pr = t.prefs || { days: [3], dayOf: true };
      const want = u.days === 0 ? pr.dayOf !== false : (pr.days || []).map(Number).includes(u.days);
      if (!want) return null;
      return {
        title: u.days === 0 ? `Hôm nay giỗ ${u.p.name}` : `Còn ${u.days} ngày đến giỗ ${u.p.name}`,
        body: `Ngày ${dateTxt} (${lunar})${clan ? ' · Gia phả ' + clan : ''}`,
        hash: `#/gio?p=${encodeURIComponent(u.p.id)}`, tag: `gio-${u.p.id}-${u.days}`
      };
    });
    total += n;
  }
  console.log(`Đã gửi ${total} lời nhắc giỗ.`);
}

if (mode === 'gio') await runGio(); else await runNotices();
