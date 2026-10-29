// Ứng dụng chính: điều hướng, các trang
import { store } from './store.js';
import { $, $$, esc, ctx, toast, openModal, closeModal, confirmBox, download, avatar, icon } from './ui.js';
import { buildIndex, upcomingGio, lifespan, yearOf, norm, fmtSolar, lunarText } from './family.js';
import { todayLunar, canChiYear, gioInLunarYear } from './lunar.js';
import { TreeView } from './tree.js';
import { renderPersonDetail, openPersonForm, openPerson, closePerson, personLink } from './person.js';
import { openSheetImport, exportCSV } from './sheet-import.js';
import { initPWA, syncReminders, reminderCard, refreshCard, downloadICS, pushCTA, bindPushCTA } from './notify.js';
import { pageNews, newsHomeHTML, isEditing, stopEditing } from './news.js';

store.toast = toast;
let currentPage = null;
let currentKey = null;
let tree = null;
const treeOpts = { rootId: '', hideOutside: false };
const listState = { q: '', gen: '', gender: '', status: '', branch: '' };
let gioRange = 60;
let syncT;
const PAGE_TITLE = { home: '', tree: 'Cây gia phả', list: 'Thành viên', gio: 'Lịch ngày giỗ', news: 'Tin tức', admin: 'Quản trị' };
initPWA();
function pageTitle(pg) {
  const base = store.clan.name ? `Gia phả ${store.clan.name}` : 'Gia Phả Dòng Họ';
  return PAGE_TITLE[pg] ? `${PAGE_TITLE[pg]} – ${base}` : `${base} – Cây phả hệ, ngày giỗ âm lịch`;
}

// ---------- Khởi động ----------
store.on((what) => {
  if (!store.ready) return;
  if (what === 'all' || what === 'persons' || what === 'clan') {
    ctx.idx = buildIndex(store.persons, store.clan);
    clearTimeout(syncT); syncT = setTimeout(() => syncReminders(store.persons, store.clan.name), 800);
  }
  renderChrome();
  if (isEditing() && what !== 'auth') return; // đang soạn bài: không vẽ lại trang
  if (what === 'notices' && currentPage !== 'home' && currentPage !== 'admin') return;
  if (what === 'contacts') return route(false);
  if (what === 'persons' && currentPage === 'tree' && tree) { drawTree(false); return route(false); }
  route(true);
});
window.addEventListener('hashchange', () => route(false));
function parseHash() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  const [page, ...rest] = path.replace(/^\//, '').split('/');
  return { page: page || 'home', sub: rest.join('/'), p: params.get('p') };
}

function route(force) {
  if (!store.ready) return;
  const { page, sub, p } = parseHash();
  const pg = PAGES[page] ? page : 'home';
  const key = pg + '/' + sub;
  if (force || key !== currentKey) {
    if (pg !== 'news' || !sub.startsWith('edit')) stopEditing();
    currentPage = pg; currentKey = key;
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === pg));
    if (pg !== 'tree') { tree = null; }
    document.body.dataset.page = pg;
    document.title = pageTitle(pg);
    PAGES[pg](sub);
    if (!p) window.scrollTo(0, 0);
  } else if (pg === 'tree' && tree) {
    drawTree(false);
  }
  // Bảng chi tiết
  const drawer = $('#drawer');
  if (p) {
    renderPersonDetail(p);
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('show');
    if (pg === 'tree' && tree) {
      if (tree.expandTo(p)) drawTree(false);
      tree.centerOn(p);
    }
  } else {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    $('#scrim').classList.remove('show');
  }
}
$('#scrim').onclick = closePerson;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#drawer').classList.contains('open') && !$('#modal').open) closePerson(); });

function renderChrome() {
  const c = store.clan;
  $('#brandTitle').textContent = c.name ? `Gia phả ${c.name}` : 'Gia Phả Dòng Họ';
  $('#brandSub').textContent = c.origin || c.motto || 'Uống nước nhớ nguồn';
  document.title = pageTitle(currentPage);
  let dismissed = false; try { dismissed = sessionStorage.getItem('gp-banner') === '1'; } catch { /* bỏ qua */ }
  $('#demoBanner').classList.toggle('hidden', store.mode !== 'demo' || dismissed);
  $('#bannerX').onclick = () => { try { sessionStorage.setItem('gp-banner', '1'); } catch { /* bỏ qua */ } $('#demoBanner').classList.add('hidden'); };
  $('#navAdmin').classList.toggle('hidden', !store.canEdit);
  const a = $('#auth');
  if (store.mode === 'demo') {
    a.innerHTML = `<button class="user-btn" id="userBtn"><span class="role-pill">Dùng thử</span></button>`;
    $('#userBtn').onclick = () => openModal(`<div class="modal-card small"><h2>Chế độ dùng thử</h2>
      <p class="muted">Dữ liệu chỉ lưu trên trình duyệt này.</p>
      <div class="actions"><button class="btn ghost" data-close>Đóng</button><a class="btn primary" href="#/admin" data-close>Vào trang Quản trị</a></div></div>`);
    return;
  }
  if (!store.user) {
    a.innerHTML = `<button class="btn small primary" id="loginBtn">Đăng nhập</button>`;
    $('#loginBtn').onclick = () => store.signIn();
    return;
  }
  const roleName = { owner: 'Quản trị', editor: 'Biên tập', member: 'Thành viên', viewer: 'Khách' }[store.role];
  a.innerHTML = `<button class="user-btn" id="userBtn" title="${esc(store.user.email)}">
    ${store.user.photo ? `<img src="${esc(store.user.photo)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="role-pill">${roleName}</span></button>`;
  $('#userBtn').onclick = () => openModal(`<div class="modal-card small">
    <h2>${esc(store.user.name || '')}</h2><p class="muted">${esc(store.user.email)}</p>
    <p>Quyền: <b>${roleName}</b></p>
    ${store.role === 'viewer' ? '<p class="muted note">Bạn đang có quyền xem. Nhờ quản trị viên dòng họ thêm email của bạn để xem liên hệ hoặc cập nhật gia phả.</p>' : ''}
    <div class="actions"><button class="btn ghost" data-close>Đóng</button>${store.canEdit ? '<a class="btn" href="#/admin" data-close>Quản trị</a>' : ''}<button class="btn danger" id="logoutBtn">Đăng xuất</button></div></div>`,
    m => { $('#logoutBtn', m).onclick = () => { store.signOut(); closeModal(); }; });
}

// ---------- TRANG CHỦ ----------
function pageHome() {
  const c = store.clan, idx = ctx.idx, P = store.persons;
  const total = P.size;
  const alive = [...P.values()].filter(p => p.alive !== false).length;
  const blood = idx.blood.size;
  const gios = upcomingGio(P).slice(0, 5);
  const root = P.get(c.rootId) || P.get(idx.roots[0]);
  const lt = todayLunar();
  const t = new Date();

  const title = c.fullName || (c.name ? 'Gia phả ' + c.name : 'Gia phả dòng họ');
  const lead = total
    ? `${total} người qua ${idx.maxGen} đời${root ? `, từ thủy tổ ${esc(root.name)}${yearOf(root.birth) ? ` (${esc(lifespan(root)).replace(/ – /g, '\u00a0–\u00a0')})` : ''}` : ''}. ${alive} người đang sống, ${blood} người mang huyết thống.`
    : 'Cây phả hệ, ngày giỗ âm lịch và phần mộ của dòng họ, để con cháu cùng xem và cập nhật.';

  $('#view').innerHTML = `
  <section class="home-hero">
    <div class="hh-text">
      <h1 class="${title.length > 24 ? 'long' : ''}">${esc(title)}</h1>
      <p class="hh-lead">${lead}</p>
      ${c.origin || c.hall ? `<p class="hero-meta">${c.origin ? `${icon.map} Quê gốc ${esc(c.origin)}` : ''}${c.origin && c.hall ? '<span aria-hidden="true">·</span>' : ''}${c.hall ? esc(c.hall) : ''}</p>` : ''}
      <div class="hero-cta"><a class="btn primary" href="#/tree">${icon.tree} Xem cây gia phả</a><a class="btn" href="#/gio">${icon.incense} Lịch ngày giỗ</a></div>
      ${c.motto ? `<p class="hh-motto">${esc(c.motto)}</p>` : ''}
      <p class="hh-today">Hôm nay ${fmtSolar(t)}, nhằm ${lunarText({ d: lt.d, m: lt.m, leap: lt.leap }).replace(/^N/, 'n')} năm ${canChiYear(lt.y)}</p>
    </div>
    ${root ? lineageHTML(root) : ''}
  </section>

  ${total === 0 ? `<div class="empty card"><h2>Gia phả còn trống</h2><p>Bắt đầu bằng cách thêm vị thủy tổ (người cao nhất mà dòng họ biết).</p>
    ${store.canEdit ? `<div class="actions" style="justify-content:center"><button class="btn primary" id="addFirst">${icon.plus} Thêm thủy tổ</button><button class="btn" id="sheetFirst">Nhập từ Google Sheet</button></div>` : store.mode === 'firebase' && !store.user ? '<p class="muted">Đăng nhập để bắt đầu.</p>' : ''}</div>` : ''}

  ${noticeHTML()}
  ${pushCTA()}
  ${newsHomeHTML()}

  <div class="home-grid ${c.intro ? '' : 'solo'}">
    <section class="home-gio">
      <div class="card-h"><h2>Ngày giỗ sắp tới</h2><a href="#/gio">Xem tất cả</a></div>
      ${gios.length ? `<ul class="gio-list">${gios.map(gioItem).join('')}</ul>` : '<p class="muted">Chưa có ngày giỗ nào được nhập.</p>'}
    </section>
    ${c.intro ? `<section class="home-intro"><h2>Giới thiệu dòng họ</h2><div class="intro">${esc(c.intro).split(/\n+/).map(s => `<p>${s}</p>`).join('')}</div></section>` : ''}
  </div>`;
  $('#addFirst')?.addEventListener('click', () => openPersonForm(null, { alive: false }, 'Thêm thủy tổ'));
  $('#sheetFirst')?.addEventListener('click', openSheetImport);
  bindPushCTA();
  $('#noticeX')?.addEventListener('click', (e) => { try { localStorage.setItem('gp-notice-seen', e.currentTarget.dataset.id); } catch { /* bỏ qua */ } $('#noticeBox').remove(); });
}

/** Ba đời đầu theo trục dọc như trang mở đầu cuốn tộc phả: thủy tổ, các con, rồi số đời còn lại */
function lineageHTML(root) {
  const idx = ctx.idx, P = store.persons;
  const spouses = idx.unitSpouses(root.id).map(id => P.get(id)).filter(Boolean);
  const kids = idx.treeChildren(root.id).map(id => P.get(id)).filter(Boolean);
  const shown = kids.slice(0, 5);
  const rest = idx.descendants(root.id).size - kids.length;
  const gen = (n) => `<span class="ln-gen">Đời ${n}</span>`;
  return `<nav class="lineage" aria-label="Ba đời đầu của dòng họ">
    <div class="ln-row ln-root">${gen(1)}
      <a class="ln-founder" href="${personLink(root.id)}">${avatar(root, 96)}<span><b>${esc(root.name)}</b><small>Thủy tổ · ${esc(lifespan(root))}</small>
        ${spouses.length ? `<small>${root.gender === 'f' ? 'Chồng' : 'Vợ'}: ${spouses.map(s => esc(s.name)).join(', ')}</small>` : ''}</span></a>
    </div>
    ${shown.length ? `<div class="ln-row">${gen(2)}<ul class="ln-kids">${shown.map(k => {
      const n = idx.descendants(k.id).size;
      return `<li><a href="${personLink(k.id)}">${avatar(k, 40)}<span><b>${esc(k.name)}</b><small>${esc(lifespan(k))}${n ? ` · ${n} con cháu` : ''}</small></span></a></li>`;
    }).join('')}${kids.length > shown.length ? `<li class="ln-more">và ${kids.length - shown.length} người con khác</li>` : ''}</ul></div>` : ''}
    ${rest > 0 ? `<div class="ln-row">${gen(`3–${idx.maxGen}`)}<a class="ln-all" href="#/tree">${rest} người nữa trên cây gia phả ${icon.tree}</a></div>` : ''}
  </nav>`;
}

/** Thông báo mới nhất từ quản trị (hiện trên trang chủ trong 14 ngày) */
function noticeHTML() {
  const n = store.notices[0];
  if (!n || Date.now() - n.createdAt > 14 * 86400000) return '';
  let seen = ''; try { seen = localStorage.getItem('gp-notice-seen'); } catch { /* bỏ qua */ }
  if (seen === n.id) return '';
  return `<section class="notice-box" id="noticeBox"><div class="gio-ic">${icon.share}</div>
    <div><small>Thông báo từ dòng họ · ${new Date(n.createdAt).toLocaleDateString('vi-VN')}</small><h2 class="notice-title">${esc(n.title)}</h2>${n.body ? `<p class="muted">${esc(n.body)}</p>` : ''}
    ${n.hash && n.hash !== '#/' ? `<a class="btn small" href="${esc(n.hash)}">Xem chi tiết</a>` : ''}</div>
    <button class="icon-btn" id="noticeX" data-id="${esc(n.id)}" aria-label="Ẩn thông báo">${icon.close}</button></section>`;
}

function gioItem(g) {
  const p = g.person;
  return `<li><a href="${personLink(p.id)}">
    <div class="gio-date ${g.days <= 7 ? 'soon' : ''}"><b>${g.date.getDate()}</b><small>Th${g.date.getMonth() + 1}</small></div>
    <div class="gio-main"><b>${esc(p.name)}</b><span class="muted">${esc(lunarText({ d: p.deathLunar.d, m: p.deathLunar.m }))} · Đời ${ctx.idx.gen.get(p.id) || '?'}</span></div>
    <div class="gio-count">${g.days === 0 ? '<b class="hot">Hôm nay</b>' : g.days === 1 ? '<b class="hot">Ngày mai</b>' : `còn <b>${g.days}</b> ngày`}</div></a></li>`;
}

// ---------- CÂY GIA PHẢ ----------
function pageTree() {
  const idx = ctx.idx;
  const rootChoices = [...store.persons.values()].filter(p => idx.blood.has(p.id) && idx.treeChildren(p.id).length)
    .sort((a, b) => (idx.gen.get(a.id) || 0) - (idx.gen.get(b.id) || 0));
  $('#view').innerHTML = `
  <div class="tree-page">
    <h1 class="sr-only">Cây gia phả</h1>
    <div class="tree-bar">
      <div class="search-wrap"><input id="tSearch" type="search" placeholder="Tìm người trên cây…"><div id="tResults" class="results"></div></div>
      <div class="tree-ctrls">
      <select id="tRoot" title="Hiển thị từ"><option value="">Toàn bộ dòng họ</option>${rootChoices.map(p => `<option value="${p.id}" ${treeOpts.rootId === p.id ? 'selected' : ''}>Nhánh: ${esc(p.name)} (Đời ${idx.gen.get(p.id)})</option>`).join('')}</select>
      <select id="tDepth" title="Thu gọn"><option value="">Mở tất cả</option>${[1, 2, 3, 4, 5].map(d => `<option value="${d}">Hiện ${d + 1} đời</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" id="tOutside" ${treeOpts.hideOutside ? 'checked' : ''}> Ẩn cháu ngoại</label>
      <span class="grow"></span>
      ${store.canEdit ? `<button class="btn small" id="tAdd">${icon.plus} Thêm người</button>` : ''}
      <button class="btn small" id="tPng">Xuất ảnh</button>
      <button class="btn small hide-sm" id="tPrint">In</button>
      </div>
    </div>
    <div class="tree-host" id="treeHost">
      <div class="zoom">
        <button class="icon-btn" id="zIn" aria-label="Phóng to">+</button>
        <button class="icon-btn" id="zOut" aria-label="Thu nhỏ">−</button>
        <button class="icon-btn" id="zFit" aria-label="Vừa màn hình" title="Vừa màn hình">⤢</button>
      </div>
      <div class="legend"><span><i class="lg m"></i>Nam</span><span><i class="lg f"></i>Nữ</span><span><i class="lg dead"></i>Đã mất</span><span><i class="lg inlaw"></i>Dâu / rể</span></div>
    </div>
  </div>`;
  if (!store.persons.size) {
    $('#treeHost').insertAdjacentHTML('beforeend', `<div class="empty overlay"><p>Gia phả chưa có ai.</p>${store.canEdit ? '<p>Bấm “Thêm người” để bắt đầu.</p>' : ''}</div>`);
  }
  tree = new TreeView($('#treeHost'), { onSelect: (id) => openPerson(id) });
  drawTree(true);
  requestAnimationFrame(() => {
    const { p } = parseHash();
    if (p && tree.centerOn(p)) return;
    tree.fit(true);
  });

  $('#zIn').onclick = () => tree.zoomBy(1.25);
  $('#zOut').onclick = () => tree.zoomBy(0.8);
  $('#zFit').onclick = () => tree.fit();
  $('#tRoot').onchange = (e) => { treeOpts.rootId = e.target.value; tree.collapsed.clear(); drawTree(true); tree.fit(true); };
  $('#tOutside').onchange = (e) => { treeOpts.hideOutside = e.target.checked; drawTree(true); tree.fit(true); };
  $('#tDepth').onchange = (e) => { tree.collapsed.clear(); drawTree(true); tree.collapseFrom(e.target.value ? +e.target.value : null); drawTree(true); tree.fit(true); };
  $('#tAdd')?.addEventListener('click', () => openPersonForm(null));
  $('#tPng').onclick = async () => {
    toast('Đang tạo ảnh…');
    try { download(`gia-pha-${norm(store.clan.name || 'dong-ho').replace(/\s+/g, '-')}.png`, await tree.exportPNG()); }
    catch { download('gia-pha.svg', new Blob([tree.exportSVG()], { type: 'image/svg+xml' })); toast('Đã xuất file SVG'); }
  };
  $('#tPrint').onclick = () => {
    const w = window.open('', '_blank');
    if (!w) return toast('Trình duyệt chặn cửa sổ in – hãy cho phép pop-up');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(document.title)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600&family=Noto+Serif:wght@700&display=swap" rel="stylesheet">
      <style>@page{size:landscape;margin:8mm}body{margin:0}svg{width:100%;height:auto}</style></head>
      <body>${tree.exportSVG()}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`);
    w.document.close();
  };

  const input = $('#tSearch'), res = $('#tResults');
  input.oninput = () => {
    const q = norm(input.value.trim());
    if (!q) { res.innerHTML = ''; treeOpts.highlight = null; drawTree(false); return; }
    const hits = [...store.persons.values()].filter(p => norm(p.name + ' ' + (p.otherName || '')).includes(q)).slice(0, 12);
    treeOpts.highlight = new Set(hits.map(h => h.id)); drawTree(false);
    res.innerHTML = hits.map(p => `<button data-go="${p.id}">${avatar(p, 26)}<span>${esc(p.name)}<small>Đời ${ctx.idx.gen.get(p.id) || '?'} · ${esc(lifespan(p))}</small></span></button>`).join('') || '<div class="muted pad">Không tìm thấy</div>';
    $$('[data-go]', res).forEach(b => b.onclick = () => { res.innerHTML = ''; openPerson(b.dataset.go); });
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') $('[data-go]', res)?.click(); };
}

function drawTree(reset) {
  if (!tree) return;
  const keep = { ...tree.t };
  const { p } = parseHash();
  tree.render(ctx.idx, { ...treeOpts, selected: p, title: store.clan.fullName || (store.clan.name ? 'Gia phả ' + store.clan.name : 'Gia phả') });
  if (!reset) { tree.t = keep; tree._apply(); }
}

// ---------- DANH SÁCH ----------
function pageList() {
  const idx = ctx.idx;
  const branches = [...new Set([...store.persons.values()].map(p => p.branch).filter(Boolean))];
  $('#view').innerHTML = `
  <div class="page">
    <div class="page-h"><h1>Thành viên dòng họ</h1>${store.canEdit ? `<div class="actions" style="margin:0"><button class="btn" id="lSheet">Nhập từ Google Sheet</button><button class="btn primary" id="lAdd">${icon.plus} Thêm thành viên</button></div>` : ''}</div>
    <div class="filters">
      <input id="lq" type="search" placeholder="Tìm theo tên (có thể gõ không dấu)…" value="${esc(listState.q)}">
      <select id="lgen"><option value="">Mọi đời</option>${Array.from({ length: idx.maxGen }, (_, i) => `<option value="${i + 1}" ${listState.gen == i + 1 ? 'selected' : ''}>Đời ${i + 1}</option>`).join('')}</select>
      <select id="lgender"><option value="">Nam & nữ</option><option value="m" ${listState.gender === 'm' ? 'selected' : ''}>Nam</option><option value="f" ${listState.gender === 'f' ? 'selected' : ''}>Nữ</option></select>
      <select id="lstatus"><option value="">Mọi tình trạng</option><option value="alive" ${listState.status === 'alive' ? 'selected' : ''}>Còn sống</option><option value="dead" ${listState.status === 'dead' ? 'selected' : ''}>Đã mất</option><option value="blood" ${listState.status === 'blood' ? 'selected' : ''}>Huyết thống</option><option value="inlaw" ${listState.status === 'inlaw' ? 'selected' : ''}>Dâu / rể</option></select>
      ${branches.length ? `<select id="lbranch"><option value="">Mọi chi</option>${branches.map(b => `<option ${listState.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}
    </div>
    <p class="muted" id="lcount"></p>
    <div class="people" id="people"></div>
  </div>`;
  const draw = () => {
    const q = norm(listState.q);
    const list = [...store.persons.values()].filter(p => {
      if (q && !norm(`${p.name} ${p.otherName || ''} ${p.birthPlace || ''} ${p.occupation || ''}`).includes(q)) return false;
      if (listState.gen && idx.gen.get(p.id) != listState.gen) return false;
      if (listState.gender && (p.gender || 'm') !== listState.gender) return false;
      if (listState.status === 'alive' && p.alive === false) return false;
      if (listState.status === 'dead' && p.alive !== false) return false;
      if (listState.status === 'blood' && !idx.blood.has(p.id)) return false;
      if (listState.status === 'inlaw' && idx.blood.has(p.id)) return false;
      if (listState.branch && p.branch !== listState.branch) return false;
      return true;
    }).sort((a, b) => (idx.gen.get(a.id) || 99) - (idx.gen.get(b.id) || 99) || (yearOf(a.birth) || 9999) - (yearOf(b.birth) || 9999));
    $('#lcount').textContent = `${list.length} người`;
    $('#people').innerHTML = list.map(p => {
      const father = store.persons.get(p.fatherId), sp = idx.spousesOf(p.id).map(s => store.persons.get(s)?.name);
      const rel = father ? `Con ông ${father.name}` : sp.length ? `${p.gender === 'f' ? 'Vợ' : 'Chồng'} ${sp[0]}` : '';
      return `<a class="person-card ${p.alive === false ? 'dead' : ''}" href="${personLink(p.id)}">${avatar(p, 48)}
        <div><b>${esc(p.name)}</b><span class="muted">${esc(lifespan(p))}${rel ? ' · ' + esc(rel) : ''}</span>
        <span class="mini-badges"><i>Đời ${idx.gen.get(p.id) || '?'}</i>${p.alive === false ? '<i class="d">Đã mất</i>' : '<i class="a">Còn sống</i>'}${!idx.blood.has(p.id) ? `<i>${p.gender === 'f' ? 'Dâu' : 'Rể'}</i>` : ''}</span></div></a>`;
    }).join('') || '<p class="muted">Không có ai phù hợp.</p>';
  };
  draw();
  const bind = (sel, key) => { const el = $(sel); if (el) el.oninput = () => { listState[key] = el.value; draw(); }; };
  bind('#lq', 'q'); bind('#lgen', 'gen'); bind('#lgender', 'gender'); bind('#lstatus', 'status'); bind('#lbranch', 'branch');
  $('#lAdd')?.addEventListener('click', () => openPersonForm(null));
  $('#lSheet')?.addEventListener('click', openSheetImport);
}

// ---------- NGÀY GIỖ ----------
function pageGio() {
  const all = upcomingGio(store.persons);
  const list = all.filter(g => g.days <= gioRange);
  const lt = todayLunar();
  $('#view').innerHTML = `
  <div class="page">
    <div class="page-h"><h1>Lịch ngày giỗ</h1>
      <button class="btn" id="icsBtn">Thêm vào lịch điện thoại (.ics)</button></div>
    <p class="muted">Hôm nay ${fmtSolar(new Date())} – nhằm ${lunarText({ d: lt.d, m: lt.m, leap: lt.leap })} năm ${canChiYear(lt.y)}.</p>
    <div class="seg tabs">${[[30, '30 ngày'], [60, '2 tháng'], [180, '6 tháng'], [400, 'Cả năm']].map(([v, l]) => `<button class="${gioRange === v ? 'on' : ''}" data-r="${v}">${l}</button>`).join('')}</div>
    ${list.length ? `<ul class="gio-list">${list.map(gioItem).join('')}</ul>` : `<div class="empty card"><p>Không có ngày giỗ nào trong khoảng này.</p></div>`}
    ${all.length < [...store.persons.values()].filter(p => p.alive === false).length ? `<p class="muted note">Một số người đã mất chưa có ngày giỗ âm lịch – hãy cập nhật để hiện trong lịch.</p>` : ''}
    ${reminderCard()}
  </div>`;
  refreshCard();
  $$('[data-r]').forEach(b => b.onclick = () => { gioRange = +b.dataset.r; pageGio(); });
  $('#icsBtn').onclick = () => downloadICS(store.persons.values(), store.clan.name);
}

// ---------- QUẢN TRỊ ----------
function pageAdmin() {
  if (!store.canEdit) { $('#view').innerHTML = `<div class="page"><div class="empty card"><h2>Cần quyền quản trị</h2><p>Hãy đăng nhập bằng tài khoản được cấp quyền.</p></div></div>`; return; }
  const c = store.clan, a = store.access;
  const blood = [...store.persons.values()].filter(p => ctx.idx.blood.has(p.id)).sort((x, y) => (ctx.idx.gen.get(x.id) || 0) - (ctx.idx.gen.get(y.id) || 0));
  $('#view').innerHTML = `
  <div class="page narrow">
    <h1>Quản trị</h1>
    <form class="card" id="clanForm">
      <h2>Thông tin dòng họ</h2>
      <div class="grid2">
        <label>Tên dòng họ<input name="name" value="${esc(c.name)}" placeholder="VD: Họ Nguyễn"></label>
        <label>Tiêu đề đầy đủ<input name="fullName" value="${esc(c.fullName)}" placeholder="VD: Gia phả họ Nguyễn – chi Yên Lộ"></label>
        <label>Quê gốc<input name="origin" value="${esc(c.origin)}"></label>
        <label>Câu khẩu hiệu<input name="motto" value="${esc(c.motto)}" placeholder="Uống nước nhớ nguồn"></label>
        <label class="span2">Nhà thờ họ<input name="hall" value="${esc(c.hall)}"></label>
        <label class="span2">Thủy tổ (gốc cây)<select name="rootId"><option value="">Tự động</option>${blood.map(p => `<option value="${p.id}" ${c.rootId === p.id ? 'selected' : ''}>${esc(p.name)} · Đời ${ctx.idx.gen.get(p.id)}</option>`).join('')}</select></label>
        <label class="span2">Giới thiệu / lịch sử dòng họ<textarea name="intro" rows="5">${esc(c.intro)}</textarea></label>
      </div>
      <div class="actions"><button class="btn primary">Lưu thông tin</button></div>
    </form>

    ${store.mode === 'firebase' ? `<form class="card" id="accForm">
      <h2>Phân quyền</h2>
      <p class="muted">Mỗi dòng một địa chỉ Gmail. Ai cũng xem được cây gia phả; chỉ <b>Thành viên</b> trở lên mới xem số điện thoại, mạng xã hội. Email ghi trong thông tin liên hệ của mỗi người (nhập tay hoặc từ Google Sheet) sẽ <b>tự động được thêm vào nhóm Thành viên</b>.</p>
      <label>Quản trị (toàn quyền)<textarea name="owners" rows="2" ${store.isOwner ? '' : 'disabled'}>${esc((a.owners || []).join('\n'))}</textarea></label>
      <label>Biên tập (thêm/sửa/xoá người)<textarea name="editors" rows="3" ${store.isOwner ? '' : 'disabled'}>${esc((a.editors || []).join('\n'))}</textarea></label>
      <label>Thành viên (xem liên hệ)<textarea name="members" rows="5" ${store.isOwner ? '' : 'disabled'}>${esc((a.members || []).join('\n'))}</textarea></label>
      ${store.isOwner ? '<div class="actions"><button class="btn primary">Lưu phân quyền</button></div>' : '<p class="muted note">Chỉ quản trị viên mới đổi được phân quyền.</p>'}
    </form>` : ''}

    ${store.isOwner || store.mode === 'demo' ? `<form class="card" id="noticeForm">
      <h2>Gửi thông báo đến mọi người</h2>
      <p class="muted">Thông báo được đẩy đến điện thoại của những người đã cài ứng dụng và bật thông báo, đồng thời hiện trên trang chủ 14 ngày. Thường đến trong vòng 5–15 phút.</p>
      <label>Tiêu đề *<input name="title" required maxlength="80" placeholder="VD: Họp họ chuẩn bị giỗ tổ"></label>
      <label>Nội dung<textarea name="body" rows="3" maxlength="300" placeholder="VD: 8h sáng Chủ nhật 15/11 tại nhà thờ họ…"></textarea></label>
      <label>Khi bấm vào thông báo thì mở<select name="hash">
        <option value="#/">Trang chủ</option><option value="#/news">Tin tức</option><option value="#/gio">Lịch ngày giỗ</option><option value="#/tree">Cây gia phả</option>
        ${[...store.news.values()].filter(x => x.published !== false).sort((x, y) => y.createdAt - x.createdAt).slice(0, 10).map(x => `<option value="#/news/${esc(x.id)}">Bài: ${esc(x.title.slice(0, 60))}</option>`).join('')}
      </select></label>
      <div class="actions"><button class="btn primary">Gửi thông báo</button></div>
      ${store.notices.length ? `<div class="sx-table"><table><thead><tr><th>Thông báo</th><th>Lúc</th><th>Trạng thái</th></tr></thead><tbody>
        ${store.notices.map(x => `<tr><td>${esc(x.title)}</td><td>${new Date(x.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${x.sent ? `Đã gửi ${x.sentCount ?? ''} máy` : 'Đang chờ gửi…'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </form>` : ''}

    <div class="card">
      <h2>Google Sheet</h2>
      <p class="muted">Nhập cả gia phả từ một Google Sheet theo mẫu – tiện khi nhiều người cùng điền hoặc đã có sẵn danh sách. Có thể nhập lại nhiều lần để cập nhật.</p>
      ${c.sheetUrl ? `<p class="tiny">Sheet đã dùng: <a href="${esc(c.sheetUrl)}" target="_blank" rel="noopener">${esc(c.sheetUrl.slice(0, 70))}…</a></p>` : ''}
      <div class="actions left">
        <button class="btn primary" id="sheetBtn">Nhập từ Google Sheet…</button>
        <button class="btn" id="csvBtn">Xuất ra CSV (mở bằng Google Sheet / Excel)</button>
      </div>
    </div>

    <div class="card">
      <h2>Sao lưu dữ liệu</h2>
      <p class="muted">Nên tải bản sao lưu định kỳ. File JSON chứa toàn bộ gia phả${store.canSeeContacts ? ' (kể cả liên hệ)' : ''}.</p>
      <div class="actions left">
        <button class="btn" id="expBtn">Tải bản sao lưu (.json)</button>
        <label class="btn">Nhập từ file…<input type="file" accept=".json,application/json" id="impFile" hidden></label>
        ${store.mode === 'demo' ? '<button class="btn danger-ghost" id="resetBtn">Khôi phục dữ liệu mẫu</button>' : ''}
        <button class="btn danger-ghost" id="wipeBtn">Xoá toàn bộ thành viên</button>
      </div>
    </div>
  </div>`;

  $('#clanForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, data = {};
    for (const k of ['name', 'fullName', 'origin', 'motto', 'hall', 'rootId', 'intro']) data[k] = f[k].value.trim();
    await store.saveClan(data); toast('Đã lưu thông tin dòng họ');
  };
  $('#accForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const parse = (s) => [...new Set(s.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')))];
    const data = { owners: parse(f.owners.value), editors: parse(f.editors.value), members: parse(f.members.value) };
    if (!data.owners.includes(store.user.email.toLowerCase())) {
      if (!await confirmBox('Bạn đang tự bỏ quyền quản trị của mình. Tiếp tục?', 'Tiếp tục', true)) return;
    }
    await store.saveAccess(data); toast('Đã lưu phân quyền');
  });
  $('#noticeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!await confirmBox(`Gửi thông báo “${esc(f.title.value)}” đến mọi người?`, 'Gửi')) return;
    try { await store.sendNotice({ title: f.title.value.trim(), body: f.body.value.trim(), hash: f.hash.value }); toast('Đã xếp lịch gửi – điện thoại sẽ nhận trong vài phút'); }
    catch { /* lỗi đã báo */ }
  });
  $('#sheetBtn').onclick = openSheetImport;
  $('#csvBtn').onclick = exportCSV;
  $('#expBtn').onclick = () => {
    const d = new Date().toISOString().slice(0, 10);
    download(`gia-pha-${d}.json`, new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' }));
  };
  $('#impFile').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.persons)) throw new Error('File không đúng định dạng');
      const replace = await confirmBox(`File có <b>${data.persons.length}</b> người. Chọn <b>Thay thế</b> để xoá dữ liệu hiện tại và dùng dữ liệu trong file; bấm Huỷ để chỉ gộp thêm.`, 'Thay thế', true);
      await store.importAll(data, { replace });
      toast('Đã nhập dữ liệu');
    } catch (err) { toast('Lỗi: ' + err.message); }
    e.target.value = '';
  };
  $('#resetBtn')?.addEventListener('click', async () => { if (await confirmBox('Khôi phục dữ liệu mẫu ban đầu?')) { store.resetDemo(); toast('Đã khôi phục'); } });
  $('#wipeBtn').onclick = async () => {
    if (!await confirmBox('Xoá <b>toàn bộ</b> thành viên? Hãy tải bản sao lưu trước. Thao tác này không hoàn tác được.', 'Xoá hết', true)) return;
    await store.importAll({ persons: [], contacts: {} }, { replace: true });
    toast('Đã xoá toàn bộ');
  };
}

const PAGES = { home: pageHome, tree: pageTree, list: pageList, gio: pageGio, news: pageNews, admin: pageAdmin };

store.init().catch(e => {
  console.error(e);
  $('#view').innerHTML = `<div class="empty"><h2>Không kết nối được dữ liệu</h2><p>${esc(e.message)}</p><p class="muted">Kiểm tra cấu hình trong js/firebase-config.js.</p></div>`;
});
