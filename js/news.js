// Tin tức dòng họ: danh sách, bài viết, trình soạn thảo (Quill)
import { store } from './store.js';
import { $, $$, esc, toast, confirmBox, icon } from './ui.js';

const QUILL_JS = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';
const QUILL_CSS = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
const PURIFY_JS = 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js';

let editing = false;
export const isEditing = () => editing;
export const stopEditing = () => { editing = false; };

const loadScript = (src) => new Promise((res, rej) => {
  if ([...document.scripts].some(s => s.src === src)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
});
const loadCSS = (href) => { if (![...document.styleSheets].some(s => s.href === href)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); } };

const fmtDate = (t) => new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const sorted = () => [...store.news.values()].filter(n => n.published !== false || store.canEdit)
  .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));
const textOf = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
const excerpt = (n, len = 160) => { const t = n.summary || textOf(n.content); return t.length > len ? t.slice(0, len - 1) + '…' : t; };
export const newsLink = (id) => `#/news/${encodeURIComponent(id)}`;

/** Làm sạch HTML trước khi hiển thị (chặn mã độc) */
async function sanitize(html) {
  try {
    await loadScript(PURIFY_JS);
    const P = window.DOMPurify;
    if (!P._gp) {
      P.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'iframe' && !/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//.test(node.getAttribute('src') || '')) node.remove();
      });
      P.addHook('afterSanitizeAttributes', (node) => { if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener'); } });
      P._gp = true;
    }
    return P.sanitize(html || '', { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target'] });
  } catch {
    // dự phòng khi không tải được thư viện: chỉ giữ chữ
    return `<p>${esc(textOf(html))}</p>`;
  }
}

/** Thu nhỏ ảnh (giữ tỉ lệ) -> dataURL JPEG */
function shrink(file, max = 1280, q = 0.8) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}

// ---------- Khối tin trên trang chủ ----------
export function newsHomeHTML() {
  const list = sorted().filter(n => n.published !== false).slice(0, 3);
  if (!list.length && !store.canEdit) return '';
  return `<section class="news-home">
    <div class="card-h"><h2>Tin tức dòng họ</h2><a href="#/news">Xem tất cả</a></div>
    ${list.length ? `<div class="news-grid">${list.map(card).join('')}</div>`
      : `<div class="empty card"><p>Chưa có bài viết nào.</p><a class="btn primary" href="#/news/edit/new">${icon.plus} Viết bài đầu tiên</a></div>`}
  </section>`;
}

function card(n) {
  return `<a class="news-card" href="${newsLink(n.id)}">
    <div class="news-cover">${n.cover ? `<img src="${esc(n.cover)}" alt="" loading="lazy">` : `<span class="news-ph">${icon.tree}</span>`}
      ${n.pinned ? '<span class="pin">Ghim</span>' : ''}${n.published === false ? '<span class="pin draft">Bản nháp</span>' : ''}</div>
    <div class="news-body"><small class="muted">${fmtDate(n.createdAt)}</small><h3>${esc(n.title)}</h3><p class="muted">${esc(excerpt(n))}</p></div>
  </a>`;
}

// ---------- Trang tin tức ----------
export function pageNews(sub) {
  editing = false;
  const [a, b] = (sub || '').split('/');
  if (a === 'edit') return pageEditor(b && b !== 'new' ? decodeURIComponent(b) : null);
  if (a) return pageArticle(decodeURIComponent(a));
  const list = sorted();
  $('#view').innerHTML = `<div class="page">
    <div class="page-h"><h1>Tin tức dòng họ</h1>${store.canEdit ? `<a class="btn primary" href="#/news/edit/new">${icon.plus} Viết bài mới</a>` : ''}</div>
    <p class="muted">Thông báo họp họ, giỗ tổ, khuyến học, việc hiếu hỉ và các tin vui của con cháu.</p>
    ${list.length ? `<div class="news-grid">${list.map(card).join('')}</div>` : '<div class="empty card"><p>Chưa có bài viết nào.</p></div>'}
  </div>`;
}

async function pageArticle(id) {
  const n = store.news.get(id);
  if (!n) { $('#view').innerHTML = '<div class="page"><div class="empty card"><h2>Không tìm thấy bài viết</h2><a class="btn" href="#/news">Về trang tin tức</a></div></div>'; return; }
  document.title = `${n.title} – Tin tức gia phả`;
  const others = sorted().filter(x => x.id !== id && x.published !== false).slice(0, 3);
  $('#view').innerHTML = `<article class="article">
    ${n.cover ? `<div class="article-cover"><img src="${esc(n.cover)}" alt=""></div>` : ''}
    <div class="article-wrap">
      <a class="back" href="#/news">← Tin tức</a>
      <h1>${esc(n.title)}</h1>
      <p class="article-meta">${fmtDate(n.createdAt)}${n.author ? ` · ${esc(n.author)}` : ''}${n.updatedAt && n.updatedAt - n.createdAt > 60000 ? ` · cập nhật ${fmtDate(n.updatedAt)}` : ''}</p>
      <div class="actions left">
        <button class="btn small" id="shareN">${icon.share} Chia sẻ</button>
        ${store.canEdit ? `<a class="btn small" href="#/news/edit/${encodeURIComponent(id)}">${icon.edit} Sửa</a><button class="btn small danger-ghost" id="delN">${icon.trash} Xoá</button>` : ''}
      </div>
      <div class="article-content ql-content" id="artBody"><p class="muted">Đang tải…</p></div>
      ${others.length ? `<section class="news-more"><h2>Tin khác</h2><div class="news-grid">${others.map(card).join('')}</div></section>` : ''}
    </div>
  </article>`;
  $('#artBody').innerHTML = await sanitize(n.content);
  $('#shareN').onclick = async () => {
    const url = location.href.split('#')[0] + newsLink(id);
    try { if (navigator.share) await navigator.share({ title: n.title, text: excerpt(n, 100), url }); else { await navigator.clipboard.writeText(url); toast('Đã sao chép liên kết'); } } catch { /* huỷ */ }
  };
  $('#delN')?.addEventListener('click', async () => {
    if (await confirmBox(`Xoá bài “${esc(n.title)}”?`, 'Xoá', true)) { await store.deleteNews(id); toast('Đã xoá bài viết'); location.hash = '#/news'; }
  });
}

// ---------- Trình soạn thảo ----------
async function pageEditor(id) {
  if (!store.canEdit) { $('#view').innerHTML = '<div class="page"><div class="empty card"><h2>Cần quyền biên tập để viết bài</h2></div></div>'; return; }
  const n = id ? store.news.get(id) : null;
  if (id && !n) { location.hash = '#/news'; return; }
  editing = true;
  let cover = n?.cover || '';
  const canPush = store.isOwner && store.mode === 'firebase';
  $('#view').innerHTML = `<div class="page narrow editor-page">
    <div class="page-h"><h1>${n ? 'Sửa bài viết' : 'Viết bài mới'}</h1></div>
    <form id="newsForm" class="card" autocomplete="off">
      <label>Tiêu đề *<input name="title" required maxlength="200" value="${esc(n?.title)}" placeholder="VD: Thông báo giỗ tổ năm Bính Ngọ"></label>
      <div class="field"><span>Ảnh bìa</span>
        <div class="cover-pick" id="coverBox">${cover ? `<img src="${esc(cover)}" alt="">` : `<span class="muted">${icon.plus} Chọn ảnh bìa (tỉ lệ 16:9 đẹp nhất)</span>`}</div>
        <div class="actions left"><label class="btn small">Chọn ảnh<input type="file" accept="image/*" id="coverFile" hidden></label>
        <button type="button" class="btn small ghost" id="coverDel">Bỏ ảnh</button></div></div>
      <label>Tóm tắt <small class="muted">(hiện ở danh sách; để trống sẽ lấy đoạn đầu bài)</small><textarea name="summary" rows="2" maxlength="300">${esc(n?.summary)}</textarea></label>
      <div class="field"><span>Nội dung *</span><div id="qEditor" class="q-editor"></div></div>
      <div class="chips-row">
        <label class="pick"><input type="checkbox" name="pinned" ${n?.pinned ? 'checked' : ''}><span>Ghim lên đầu</span></label>
        <label class="pick"><input type="checkbox" name="draft" ${n && n.published === false ? 'checked' : ''}><span>Lưu nháp (chưa đăng)</span></label>
        ${canPush ? `<label class="pick"><input type="checkbox" name="push" ${n ? '' : 'checked'}><span>Gửi thông báo đến mọi người</span></label>` : ''}
      </div>
      <div class="actions">
        <a class="btn ghost" href="${n ? newsLink(n.id) : '#/news'}" id="cancelN">Huỷ</a>
        <button class="btn primary" type="submit">${n ? 'Lưu bài' : 'Đăng bài'}</button>
      </div>
    </form></div>`;

  loadCSS(QUILL_CSS);
  try { await loadScript(QUILL_JS); } catch { toast('Không tải được trình soạn thảo – kiểm tra mạng'); return; }
  const Quill = window.Quill;
  const quill = new Quill('#qEditor', {
    theme: 'snow', placeholder: 'Viết nội dung bài…',
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }], [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          [{ align: [] }], ['blockquote', 'link', 'image', 'video'], ['clean']
        ],
        handlers: {
          image() {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = async () => {
              const f = inp.files[0]; if (!f) return;
              try {
                const url = await shrink(f, 1200, 0.78);
                const r = quill.getSelection(true); quill.insertEmbed(r.index, 'image', url, 'user'); quill.setSelection(r.index + 1);
              } catch { toast('Không đọc được ảnh'); }
            };
            inp.click();
          }
        }
      }
    }
  });
  if (n?.content) quill.clipboard.dangerouslyPasteHTML(await sanitize(n.content));
  const f = $('#newsForm');
  $('#coverFile', f).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { cover = await shrink(file, 1280, 0.8); $('#coverBox', f).innerHTML = `<img src="${cover}" alt="">`; } catch { toast('Không đọc được ảnh'); }
  };
  $('#coverDel', f).onclick = () => { cover = ''; $('#coverBox', f).innerHTML = `<span class="muted">${icon.plus} Chọn ảnh bìa</span>`; };
  $('#cancelN', f).onclick = () => { editing = false; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const content = quill.getSemanticHTML ? quill.getSemanticHTML() : quill.root.innerHTML;
    if (!f.title.value.trim()) return toast('Hãy nhập tiêu đề');
    if (!quill.getText().trim() && !/<img|<iframe/.test(content)) return toast('Hãy nhập nội dung');
    const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      const published = !f.draft.checked;
      const nid = await store.saveNews({ ...(n || {}), title: f.title.value.trim(), summary: f.summary.value.trim(), cover, content, pinned: f.pinned.checked, published });
      if (published && f.push?.checked) {
        await store.sendNotice({ title: f.title.value.trim(), body: f.summary.value.trim() || textOf(content).slice(0, 120), hash: newsLink(nid) });
        toast('Đã đăng bài và xếp lịch gửi thông báo (vài phút)');
      } else toast(published ? 'Đã đăng bài' : 'Đã lưu nháp');
      editing = false;
      location.hash = newsLink(nid);
    } catch (err) { toast(err.message || 'Lỗi khi lưu'); btn.disabled = false; btn.textContent = n ? 'Lưu bài' : 'Đăng bài'; }
  };
}
