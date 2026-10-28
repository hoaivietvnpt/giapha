// Vẽ cây gia phả bằng SVG: bố cục, phóng to/thu nhỏ, kéo, xuất ảnh
import { lifespan } from './family.js';

const CW = 172, CH = 74, SPG = 14, HG = 26, VG = 64, PAD = 40, GEN_COL = 64;
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const initials = (name) => { const w = (name || '?').trim().split(/\s+/); return (w[w.length - 1][0] || '?').toUpperCase(); };

export const TREE_STYLE = `
.tc rect.card{fill:var(--tc-card,#fff);stroke:var(--tc-line,#d6cfc2);stroke-width:1.2}
.tc.m rect.bar{fill:var(--male,#2b5c9e)}.tc.f rect.bar{fill:var(--female,#b4235a)}
.tc.dead rect.card{fill:var(--tc-dead,#f1eee9)}
.tc.inlaw rect.card{stroke-dasharray:4 3}
.tc:hover rect.card{stroke:var(--tc-edge,#b3a796)}
.tc.sel rect.card{stroke:var(--primary,#9f1d1d);stroke-width:2.6}
.tc.hit rect.card{stroke:var(--gold,#a16207);stroke-width:3}
.tc text{font-family:'Be Vietnam Pro',system-ui,sans-serif;fill:var(--tc-text,#1c1917)}
.tc .nm{font-size:13px;font-weight:600}.tc .sub{font-size:11px;fill:var(--tc-sub,#6b645c)}
.tc .av{fill:var(--sunken,#f0ece4)}.tc.m .av{fill:var(--male-soft,#e3ecf7)}.tc.f .av{fill:var(--female-soft,#fbe4ee)}
.tc .avt{font-size:15px;font-weight:700;fill:var(--tc-sub,#6b645c);text-anchor:middle}
.tc.m .avt{fill:var(--male,#2b5c9e)}.tc.f .avt{fill:var(--female,#b4235a)}
.tc .rib{fill:var(--dead,#3f3a36)}
.edge{fill:none;stroke:var(--tc-edge,#b3a796);stroke-width:1.4}
.couple{stroke:var(--primary,#9f1d1d);stroke-width:1.6}
.tg circle{fill:var(--tc-card,#fff);stroke:var(--tc-edge,#b3a796)}.tg text{font-size:13px;font-weight:700;fill:var(--primary,#9f1d1d);text-anchor:middle;font-family:sans-serif}
.genl{font-family:'Noto Serif',serif;font-size:13px;font-weight:700;fill:var(--tc-gen,#9f1d1d)}
.genband{fill:var(--tc-band,rgba(159,29,29,.035))}
`;

export class TreeView {
  constructor(host, { onSelect }) {
    this.host = host;
    this.onSelect = onSelect;
    this.collapsed = new Set();
    this.t = { x: 0, y: 0, k: 1 };
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'tree-svg');
    this.svg.innerHTML = `<style>${TREE_STYLE}</style><g class="vp"></g>`;
    this.vp = this.svg.querySelector('.vp');
    host.appendChild(this.svg);
    this._bindPanZoom();
  }

  /** idx: kết quả buildIndex; opts: {rootId, hideOutside, selected} */
  render(idx, opts = {}) {
    this.idx = idx; this.opts = opts;
    const P = idx.P;
    const rootIds = opts.rootId && P.has(opts.rootId) ? [opts.rootId] : idx.roots;
    const baseGen = opts.rootId && P.has(opts.rootId) ? (idx.gen.get(opts.rootId) || 1) : 1;

    const build = (id, depth) => {
      const p = P.get(id);
      const sp = idx.unitSpouses(id);
      const n = { id, depth, sp, kids: [], uw: CW * (1 + sp.length) + SPG * sp.length };
      const all = idx.treeChildren(id);
      const blockOutside = opts.hideOutside && p.gender === 'f' && depth > 0;
      n.hasKids = all.length > 0 && !blockOutside;
      if (n.hasKids && !this.collapsed.has(id)) n.kids = all.map(k => build(k, depth + 1));
      const kw = n.kids.reduce((s, k) => s + k.sw, 0) + HG * Math.max(0, n.kids.length - 1);
      n.sw = Math.max(n.uw, kw);
      return n;
    };
    const forest = rootIds.map(r => build(r, 0));

    const place = (n, left) => {
      const kw = n.kids.reduce((s, k) => s + k.sw, 0) + HG * Math.max(0, n.kids.length - 1);
      let cx = left + (n.sw - kw) / 2;
      for (const k of n.kids) { place(k, cx); cx += k.sw + HG; }
      if (n.kids.length) {
        // căn giữa cặp vợ chồng trên các con
        const first = n.kids[0], last = n.kids[n.kids.length - 1];
        const mid = (first.x + CW / 2 + last.x + CW / 2) / 2;
        const anchor = n.sp.length ? CW + SPG / 2 : CW / 2;
        n.x = Math.min(Math.max(mid - anchor, left), left + n.sw - n.uw);
      } else n.x = left + (n.sw - n.uw) / 2;
      n.y = n.depth * (CH + VG);
    };
    let left = GEN_COL;
    let maxDepth = 0;
    const flat = [];
    for (const t of forest) { place(t, left); left += t.sw + HG * 3; }
    const walk = (n) => { flat.push(n); maxDepth = Math.max(maxDepth, n.depth); n.kids.forEach(walk); };
    forest.forEach(walk);
    this.flat = flat;
    this.width = Math.max(left - HG * 3, GEN_COL + CW) + PAD;
    this.height = (maxDepth + 1) * (CH + VG) - VG;

    let html = '';
    // dải đời
    for (let d = 0; d <= maxDepth; d++) {
      const y = d * (CH + VG);
      if (d % 2 === 0) html += `<rect class="genband" x="${-PAD}" y="${y - VG / 2}" width="${this.width + PAD * 2}" height="${CH + VG}"/>`;
      html += `<text class="genl" x="0" y="${y + CH / 2 + 5}">Đời ${baseGen + d}</text>`;
    }
    // đường nối
    for (const n of flat) {
      if (n.sp.length) {
        html += `<line class="couple" x1="${n.x + CW}" y1="${n.y + CH / 2}" x2="${n.x + CW + SPG}" y2="${n.y + CH / 2}"/>`;
        for (let i = 1; i < n.sp.length; i++) {
          const x = n.x + (CW + SPG) * i + CW;
          html += `<line class="couple" x1="${x}" y1="${n.y + CH / 2}" x2="${x + SPG}" y2="${n.y + CH / 2}"/>`;
        }
      }
      if (!n.kids.length) continue;
      const sx = n.sp.length ? n.x + CW + SPG / 2 : n.x + CW / 2;
      const sy = n.sp.length ? n.y + CH / 2 : n.y + CH;
      const my = n.y + CH + VG / 2;
      const xs = n.kids.map(k => k.x + CW / 2);
      html += `<path class="edge" d="M${sx},${sy}V${my}M${Math.min(sx, ...xs)},${my}H${Math.max(sx, ...xs)}${xs.map(x => `M${x},${my}V${n.y + CH + VG}`).join('')}"/>`;
    }
    // thẻ người
    for (const n of flat) {
      html += this._card(P.get(n.id), n.x, n.y, false);
      n.sp.forEach((s, i) => { html += this._card(P.get(s), n.x + (CW + SPG) * (i + 1), n.y, true); });
      if (n.hasKids) {
        const c = this.collapsed.has(n.id);
        const cx = n.x + CW / 2, cy = n.y + CH + (n.sp.length ? 10 : 12);
        const count = c ? this.idx.descendants(n.id).size : 0;
        html += `<g class="tg" data-toggle="${n.id}" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="9"/><text x="${cx}" y="${cy + 4.5}">${c ? '+' : '−'}</text>${c ? `<text x="${cx + 14}" y="${cy + 4}" style="font-size:11px;text-anchor:start;fill:var(--tc-sub,#6b645c)">${count}</text>` : ''}</g>`;
      }
    }
    this.vp.innerHTML = html;
    this._apply();
  }

  _card(p, x, y, inlaw) {
    if (!p) return '';
    const dead = p.alive === false;
    const cls = `tc ${p.gender === 'f' ? 'f' : 'm'}${dead ? ' dead' : ''}${inlaw ? ' inlaw' : ''}${this.opts.selected === p.id ? ' sel' : ''}${this.opts.highlight?.has?.(p.id) ? ' hit' : ''}`;
    const clip = `c_${p.id}`;
    const av = p.photo
      ? `<clipPath id="${clip}"><circle cx="${x + 30}" cy="${y + CH / 2}" r="20"/></clipPath><image href="${esc(p.photo)}" x="${x + 10}" y="${y + CH / 2 - 20}" width="40" height="40" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle class="av" cx="${x + 30}" cy="${y + CH / 2}" r="20"/><text class="avt" x="${x + 30}" y="${y + CH / 2 + 5}">${esc(initials(p.name))}</text>`;
    const sub2 = inlaw ? (p.gender === 'f' ? 'Dâu' : 'Rể') : (p.branch || '');
    return `<g class="${cls}" data-id="${p.id}" style="cursor:pointer">
      <rect class="card" x="${x}" y="${y}" width="${CW}" height="${CH}" rx="10"/>
      <rect class="bar" x="${x}" y="${y + 10}" width="4" height="${CH - 20}" rx="2"/>
      ${dead ? `<path class="rib" d="M${x + CW - 16},${y} L${x + CW - 8},${y} L${x + CW},${y + 8} L${x + CW},${y + 16} Z"/>` : ''}
      ${av}
      <text class="nm" x="${x + 58}" y="${y + 27}">${esc(trunc(p.name || '?', 15))}</text>
      <text class="sub" x="${x + 58}" y="${y + 44}">${esc(lifespan(p))}</text>
      <text class="sub" x="${x + 58}" y="${y + 60}">${esc(trunc(sub2, 18))}</text>
    </g>`;
  }

  // ---------- Điều khiển khung nhìn ----------
  _apply() { this.vp.setAttribute('transform', `translate(${this.t.x},${this.t.y}) scale(${this.t.k})`); }

  fit() {
    const r = this.host.getBoundingClientRect();
    const w = this.width + PAD * 2, h = this.height + PAD * 2;
    const minK = r.width < 700 ? 0.5 : 0.25;
    const k = Math.min(1.2, Math.max(minK, Math.min(r.width / w, r.height / h)));
    this.t = { k, x: (r.width - this.width * k) / 2, y: Math.max(PAD * k, (r.height - this.height * k) / 2) };
    if (this.width * k > r.width && this.flat?.length) {
      // cây rộng hơn màn hình: căn giữa vào thủy tổ, bám mép trên
      const root = this.flat[0];
      this.t.x = r.width / 2 - (root.x + root.uw / 2) * k;
      this.t.y = PAD * k + 10;
    }
    this._apply();
  }

  zoomBy(f, cx, cy) {
    const r = this.host.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    const k = Math.min(3, Math.max(0.08, this.t.k * f));
    this.t.x = cx - (cx - this.t.x) * (k / this.t.k);
    this.t.y = cy - (cy - this.t.y) * (k / this.t.k);
    this.t.k = k; this._apply();
  }

  centerOn(id, k) {
    const n = this.flat?.find(n => n.id === id || n.sp.includes(id));
    if (!n) return false;
    const i = n.sp.indexOf(id);
    const x = n.x + (i >= 0 ? (CW + SPG) * (i + 1) : 0) + CW / 2, y = n.y + CH / 2;
    const r = this.host.getBoundingClientRect();
    this.t.k = k || Math.max(this.t.k, 0.9);
    this.t.x = r.width / 2 - x * this.t.k; this.t.y = r.height / 2 - y * this.t.k;
    this.vp.style.transition = 'transform .35s'; this._apply();
    setTimeout(() => { this.vp.style.transition = ''; }, 400);
    return true;
  }

  expandTo(id) {
    // mở các nhánh bị thu gọn để thấy người này
    const P = this.idx.P; let cur = P.get(id); let changed = false;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      for (const par of [cur.fatherId, cur.motherId]) if (par && this.collapsed.delete(par)) changed = true;
      cur = P.get(cur.fatherId) || P.get(cur.motherId);
    }
    return changed;
  }

  _bindPanZoom() {
    const pts = new Map(); let last = null, moved = 0, pinch = null;
    const s = this.svg;
    s.addEventListener('wheel', e => {
      e.preventDefault();
      const r = s.getBoundingClientRect();
      this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    s.addEventListener('pointerdown', e => {
      s.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { last = { x: e.clientX, y: e.clientY }; moved = 0; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.t.k };
      }
    });
    s.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const r = s.getBoundingClientRect();
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomBy((pinch.k * d / pinch.d) / this.t.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        moved = 99; return;
      }
      if (last) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        this.t.x += dx; this.t.y += dy; last = { x: e.clientX, y: e.clientY }; this._apply();
      }
    });
    const up = (e) => {
      const wasClick = pts.size === 1 && moved < 6;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) last = null;
      if (wasClick && e.type === 'pointerup') {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const tg = el?.closest?.('[data-toggle]');
        if (tg) {
          const id = tg.dataset.toggle;
          this.collapsed.has(id) ? this.collapsed.delete(id) : this.collapsed.add(id);
          const keep = { ...this.t }; this.render(this.idx, this.opts); this.t = keep; this._apply();
          return;
        }
        const card = el?.closest?.('[data-id]');
        if (card) this.onSelect?.(card.dataset.id);
      }
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
  }

  collapseFrom(depth) {
    this.collapsed.clear();
    if (depth != null) for (const n of this.flat || []) if (n.depth >= depth && n.hasKids) this.collapsed.add(n.id);
  }

  // ---------- Xuất ----------
  exportSVG() {
    const w = this.width + PAD * 2, h = this.height + PAD * 2 + 50;
    const title = esc(this.opts.title || 'Gia phả');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-PAD} ${-PAD - 50} ${w} ${h}">
<style>${TREE_STYLE}</style><rect x="${-PAD}" y="${-PAD - 50}" width="${w}" height="${h}" fill="#f7f5f0"/>
<text x="${this.width / 2}" y="-38" text-anchor="middle" style="font-family:'Noto Serif',serif;font-size:26px;font-weight:700;fill:#9f1d1d">${title}</text>
${this.vp.innerHTML.replace(/<g class="tg"[\s\S]*?<\/g>/g, '')}</svg>`;
  }

  async exportPNG() {
    const svg = this.exportSVG();
    const w = this.width + PAD * 2, h = this.height + PAD * 2 + 50;
    const scale = Math.min(2, 16000 / w, 16000 / h);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
}
