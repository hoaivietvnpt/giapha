// Nhập / xuất gia phả qua Google Sheet, file CSV hoặc Excel
import { store } from './store.js';
import { $, $$, esc, ctx, toast, openModal, closeModal, download, icon } from './ui.js';
import { parseDate, norm } from './family.js';
import { solarToLunar } from './lunar.js';

// Google Sheet mẫu (mở link /copy để tạo bản sao vào Drive của mình)
export const TEMPLATE_SHEET_ID = '1y6rTIRon0wkKMxYWBlnXtFudMNTMvAJVYnGS-nQL13w';
export const TEMPLATE_CSV = 'mau/gia-pha-mau.csv';
const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

// [khoá, tiêu đề cột, các tên gọi khác]
export const COLS = [
  ['code', 'Mã', ['ma', 'id', 'stt', 'maso']],
  ['name', 'Họ và tên', ['hoten', 'ten', 'hovaten']],
  ['otherName', 'Tên khác', ['tenkhac', 'tenhuy', 'tenthuonggoi']],
  ['gender', 'Giới tính', ['gioitinh', 'phai']],
  ['father', 'Mã cha', ['macha', 'cha', 'bo']],
  ['mother', 'Mã mẹ', ['mame', 'me']],
  ['spouses', 'Mã vợ/chồng', ['mavochong', 'vochong', 'mavo', 'machong']],
  ['order', 'Con thứ', ['conthu', 'thutu']],
  ['branch', 'Chi/nhánh', ['chinhanh', 'chi', 'nhanh']],
  ['birth', 'Ngày sinh', ['ngaysinh', 'namsinh']],
  ['birthPlace', 'Nơi sinh', ['noisinh', 'quequan']],
  ['occupation', 'Nghề nghiệp', ['nghenghiep', 'chucvu']],
  ['status', 'Tình trạng', ['tinhtrang', 'trangthai']],
  ['death', 'Ngày mất', ['ngaymat', 'nammat']],
  ['lunar', 'Ngày giỗ (âm lịch)', ['ngaygioamlich', 'ngaygio', 'gio']],
  ['gravePlace', 'Nơi an táng', ['noiantang', 'phanmo', 'mo']],
  ['graveMap', 'Vị trí mộ', ['vitrimo', 'toado', 'bando', 'vitrimotoadohoaclink']],
  ['bio', 'Tiểu sử', ['tieusu', 'ghichu']],
  ['phone', 'Số điện thoại', ['sodienthoai', 'sdt', 'dienthoai']],
  ['zalo', 'Zalo', ['zalo']],
  ['facebook', 'Facebook', ['facebook', 'fb']],
  ['email', 'Email', ['email']],
  ['website', 'Trang khác', ['trangkhac', 'website', 'mangxahoi']],
  ['address', 'Địa chỉ', ['diachi']],
  ['photo', 'Ảnh (link)', ['anhlink', 'anh', 'photo']]
];
const key = (s) => norm(s).replace(/[^a-z0-9]/g, '');
const HEADER_MAP = new Map();
for (const [k, label, alias] of COLS) { HEADER_MAP.set(key(label), k); for (const a of alias) HEADER_MAP.set(a, k); }

// ---------- Đọc CSV ----------
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Link Google Sheet -> link tải CSV */
export function sheetCsvUrl(url) {
  url = (url || '').trim();
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
  const pub = url.match(/\/spreadsheets\/d\/e\/([\w-]+)/);
  if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${gid}` : ''}`;
  const id = (url.match(/\/spreadsheets\/d\/([\w-]+)/) || [])[1] || (/^[\w-]{30,}$/.test(url) ? url : null);
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1${gid ? `&gid=${gid}` : ''}`;
}

export async function fetchSheet(url) {
  const csvUrl = sheetCsvUrl(url);
  if (!csvUrl) throw new Error('Link không phải Google Sheet. Hãy dán link dạng https://docs.google.com/spreadsheets/d/…');
  let res;
  try { res = await fetch(csvUrl, { cache: 'no-store' }); }
  catch { throw new Error('Không tải được Google Sheet. Hãy chia sẻ sheet ở chế độ “Bất kỳ ai có đường liên kết” → Người xem.'); }
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('Google Sheet chưa được chia sẻ. Bấm Chia sẻ → “Bất kỳ ai có đường liên kết” → Người xem, rồi thử lại.');
  }
  return parseCSV(text);
}

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = XLSX_CDN; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return window.XLSX;
}

export async function readFile(file) {
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const XLSX = await loadXLSX();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    // chọn trang tính có tiêu đề cột hợp lệ
    for (const n of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' });
      if (findHeader(rows) >= 0) return rows;
    }
    throw new Error('Không thấy trang tính có cột “Họ và tên”.');
  }
  return parseCSV(await file.text());
}

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const ks = rows[i].map(c => HEADER_MAP.get(key(c)));
    if (ks.includes('name') && ks.filter(Boolean).length >= 2) return i;
  }
  return -1;
}

// ---------- Chuyển dòng -> dữ liệu gia phả ----------
const slug = (s) => norm(String(s)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function driveImage(u) {
  const id = (u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/) || [])[1];
  return id ? `https://lh3.googleusercontent.com/d/${id}` : u;
}

export function rowsToData(rows) {
  const warnings = [];
  const h = findHeader(rows);
  if (h < 0) throw new Error('Không tìm thấy dòng tiêu đề. Sheet cần có ít nhất cột “Họ và tên” (xem sheet mẫu). Nếu sheet có nhiều tab, hãy mở tab “Thành viên” rồi sao chép link.');
  const cols = rows[h].map(c => HEADER_MAP.get(key(c)));
  const recs = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r]; const o = { _line: r + 1 };
    cols.forEach((k, i) => { if (k) o[k] = String(row[i] ?? '').trim(); });
    if (!Object.values(o).some(v => typeof v === 'string' && v)) continue; // dòng trống
    if (!o.name) { warnings.push(`Dòng ${o._line}: thiếu Họ và tên – bỏ qua.`); continue; }
    recs.push(o);
  }

  // Mã -> id
  const byCode = new Map(), byName = new Map(), dup = new Set();
  recs.forEach((o, i) => {
    o.code = o.code || String(i + 1);
    o.id = 's_' + (slug(o.code) || i + 1);
    if (byCode.has(o.code.toLowerCase())) { warnings.push(`Dòng ${o._line}: mã “${o.code}” bị trùng – đổi thành mã khác.`); o.code += '_' + o._line; o.id += '_' + o._line; }
    byCode.set(o.code.toLowerCase(), o);
    const n = norm(o.name);
    if (byName.has(n)) dup.add(n); else byName.set(n, o);
  });
  const ref = (val, o, what) => {
    if (!val) return '';
    const t = val.trim();
    const hit = byCode.get(t.toLowerCase()) || (!dup.has(norm(t)) && byName.get(norm(t)));
    if (!hit) { warnings.push(`Dòng ${o._line} (${o.name}): không tìm thấy ${what} “${t}”.`); return ''; }
    if (hit === o) { warnings.push(`Dòng ${o._line}: ${what} trỏ vào chính mình.`); return ''; }
    return hit.id;
  };

  const persons = [], contacts = {};
  for (const o of recs) {
    const g = norm(o.gender);
    const gender = /^(nu|f|gai|ba\b|female)/.test(g) ? 'f' : 'm';
    const st = norm(o.status);
    const alive = /mat|qua doi|khuat|chet|tu tran|dead/.test(st) ? false
      : /song|alive/.test(st) ? true
        : !(o.death || o.lunar || o.gravePlace);
    let deathLunar = null;
    if (!alive) {
      const ln = norm(o.lunar || '').replace(/gieng/g, ' 1 ').replace(/chap/g, ' 12 ');
      const nums = ln.match(/\d+/g);
      if (nums && nums.length >= 2) {
        deathLunar = { d: +nums[0], m: +nums[1], y: nums[2] && +nums[2] < new Date().getFullYear() ? +nums[2] : null, leap: /nhuan/.test(norm(o.lunar)) ? 1 : 0 };
        if (deathLunar.d < 1 || deathLunar.d > 30 || deathLunar.m < 1 || deathLunar.m > 12) { warnings.push(`Dòng ${o._line} (${o.name}): ngày giỗ “${o.lunar}” không hợp lệ.`); deathLunar = null; }
      }
      if (!deathLunar) {
        const d = parseDate(o.death);
        if (d?.d && d?.m) deathLunar = solarToLunar(d.d, d.m, d.y);
      }
    }
    const p = {
      id: o.id, code: o.code, name: o.name, otherName: o.otherName || '', gender,
      fatherId: ref(o.father, o, 'cha'), motherId: ref(o.mother, o, 'mẹ'),
      spouses: (o.spouses || '').split(/[;,\n/]+/).map(s => s.trim()).filter(Boolean).map(s => ref(s, o, 'vợ/chồng')).filter(Boolean),
      order: parseInt(o.order, 10) || null, branch: o.branch || '',
      birth: o.birth || '', birthPlace: o.birthPlace || '', occupation: o.occupation || '',
      alive, death: alive ? '' : (o.death || ''), deathLunar,
      gravePlace: alive ? '' : (o.gravePlace || ''), graveMap: alive ? '' : (o.graveMap || ''),
      bio: o.bio || '', photo: o.photo ? driveImage(o.photo) : ''
    };
    persons.push(p);
    const fixTel = (t) => (/^\d{9}$/.test((t || '').replace(/\s/g, '')) ? '0' + t.replace(/\s/g, '') : (t || '')); // Sheet làm mất số 0 đầu
    const c = { phone: fixTel(o.phone), zalo: fixTel(o.zalo), facebook: o.facebook || '', email: o.email || '', website: o.website || '', address: o.address || '' };
    if (Object.values(c).some(Boolean)) contacts[p.id] = c;
  }
  // vợ/chồng hai chiều
  const P = new Map(persons.map(p => [p.id, p]));
  for (const p of persons) for (const s of p.spouses) { const sp = P.get(s); if (sp && !sp.spouses.includes(p.id)) sp.spouses.push(p.id); }
  return { persons, contacts, warnings };
}

// ---------- Xuất CSV ----------
export function exportCSV() {
  const P = store.persons;
  const code = (id) => { const p = P.get(id); return p ? (p.code || p.id) : ''; };
  const idx = ctx.idx;
  const list = [...P.values()].sort((a, b) => (idx.gen.get(a.id) || 99) - (idx.gen.get(b.id) || 99));
  const cell = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const lines = [COLS.map(c => c[1]).map(cell).join(',')];
  for (const p of list) {
    const c = store.contacts.get(p.id) || {};
    const l = p.deathLunar?.d ? `${p.deathLunar.d} tháng ${p.deathLunar.m}${p.deathLunar.leap ? ' nhuận' : ''}` : '';
    const vals = {
      code: p.code || p.id, name: p.name, otherName: p.otherName, gender: p.gender === 'f' ? 'Nữ' : 'Nam',
      father: code(p.fatherId), mother: code(p.motherId), spouses: (p.spouses || []).map(code).filter(Boolean).join('; '),
      order: p.order || '', branch: p.branch, birth: p.birth, birthPlace: p.birthPlace, occupation: p.occupation,
      status: p.alive === false ? 'Đã mất' : 'Còn sống', death: p.death, lunar: l, gravePlace: p.gravePlace, graveMap: p.graveMap,
      bio: p.bio, phone: c.phone, zalo: c.zalo, facebook: c.facebook, email: c.email, website: c.website, address: c.address,
      photo: p.photo && !p.photo.startsWith('data:') ? p.photo : ''
    };
    lines.push(COLS.map(([k]) => cell(vals[k])).join(','));
  }
  download(`gia-pha-${new Date().toISOString().slice(0, 10)}.csv`, new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

// ---------- Giao diện ----------
export function openSheetImport() {
  if (!store.canEdit) return toast('Cần quyền biên tập để nhập dữ liệu');
  const tplCopy = TEMPLATE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${TEMPLATE_SHEET_ID}/copy` : '';
  let parsed = null;
  openModal(`
  <div class="modal-card wide">
    <header><h2>Nhập gia phả từ Google Sheet</h2><button type="button" class="icon-btn" data-close>${icon.close}</button></header>
    <div class="form-body">
      <ol class="steps">
        <li><b>Tạo sheet theo mẫu.</b> Mỗi người một dòng, mỗi người có một <i>Mã</i> riêng; cột <i>Mã cha</i>, <i>Mã mẹ</i>, <i>Mã vợ/chồng</i> ghi mã của người tương ứng.
          <div class="actions left">
            ${tplCopy ? `<a class="btn small primary" target="_blank" rel="noopener" href="${tplCopy}">Tạo bản sao Google Sheet mẫu</a>` : ''}
            <a class="btn small" href="${TEMPLATE_CSV}" download>Tải file mẫu (.csv)</a>
            ${store.persons.size ? '<button type="button" class="btn small" id="sxExport">Xuất gia phả hiện tại ra CSV</button>' : ''}
          </div></li>
        <li><b>Chia sẻ sheet:</b> nút <i>Chia sẻ</i> → “Bất kỳ ai có đường liên kết” → <i>Người xem</i>, rồi sao chép link của sheet.</li>
        <li><b>Dán link</b> rồi bấm Đọc dữ liệu:
          <div class="inline"><input id="sxUrl" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value="${esc(store.clan.sheetUrl || '')}">
          <button type="button" class="btn small primary" id="sxRead">Đọc dữ liệu</button></div>
          <p class="muted tiny">Hoặc chọn file từ máy: <label class="linkish">CSV / Excel<input type="file" id="sxFile" accept=".csv,.xlsx,.xls,.ods" hidden></label></p></li>
      </ol>
      <div id="sxPreview"></div>
    </div>
    <footer><button type="button" class="btn ghost" data-close>Đóng</button><button type="button" class="btn primary" id="sxGo" disabled>Nhập vào gia phả</button></footer>
  </div>`, (m) => {
    const prev = $('#sxPreview', m), go = $('#sxGo', m);
    const show = (rows, src) => {
      try { parsed = rowsToData(rows); parsed.src = src; }
      catch (e) { parsed = null; go.disabled = true; prev.innerHTML = `<p class="note err">${esc(e.message)}</p>`; return; }
      const { persons, contacts, warnings } = parsed;
      const dead = persons.filter(p => !p.alive).length;
      const existing = persons.filter(p => store.persons.has(p.id)).length;
      prev.innerHTML = `
        <div class="sx-stats"><span><b>${persons.length}</b> người</span><span><b>${dead}</b> đã mất</span><span><b>${persons.filter(p => p.deathLunar).length}</b> có ngày giỗ</span><span><b>${Object.keys(contacts).length}</b> có liên hệ</span>${existing ? `<span><b>${existing}</b> đã có (sẽ cập nhật)</span>` : ''}</div>
        ${warnings.length ? `<details class="note warn" ${warnings.length < 6 ? 'open' : ''}><summary>${warnings.length} lưu ý cần kiểm tra</summary><ul>${warnings.slice(0, 50).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : '<p class="note ok">Dữ liệu hợp lệ, không có lỗi.</p>'}
        <div class="sx-table"><table><thead><tr><th>Mã</th><th>Họ và tên</th><th>Giới</th><th>Cha</th><th>Mẹ</th><th>Tình trạng</th><th>Giỗ (ÂL)</th></tr></thead><tbody>
        ${persons.slice(0, 12).map(p => { const f = persons.find(x => x.id === p.fatherId), mo = persons.find(x => x.id === p.motherId); return `<tr><td>${esc(p.code)}</td><td>${esc(p.name)}</td><td>${p.gender === 'f' ? 'Nữ' : 'Nam'}</td><td>${esc(f?.name || '')}</td><td>${esc(mo?.name || '')}</td><td>${p.alive ? 'Còn sống' : 'Đã mất'}</td><td>${p.deathLunar ? `${p.deathLunar.d}/${p.deathLunar.m}` : ''}</td></tr>`; }).join('')}
        </tbody></table>${persons.length > 12 ? `<p class="muted tiny">… và ${persons.length - 12} người nữa</p>` : ''}</div>
        <div class="field"><span>Cách nhập</span><div class="seg">
          <label><input type="radio" name="sxMode" value="merge" checked> Thêm mới & cập nhật</label>
          <label><input type="radio" name="sxMode" value="replace"> Thay thế toàn bộ</label></div>
          <p class="muted tiny">“Thêm mới & cập nhật” giữ lại những người đã nhập tay trên web; người cùng mã sẽ được cập nhật theo sheet.</p></div>`;
      go.disabled = !persons.length;
      $$('input[name=sxMode]', m).forEach(r => r.onchange = () => { go.dataset.confirm = ''; go.classList.remove('danger'); go.textContent = 'Nhập vào gia phả'; });
    };
    $('#sxRead', m).onclick = async () => {
      const url = $('#sxUrl', m).value;
      prev.innerHTML = '<p class="muted">Đang đọc Google Sheet…</p>';
      try { show(await fetchSheet(url), url); } catch (e) { parsed = null; go.disabled = true; prev.innerHTML = `<p class="note err">${esc(e.message)}</p>`; }
    };
    $('#sxUrl', m).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#sxRead', m).click(); } };
    $('#sxFile', m).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      prev.innerHTML = '<p class="muted">Đang đọc file…</p>';
      try { show(await readFile(f), null); } catch (err) { prev.innerHTML = `<p class="note err">${esc(err.message)}</p>`; }
      e.target.value = '';
    };
    $('#sxExport', m)?.addEventListener('click', exportCSV);
    go.onclick = async () => {
      if (!parsed) return;
      const replace = $('input[name=sxMode]:checked', m)?.value === 'replace';
      if (replace && store.persons.size && go.dataset.confirm !== '1') {
        go.dataset.confirm = '1'; go.classList.add('danger');
        go.textContent = `Bấm lần nữa để xoá ${store.persons.size} người hiện có và thay thế`;
        return;
      }
      go.disabled = true; go.textContent = 'Đang nhập…';
      try {
        const data = { persons: parsed.persons, contacts: store.canSeeContacts ? parsed.contacts : {} };
        await store.importAll(data, { replace });
        if (parsed.src && parsed.src !== store.clan.sheetUrl) await store.saveClan({ sheetUrl: parsed.src });
        closeModal(); toast(`Đã nhập ${parsed.persons.length} người từ ${parsed.src ? 'Google Sheet' : 'file'}`);
        location.hash = '#/tree';
      } catch (e) { toast('Lỗi khi nhập: ' + e.message); go.disabled = false; go.textContent = 'Nhập vào gia phả'; }
    };
  });
}
